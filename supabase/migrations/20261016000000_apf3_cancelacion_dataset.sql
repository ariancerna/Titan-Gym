-- APF3: cancelación por el socio y dataset de asistencia para el modelo de no-shows.
-- Una inasistencia "no avisada" solo puede medirse si el socio tiene forma de avisar.

alter table public.reservations add column cancelled_at timestamptz;
update public.reservations set cancelled_at = updated_at where status = 'cancelled' and cancelled_at is null;

-- La fecha de cancelación la pone la base de datos, también en cambios hechos desde el editor SQL.
create function private.stamp_cancellation() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
  elsif new.status <> 'cancelled' then
    new.cancelled_at := null;
  end if;
  return new;
end $$;
create trigger reservation_cancelled_at before update of status on public.reservations
  for each row execute function private.stamp_cancellation();
revoke all on function private.stamp_cancellation() from public, anon, authenticated;

-- El socio solo puede cancelar sus propias reservas y antes de que empiece la clase.
-- La asistencia se registra desde el inicio de la sesión, así que ambas operaciones no se cruzan.
create function private.cancel_reservation(p_reservation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; starts timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.reservations where id = p_reservation_id and user_id = auth.uid() for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if r.status = 'cancelled' then return; end if;
  select starts_at into starts from public.class_sessions where id = r.session_id;
  if starts <= now() then raise exception 'CANCEL_TOO_LATE'; end if;
  update public.reservations set status = 'cancelled' where id = r.id;
end $$;
revoke all on function private.cancel_reservation(uuid) from public, anon;
grant execute on function private.cancel_reservation(uuid) to authenticated;
create function public.cancel_reservation(p_reservation_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.cancel_reservation(p_reservation_id); $$;
revoke all on function public.cancel_reservation(uuid) from public, anon;
grant execute on function public.cancel_reservation(uuid) to authenticated;

-- Una fila por reserva de sesiones que ya comenzaron (solo ellas tienen resultado conocido).
-- Sin nombres ni correos: el socio se identifica con un hash del UUID (seudonimización, Ley 29733).
-- asistio: true = presente, false = ausente sin cancelar (no-show), null = sin registrar o cancelada.
create function private.admin_dataset()
returns table(
  reserva_id uuid, socio_ref text, sesion_id uuid, clase text, disciplina text, instructor text,
  inicio_sesion timestamptz, dia_semana integer, hora_inicio integer, duracion_min integer,
  capacidad integer, reservas_activas integer, fecha_reserva timestamptz, anticipacion_horas double precision,
  reservas_previas integer, inasistencias_previas integer, estado text, cancelada_en timestamptz,
  asistencia text, asistio boolean
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
  reservas_previas integer, inasistencias_previas integer, estado text, cancelada_en timestamptz,
  asistencia text, asistio boolean
)
language sql stable security invoker set search_path = '' as $$ select * from private.admin_dataset(); $$;
revoke all on function public.admin_dataset() from public, anon;
grant execute on function public.admin_dataset() to authenticated;
