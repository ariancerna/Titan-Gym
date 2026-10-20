-- Panel de administración: cancelar sesiones con aviso, sesiones semanales, instructores,
-- lista de espera visible y datos para la vista "Hoy". Las funciones modificadas parten de su
-- versión vigente (ventana de 7 días, privacidad, lista de espera y recordatorios).

-- Sesión cancelada por el gimnasio (p. ej. instructor enfermo). No se borra: queda el registro.
alter table public.class_sessions
  add column cancelled_at timestamptz,
  add column cancel_reason text check (cancel_reason is null or length(trim(cancel_reason)) between 3 and 200);
-- Reservas canceladas por el gimnasio: no son "cancelaciones con aviso" del socio y se le avisa.
alter table public.reservations
  add column cancelled_by_gym boolean not null default false,
  add column cancellation_notice_sent_at timestamptz;


-- Versiones vigentes + rechazo de sesiones canceladas.

create or replace function private.reserve_session(p_session_id uuid, p_member_name text, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.class_sessions; owner_id uuid; verified_email text; result_id uuid;
begin
  owner_id := auth.uid();
  select lower(email) into verified_email from auth.users
    where id=owner_id and email_confirmed_at is not null and not coalesce(is_anonymous,false);
  if owner_id is null or verified_email is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.privacy_consents
    where user_id=owner_id and policy_version=private.current_privacy_version()) then
    raise exception 'PRIVACY_CONSENT_REQUIRED';
  end if;
  if lower(trim(p_email)) is distinct from verified_email then raise exception 'EMAIL_MISMATCH'; end if;
  if p_member_name is null or length(trim(p_member_name)) not between 3 and 100
    or trim(p_member_name) !~ '[[:space:]]' then raise exception 'INVALID_MEMBER'; end if;
  select * into s from public.class_sessions where id=p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if not s.published or s.cancelled_at is not null or s.starts_at <= now() then raise exception 'SESSION_CLOSED'; end if;
  if s.starts_at > now() + private.booking_window() then raise exception 'BOOKING_NOT_OPEN'; end if;
  if exists(select 1 from public.reservations where session_id=s.id and user_id=owner_id and status in ('confirmed','attended')) then
    raise exception 'DUPLICATE_RESERVATION';
  end if;
  if (select count(*) from public.reservations where session_id=s.id and status in ('confirmed','attended')) >= s.capacity then
    raise exception 'SESSION_FULL';
  end if;
  insert into public.reservations(session_id,user_id,member_name,member_email)
    values(s.id,owner_id,trim(p_member_name),verified_email) returning id into result_id;
  return result_id;
end $$;

create or replace function private.join_waitlist(p_session_id uuid, p_member_name text, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.class_sessions; owner_id uuid; verified_email text; result_id uuid;
begin
  owner_id := auth.uid();
  select lower(email) into verified_email from auth.users
    where id = owner_id and email_confirmed_at is not null and not coalesce(is_anonymous, false);
  if owner_id is null or verified_email is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.privacy_consents
    where user_id = owner_id and policy_version = private.current_privacy_version()) then
    raise exception 'PRIVACY_CONSENT_REQUIRED';
  end if;
  if lower(trim(p_email)) is distinct from verified_email then raise exception 'EMAIL_MISMATCH'; end if;
  if p_member_name is null or length(trim(p_member_name)) not between 3 and 100
    or trim(p_member_name) !~ '[[:space:]]' then raise exception 'INVALID_MEMBER'; end if;
  select * into s from public.class_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if not s.published or s.cancelled_at is not null or s.starts_at <= now() then raise exception 'SESSION_CLOSED'; end if;
  if s.starts_at > now() + private.booking_window() then raise exception 'BOOKING_NOT_OPEN'; end if;
  if s.starts_at <= now() + private.waitlist_cutoff() then raise exception 'WAITLIST_CLOSED'; end if;
  if exists(select 1 from public.reservations where session_id = s.id and user_id = owner_id
      and status in ('confirmed', 'attended')) then
    raise exception 'DUPLICATE_RESERVATION';
  end if;
  if (select count(*) from public.reservations where session_id = s.id
      and status in ('confirmed', 'attended')) < s.capacity then
    raise exception 'SESSION_HAS_SEATS';
  end if;
  if exists(select 1 from public.waitlist where session_id = s.id and user_id = owner_id
      and status = 'waiting') then
    raise exception 'ALREADY_WAITING';
  end if;
  insert into public.waitlist(session_id, user_id, member_name, member_email)
    values (s.id, owner_id, trim(p_member_name), verified_email) returning id into result_id;
  return result_id;
