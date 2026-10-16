-- HU07: recordatorio por correo 3 horas antes de la clase.
-- Lo envía una tarea programada (tools/send-reminders.mjs) con la clave de servicio;
-- ni los socios ni los visitantes pueden ejecutar estas funciones.

alter table public.reservations add column reminder_sent_at timestamptz;

-- Preferencia del socio. Sin fila = recibe recordatorios (forma parte del servicio de reservas).
create table public.member_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_reminders boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.member_preferences enable row level security;
revoke all on public.member_preferences from public, anon, authenticated;
grant select on public.member_preferences to authenticated;
create policy member_preferences_owner on public.member_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

create function private.set_email_reminders(p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_enabled is null then raise exception 'INVALID_PREFERENCE'; end if;
  insert into public.member_preferences(user_id, email_reminders)
  values (auth.uid(), p_enabled)
  on conflict (user_id) do update set email_reminders = excluded.email_reminders, updated_at = now();
end $$;
revoke all on function private.set_email_reminders(boolean) from public, anon;
grant execute on function private.set_email_reminders(boolean) to authenticated;
create function public.set_email_reminders(p_enabled boolean) returns void
language sql security invoker set search_path = '' as $$ select private.set_email_reminders(p_enabled); $$;
revoke all on function public.set_email_reminders(boolean) from public, anon;
grant execute on function public.set_email_reminders(boolean) to authenticated;

-- Reserva los recordatorios pendientes y los marca como enviados en la misma operación, para que
-- dos ejecuciones simultáneas de la tarea nunca envíen el mismo correo. Ventana: clases que
-- empiezan entre 15 minutos y p_hours horas desde ahora (tolera retrasos de la tarea programada).
-- Con p_preview = true solo los lista, sin marcarlos (prueba en seco).
create function private.claim_reminders(p_hours integer default 3, p_preview boolean default false)
returns table(
  reservation_id uuid, code text, member_name text, member_email text,
  class_name text, starts_at timestamptz, duration_minutes integer, room text, address text
)
language plpgsql security definer set search_path = '' as $$
begin
  if p_hours is null or p_hours not between 1 and 24 then raise exception 'INVALID_WINDOW'; end if;
  return query
  with due as (
    select r.id
    from public.reservations r
    join public.class_sessions s on s.id = r.session_id
    left join public.member_preferences p on p.user_id = r.user_id
    where r.status = 'confirmed'
      and r.reminder_sent_at is null
      and s.published
      and s.starts_at between now() + interval '15 minutes' and now() + make_interval(hours => p_hours)
      and coalesce(p.email_reminders, true)
      -- Nunca a los socios de demostración (seed y datos simulados de la exposición): sus correos
      -- son ficticios o subdirecciones del administrador y llenarían su bandeja.
      and r.user_id::text not like '60000000-0000-4000-8000-%'
      and r.member_email not like '%.invalid'
    order by s.starts_at
    limit 200
    for update of r skip locked
  ),
  marked as (
    update public.reservations r set reminder_sent_at = now()
    from due where r.id = due.id and not p_preview
    returning r.id
  )
  select r.id, r.code, r.member_name, r.member_email, c.name, s.starts_at, s.duration_minutes, s.room, l.address
  from due
  join public.reservations r on r.id = due.id
  join public.class_sessions s on s.id = r.session_id
  join public.classes c on c.id = s.class_id
  join public.locations l on l.id = s.location_id
  where p_preview or due.id in (select id from marked)
  order by s.starts_at;
end $$;

-- Si el correo no se pudo enviar, la reserva vuelve a quedar pendiente para el siguiente intento.
create function private.release_reminder(p_reservation_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.reservations set reminder_sent_at = null where id = p_reservation_id;
$$;

-- La tarea usa la clave de servicio: necesita entrar al esquema privado solo para estas funciones.
grant usage on schema private to service_role;
revoke all on function private.claim_reminders(integer, boolean), private.release_reminder(uuid)
  from public, anon, authenticated;
grant execute on function private.claim_reminders(integer, boolean), private.release_reminder(uuid)
  to service_role;
create function public.claim_reminders(p_hours integer default 3, p_preview boolean default false)
returns table(
  reservation_id uuid, code text, member_name text, member_email text,
  class_name text, starts_at timestamptz, duration_minutes integer, room text, address text
)
language sql security invoker set search_path = '' as $$ select * from private.claim_reminders(p_hours, p_preview); $$;
create function public.release_reminder(p_reservation_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.release_reminder(p_reservation_id); $$;
revoke all on function public.claim_reminders(integer, boolean), public.release_reminder(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_reminders(integer, boolean), public.release_reminder(uuid)
  to service_role;

-- Dataset: nueva variable para medir si el recordatorio reduce los no-shows.
drop function public.admin_dataset();
drop function private.admin_dataset();
create function private.admin_dataset()
returns table(
  reserva_id uuid, socio_ref text, sesion_id uuid, clase text, disciplina text, instructor text,
  inicio_sesion timestamptz, dia_semana integer, hora_inicio integer, duracion_min integer,
  capacidad integer, reservas_activas integer, fecha_reserva timestamptz, anticipacion_horas double precision,
  reservas_previas integer, inasistencias_previas integer, recordatorio_enviado boolean,
  estado text, cancelada_en timestamptz, asistencia text, asistio boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  return query
  select r.id,
    left(encode(sha256(convert_to(r.user_id::text, 'UTF8')), 'hex'), 16),
    s.id, c.name, d.name, i.name, s.starts_at,
    extract(isodow from s.starts_at at time zone 'America/Lima')::integer,
    extract(hour from s.starts_at at time zone 'America/Lima')::integer,
    s.duration_minutes, s.capacity,
    (select count(*) from public.reservations x
      where x.session_id = s.id and x.status in ('confirmed', 'attended'))::integer,
    r.created_at,
    round((extract(epoch from (s.starts_at - r.created_at)) / 3600)::numeric, 1)::double precision,
    (select count(*) from public.reservations p join public.class_sessions ps on ps.id = p.session_id
      where p.user_id = r.user_id and ps.starts_at < s.starts_at)::integer,
    (select count(*) from public.reservations p join public.class_sessions ps on ps.id = p.session_id
      join public.attendance pa on pa.reservation_id = p.id
      where p.user_id = r.user_id and ps.starts_at < s.starts_at and pa.status = 'absent')::integer,
    r.reminder_sent_at is not null,
    r.status, r.cancelled_at,
    case when r.status = 'cancelled' then null else coalesce(a.status, 'pending') end,
    case when r.status = 'cancelled' then null
      when a.status = 'present' then true when a.status = 'absent' then false end
  from public.reservations r
  join public.class_sessions s on s.id = r.session_id
  join public.classes c on c.id = s.class_id
  join public.disciplines d on d.id = c.discipline_id
  join public.instructors i on i.id = s.instructor_id
  left join public.attendance a on a.reservation_id = r.id
  where s.starts_at <= now()
  order by s.starts_at, r.created_at;
end $$;
revoke all on function private.admin_dataset() from public, anon;
grant execute on function private.admin_dataset() to authenticated;
create function public.admin_dataset()
returns table(
  reserva_id uuid, socio_ref text, sesion_id uuid, clase text, disciplina text, instructor text,
  inicio_sesion timestamptz, dia_semana integer, hora_inicio integer, duracion_min integer,
  capacidad integer, reservas_activas integer, fecha_reserva timestamptz, anticipacion_horas double precision,
  reservas_previas integer, inasistencias_previas integer, recordatorio_enviado boolean,
  estado text, cancelada_en timestamptz, asistencia text, asistio boolean
)
language sql stable security invoker set search_path = '' as $$ select * from private.admin_dataset(); $$;
revoke all on function public.admin_dataset() from public, anon;
grant execute on function public.admin_dataset() to authenticated;