end $$;

create or replace function private.promote_waitlist(p_session_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare s public.class_sessions; entry public.waitlist; free integer; new_id uuid; promoted integer := 0;
begin
  select * into s from public.class_sessions where id = p_session_id for update;
  if not found or not s.published or s.cancelled_at is not null
    or s.starts_at <= now() + private.waitlist_cutoff() then
    return 0;
  end if;
  free := s.capacity - (select count(*) from public.reservations
    where session_id = s.id and status in ('confirmed', 'attended'));
  while free > 0 loop
    select * into entry from public.waitlist
      where session_id = s.id and status = 'waiting' order by created_at, id limit 1 for update;
    exit when not found;
    if exists(select 1 from public.reservations where session_id = s.id and user_id = entry.user_id
        and status in ('confirmed', 'attended')) then
      -- Reservó por su cuenta mientras esperaba: sale de la fila sin ocupar otro cupo.
      update public.waitlist set status = 'left' where id = entry.id;
      continue;
    end if;
    insert into public.reservations(session_id, user_id, member_name, member_email)
      values (s.id, entry.user_id, entry.member_name, entry.member_email) returning id into new_id;
    update public.waitlist set status = 'promoted', reservation_id = new_id where id = entry.id;
    free := free - 1;
    promoted := promoted + 1;
  end loop;
  return promoted;
end $$;

-- Una sesión cancelada no se puede editar.

create or replace function private.admin_save_session(p_data jsonb,p_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.class_sessions; old_s public.class_sessions; result uuid;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  s.class_id := (p_data->>'class_id')::uuid; s.instructor_id := (p_data->>'instructor_id')::uuid;
  s.location_id := (p_data->>'location_id')::uuid; s.room := trim(p_data->>'room');
  s.starts_at := (p_data->>'starts_at')::timestamptz; s.capacity := (p_data->>'capacity')::integer;
  s.duration_minutes := (p_data->>'duration_minutes')::integer; s.published := (p_data->>'published')::boolean;
  if p_data is null or s.starts_at is null or s.starts_at<=now() or s.room is null
    or length(s.room) not between 2 and 80 then raise exception 'INVALID_SESSION'; end if;
  if p_id is null then
    insert into public.class_sessions(class_id,instructor_id,location_id,room,starts_at,capacity,duration_minutes,published)
    values(s.class_id,s.instructor_id,s.location_id,s.room,s.starts_at,s.capacity,s.duration_minutes,s.published) returning id into result;
  else
    select * into old_s from public.class_sessions where id=p_id for update;
    if not found then raise exception 'SESSION_NOT_FOUND'; end if;
    if old_s.cancelled_at is not null then raise exception 'SESSION_CANCELLED'; end if;
    if exists(select 1 from public.reservations where session_id=p_id) and
      (s.class_id is distinct from old_s.class_id or s.instructor_id is distinct from old_s.instructor_id
       or s.location_id is distinct from old_s.location_id or s.room is distinct from old_s.room
       or s.starts_at is distinct from old_s.starts_at or s.duration_minutes is distinct from old_s.duration_minutes
       or s.published is distinct from old_s.published) then raise exception 'SESSION_HAS_RESERVATIONS'; end if;
    update public.class_sessions set class_id=s.class_id,instructor_id=s.instructor_id,location_id=s.location_id,
      room=s.room,starts_at=s.starts_at,capacity=s.capacity,duration_minutes=s.duration_minutes,published=s.published
      where id=p_id returning id into result;
  end if;
  return result;
end $$;

-- Panel: cuántos esperan y cuántos llegaron en cada sesión (vista "Hoy").

create or replace function private.admin_snapshot() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  return jsonb_build_object(
    'disciplines',(select coalesce(jsonb_agg(d order by name),'[]') from public.disciplines d),
    'locations',(select coalesce(jsonb_agg(l order by name),'[]') from public.locations l),
    'instructors',(select coalesce(jsonb_agg(i order by name),'[]') from public.instructors i),
    'classes',(select coalesce(jsonb_agg(c order by name),'[]') from public.classes c),
    'sessions',(select coalesce(jsonb_agg(x order by starts_at desc),'[]') from (
      select s.*,c.name,i.name instructor,l.name location,
        (select count(*)::integer from public.reservations r where r.session_id=s.id and r.status in ('confirmed','attended')) reserved,
        (select count(*)::integer from public.waitlist w where w.session_id=s.id and w.status='waiting') waiting,
        (select count(*)::integer from public.attendance a join public.reservations r2 on r2.id=a.reservation_id
          where r2.session_id=s.id and a.status='present') present
      from public.class_sessions s join public.classes c on c.id=s.class_id
      join public.instructors i on i.id=s.instructor_id join public.locations l on l.id=s.location_id
    ) x));
end $$;

-- Historial de asistencia: el correo de quien registró, no solo su UUID.

create or replace function private.admin_roster(p_session_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(x order by member_name),'[]') from (
    select r.id,r.code,r.member_name,r.member_email,r.status,
      coalesce(a.status,'pending') attendance_status,a.updated_at attendance_updated_at,
      (select coalesce(jsonb_agg(jsonb_build_object('status',h.status,'previous_status',h.previous_status,
        'recorded_by',h.recorded_by,'recorded_by_email',(select u.email from auth.users u where u.id=h.recorded_by),'created_at',h.created_at) order by h.created_at desc),'[]')
        from private.attendance_history h where h.reservation_id=r.id) history
    from public.reservations r left join public.attendance a on a.reservation_id=r.id where r.session_id=p_session_id
  ) x);
end $$;

-- Dataset: las sesiones canceladas por el gimnasio no son observaciones de asistencia.

create or replace function private.admin_dataset()
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
  where s.starts_at <= now() and s.cancelled_at is null
  order by s.starts_at, r.created_at;
end $$;

-- Catálogo: sin sesiones canceladas; por id devuelve si se canceló y por qué (para el comprobante).
drop function public.list_sessions(uuid);
drop function private.list_sessions(uuid);

create function private.list_sessions(p_session_id uuid default null)
returns table(id uuid,class_id uuid,name text,description text,discipline text,image_url text,featured_image_url text,
 instructor text,instructor_bio text,instructor_image text,location text,address text,room text,
 starts_at timestamptz,duration_minutes integer,capacity integer,reserved integer,available integer,cancelled boolean,cancel_reason text)
language sql stable security definer set search_path = '' as $$
select s.id,c.id,c.name,c.description,d.name,c.image_url,c.featured_image_url,i.name,i.bio,i.image_url,l.name,l.address,s.room,
 s.starts_at,s.duration_minutes,s.capacity,counts.n::integer,(s.capacity-counts.n)::integer,
 s.cancelled_at is not null,s.cancel_reason
from public.class_sessions s
join public.classes c on c.id=s.class_id join public.disciplines d on d.id=c.discipline_id
join public.instructors i on i.id=s.instructor_id join public.locations l on l.id=s.location_id
cross join lateral (select count(*) n from public.reservations r where r.session_id=s.id and r.status in ('confirmed','attended')) counts
where s.published
  and (p_session_id is not null or (s.cancelled_at is null and s.starts_at > now() and s.starts_at <= now() + private.booking_window()))
  and (p_session_id is null or s.id=p_session_id)
order by s.starts_at;
$$;

revoke all on function private.list_sessions(uuid) from public;
grant execute on function private.list_sessions(uuid) to anon, authenticated;
create function public.list_sessions(p_session_id uuid default null)
returns table(id uuid,class_id uuid,name text,description text,discipline text,image_url text,featured_image_url text,
 instructor text,instructor_bio text,instructor_image text,location text,address text,room text,
 starts_at timestamptz,duration_minutes integer,capacity integer,reserved integer,available integer,
 cancelled boolean,cancel_reason text)
language sql stable security invoker set search_path = '' as $$ select * from private.list_sessions(p_session_id); $$;
revoke all on function public.list_sessions(uuid) from public;
grant execute on function public.list_sessions(uuid) to anon, authenticated;

-- Cancelar una sesión futura: sus reservas pasan a canceladas por el gimnasio, la lista de espera
-- se cierra y la tarea de recordatorios avisa por correo a cada inscrito (claim_cancellation_notices).
create function private.admin_cancel_session(p_session_id uuid, p_reason text) returns integer
language plpgsql security definer set search_path = '' as $$
declare s public.class_sessions; affected integer;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 200 then raise exception 'INVALID_REASON'; end if;
  select * into s from public.class_sessions where id = p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if s.cancelled_at is not null then raise exception 'SESSION_CANCELLED'; end if;
  if s.starts_at <= now() then raise exception 'SESSION_STARTED'; end if;
  update public.class_sessions set cancelled_at = now(), cancel_reason = trim(p_reason) where id = s.id;
  update public.reservations set status = 'cancelled', cancelled_by_gym = true
    where session_id = s.id and status in ('confirmed', 'attended');
  get diagnostics affected = row_count;
  update public.waitlist set status = 'left' where session_id = s.id and status = 'waiting';
  return affected;
end $$;

-- Programar la misma sesión cada semana hasta una fecha (máximo 26 semanas). Las semanas en las
-- que la sala ya está ocupada a esa hora se omiten y se informan; el resto se crea en una sola
-- transacción con las mismas validaciones que admin_save_session.
create function private.admin_create_recurring_sessions(p_data jsonb, p_until date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  first_start timestamptz; week_start timestamptz; created integer := 0; skipped integer := 0;
  v_room text; v_class uuid; v_instructor uuid; v_location uuid;
  v_capacity integer; v_duration integer; v_published boolean;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  first_start := (p_data->>'starts_at')::timestamptz;
  v_room := trim(p_data->>'room');
  v_class := (p_data->>'class_id')::uuid; v_instructor := (p_data->>'instructor_id')::uuid;
  v_location := (p_data->>'location_id')::uuid; v_capacity := (p_data->>'capacity')::integer;
  v_duration := (p_data->>'duration_minutes')::integer; v_published := (p_data->>'published')::boolean;
  if first_start is null or first_start <= now() or v_room is null or length(v_room) not between 2 and 80
    then raise exception 'INVALID_SESSION'; end if;
  if p_until is null or p_until < (first_start at time zone 'America/Lima')::date
    or p_until > (first_start at time zone 'America/Lima')::date + 182 then
    raise exception 'INVALID_RECURRENCE';
  end if;
  week_start := first_start;
  while (week_start at time zone 'America/Lima')::date <= p_until loop
    if exists(select 1 from public.class_sessions x
        where x.location_id = v_location and x.room = v_room and x.starts_at = week_start) then
      skipped := skipped + 1;
    else
      insert into public.class_sessions(class_id, instructor_id, location_id, room, starts_at, capacity,
        duration_minutes, published)
      values (v_class, v_instructor, v_location, v_room, week_start, v_capacity, v_duration, v_published);
      created := created + 1;
    end if;
    week_start := week_start + interval '7 days';
  end loop;
  return jsonb_build_object('created', created, 'skipped', skipped);
end $$;

-- Instructores: alta y edición desde el panel.
create function private.admin_save_instructor(p_data jsonb, p_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; instructor_name text := trim(p_data->>'name'); instructor_bio text := trim(coalesce(p_data->>'bio', ''));
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if instructor_name is null or length(instructor_name) not between 3 and 80 or length(instructor_bio) > 300 then
    raise exception 'INVALID_INSTRUCTOR';
  end if;
  if p_id is null then
    insert into public.instructors(name, bio) values (instructor_name, instructor_bio) returning id into result;
  else
    update public.instructors set name = instructor_name, bio = instructor_bio where id = p_id returning id into result;
    if result is null then raise exception 'INSTRUCTOR_NOT_FOUND'; end if;
  end if;
  return result;
end $$;

-- Lista de espera de una sesión, en orden de llegada (solo administradores).
create function private.admin_waitlist(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(x order by x.created_at, x.id), '[]') from (
    select w.id, w.member_name, w.member_email, w.status, w.created_at
    from public.waitlist w where w.session_id = p_session_id and w.status in ('waiting', 'promoted')
  ) x);
end $$;

-- Aviso por correo de sesión cancelada. Igual que claim_reminders: marca y devuelve en la misma
-- operación y excluye a los socios de demostración.
create function private.claim_cancellation_notices(p_preview boolean default false)
returns table(
  reservation_id uuid, code text, member_name text, member_email text,
  class_name text, starts_at timestamptz, duration_minutes integer, room text, address text,
  cancel_reason text
)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with due as (
    select r.id
    from public.reservations r
    join public.class_sessions s on s.id = r.session_id
    where r.cancelled_by_gym and r.cancellation_notice_sent_at is null
      and s.cancelled_at is not null and s.starts_at > now()
      and r.user_id::text not like '60000000-0000-4000-8000-%'
      and r.member_email not like '%.invalid'
    order by s.starts_at
    limit 200
    for update of r skip locked
  ),
  marked as (
    update public.reservations r set cancellation_notice_sent_at = now()
    from due where r.id = due.id and not p_preview
    returning r.id
  )
  select r.id, r.code, r.member_name, r.member_email, c.name, s.starts_at, s.duration_minutes, s.room, l.address,
    s.cancel_reason
  from due
  join public.reservations r on r.id = due.id
  join public.class_sessions s on s.id = r.session_id
  join public.classes c on c.id = s.class_id
  join public.locations l on l.id = s.location_id
  where p_preview or due.id in (select id from marked)
  order by s.starts_at;
end $$;
create function private.release_cancellation_notice(p_reservation_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.reservations set cancellation_notice_sent_at = null where id = p_reservation_id;
$$;

-- Permisos: administración para usuarios autenticados (cada función comprueba el rol);
-- avisos por correo solo con la clave de servicio.
revoke all on function private.admin_cancel_session(uuid, text), private.admin_create_recurring_sessions(jsonb, date),
  private.admin_save_instructor(jsonb, uuid), private.admin_waitlist(uuid) from public, anon;
grant execute on function private.admin_cancel_session(uuid, text), private.admin_create_recurring_sessions(jsonb, date),
  private.admin_save_instructor(jsonb, uuid), private.admin_waitlist(uuid) to authenticated;
revoke all on function private.claim_cancellation_notices(boolean), private.release_cancellation_notice(uuid)
  from public, anon, authenticated;
grant execute on function private.claim_cancellation_notices(boolean), private.release_cancellation_notice(uuid)
  to service_role;

create function public.admin_cancel_session(p_session_id uuid, p_reason text) returns integer
language sql security invoker set search_path = '' as $$ select private.admin_cancel_session(p_session_id, p_reason); $$;
create function public.admin_create_recurring_sessions(p_data jsonb, p_until date) returns jsonb
language sql security invoker set search_path = '' as $$ select private.admin_create_recurring_sessions(p_data, p_until); $$;
create function public.admin_save_instructor(p_data jsonb, p_id uuid default null) returns uuid
language sql security invoker set search_path = '' as $$ select private.admin_save_instructor(p_data, p_id); $$;
create function public.admin_waitlist(p_session_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.admin_waitlist(p_session_id); $$;
revoke all on function public.admin_cancel_session(uuid, text), public.admin_create_recurring_sessions(jsonb, date),
  public.admin_save_instructor(jsonb, uuid), public.admin_waitlist(uuid) from public, anon;
grant execute on function public.admin_cancel_session(uuid, text), public.admin_create_recurring_sessions(jsonb, date),
  public.admin_save_instructor(jsonb, uuid), public.admin_waitlist(uuid) to authenticated;

create function public.claim_cancellation_notices(p_preview boolean default false)
returns table(
  reservation_id uuid, code text, member_name text, member_email text,
  class_name text, starts_at timestamptz, duration_minutes integer, room text, address text,
  cancel_reason text
)
language sql security invoker set search_path = '' as $$ select * from private.claim_cancellation_notices(p_preview); $$;
create function public.release_cancellation_notice(p_reservation_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.release_cancellation_notice(p_reservation_id); $$;
revoke all on function public.claim_cancellation_notices(boolean), public.release_cancellation_notice(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_cancellation_notices(boolean), public.release_cancellation_notice(uuid)
  to service_role;

