-- US08: lista de espera. Si una clase está llena, el socio se apunta; cuando se libera un cupo
-- (cancelación o aumento de capacidad), el primero de la fila recibe la reserva automáticamente,
-- en la misma transacción y con la sesión bloqueada, así que el aforo nunca se supera.
-- La tarea programada de recordatorios le avisa por correo (claim_waitlist_notices).

-- En la última hora no se asignan cupos: quien no vea el correo a tiempo sería un no-show seguro.
-- Ese cupo queda libre para reservar directamente.
create function private.waitlist_cutoff() returns interval
language sql immutable set search_path = '' as $$ select interval '1 hour' $$;

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_name text not null check (length(trim(member_name)) between 3 and 100),
  member_email text not null,
  status text not null default 'waiting' check (status in ('waiting', 'promoted', 'left')),
  reservation_id uuid references public.reservations(id) on delete set null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Una sola entrada activa por socio y sesión; la fila se ordena por llegada.
create unique index waitlist_one_waiting on public.waitlist(session_id, user_id) where status = 'waiting';
create index waitlist_queue on public.waitlist(session_id, created_at) where status = 'waiting';
create index waitlist_owner on public.waitlist(user_id);
create trigger touch_updated_at before update on public.waitlist
  for each row execute function private.touch_updated_at();
alter table public.waitlist enable row level security;
revoke all on public.waitlist from public, anon, authenticated;
grant select on public.waitlist to authenticated;
create policy waitlist_owner on public.waitlist for select to authenticated
  using ((select auth.uid()) = user_id);

-- Asigna los cupos libres a la fila. Interna: la llaman cancel_reservation y el trigger de
-- capacidad, que ya tienen la sesión bloqueada.
create function private.promote_waitlist(p_session_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare s public.class_sessions; entry public.waitlist; free integer; new_id uuid; promoted integer := 0;
begin
  select * into s from public.class_sessions where id = p_session_id for update;
  if not found or not s.published or s.starts_at <= now() + private.waitlist_cutoff() then
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
revoke all on function private.promote_waitlist(uuid) from public, anon, authenticated;

-- Mismas comprobaciones de identidad, consentimiento y datos que reserve_session.
create function private.join_waitlist(p_session_id uuid, p_member_name text, p_email text)
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
  if not s.published or s.starts_at <= now() then raise exception 'SESSION_CLOSED'; end if;
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

create function private.leave_waitlist(p_entry_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.waitlist set status = 'left'
    where id = p_entry_id and user_id = auth.uid() and status = 'waiting';
  if not found and not exists(select 1 from public.waitlist where id = p_entry_id and user_id = auth.uid()) then
    raise exception 'WAITLIST_NOT_FOUND';
  end if;
end $$;

-- Entradas activas del socio con su posición. La posición necesita contar a otros socios,
-- que RLS oculta: por eso es una función que solo devuelve cantidades, nunca sus datos.
create function private.my_waitlist()
returns table(id uuid, session_id uuid, name text, instructor text, room text,
  starts_at timestamptz, duration_minutes integer, queue_position integer, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select w.id, s.id, c.name, i.name, s.room, s.starts_at, s.duration_minutes,
    (select count(*) from public.waitlist x where x.session_id = w.session_id and x.status = 'waiting'
      and (x.created_at, x.id) <= (w.created_at, w.id))::integer,
    w.created_at
  from public.waitlist w
  join public.class_sessions s on s.id = w.session_id
  join public.classes c on c.id = s.class_id
  join public.instructors i on i.id = s.instructor_id
  where w.user_id = auth.uid() and w.status = 'waiting' and s.published and s.starts_at > now()
  order by s.starts_at;
$$;

-- Cancelación: ahora bloquea primero la sesión (mismo orden que reserve_session, sin interbloqueos)
-- y, al liberar el cupo, se lo asigna al primero de la fila.
create or replace function private.cancel_reservation(p_reservation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; sid uuid; starts timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select session_id into sid from public.reservations where id = p_reservation_id and user_id = auth.uid();
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  select starts_at into starts from public.class_sessions where id = sid for update;
  select * into r from public.reservations where id = p_reservation_id for update;
  if r.status = 'cancelled' then return; end if;
  if starts <= now() then raise exception 'CANCEL_TOO_LATE'; end if;
  update public.reservations set status = 'cancelled' where id = r.id;
  perform private.promote_waitlist(sid);
end $$;

-- Si el administrador sube la capacidad, los nuevos cupos también van a la fila.
create function private.promote_on_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.capacity > old.capacity then perform private.promote_waitlist(new.id); end if;
  return null;
end $$;
revoke all on function private.promote_on_capacity() from public, anon, authenticated;
create trigger session_capacity_promote after update of capacity on public.class_sessions
  for each row execute function private.promote_on_capacity();

-- Aviso por correo a quien recibió un cupo. Igual que claim_reminders: marca y devuelve en la
-- misma operación (dos ejecuciones nunca envían el mismo correo) y excluye a los socios de demo.
create function private.claim_waitlist_notices(p_preview boolean default false)
returns table(
  entry_id uuid, reservation_id uuid, code text, member_name text, member_email text,
  class_name text, starts_at timestamptz, duration_minutes integer, room text, address text
)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with due as (
    select w.id
    from public.waitlist w
    join public.reservations r on r.id = w.reservation_id
    join public.class_sessions s on s.id = r.session_id
    where w.status = 'promoted' and w.notified_at is null
      and r.status = 'confirmed' and s.starts_at > now()
      and w.user_id::text not like '60000000-0000-4000-8000-%'
      and w.member_email not like '%.invalid'
    order by s.starts_at
    limit 200
    for update of w skip locked
  ),
  marked as (
    update public.waitlist w set notified_at = now()
    from due where w.id = due.id and not p_preview
    returning w.id
  )
  select w.id, r.id, r.code, w.member_name, w.member_email, c.name, s.starts_at, s.duration_minutes, s.room, l.address
  from due
  join public.waitlist w on w.id = due.id
  join public.reservations r on r.id = w.reservation_id
  join public.class_sessions s on s.id = r.session_id
  join public.classes c on c.id = s.class_id
  join public.locations l on l.id = s.location_id
  where p_preview or due.id in (select id from marked)
  order by s.starts_at;
end $$;
create function private.release_waitlist_notice(p_entry_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.waitlist set notified_at = null where id = p_entry_id;
$$;

revoke all on function private.join_waitlist(uuid, text, text), private.leave_waitlist(uuid),
  private.my_waitlist() from public, anon;
grant execute on function private.join_waitlist(uuid, text, text), private.leave_waitlist(uuid),
  private.my_waitlist() to authenticated;
revoke all on function private.claim_waitlist_notices(boolean), private.release_waitlist_notice(uuid)
  from public, anon, authenticated;
grant execute on function private.claim_waitlist_notices(boolean), private.release_waitlist_notice(uuid)
  to service_role;

-- Fachadas públicas SECURITY INVOKER, como el resto de RPC.
create function public.join_waitlist(p_session_id uuid, p_member_name text, p_email text) returns uuid
language sql security invoker set search_path = '' as $$ select private.join_waitlist(p_session_id, p_member_name, p_email); $$;
create function public.leave_waitlist(p_entry_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.leave_waitlist(p_entry_id); $$;
create function public.my_waitlist()
returns table(id uuid, session_id uuid, name text, instructor text, room text,
  starts_at timestamptz, duration_minutes integer, queue_position integer, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.my_waitlist(); $$;
revoke all on function public.join_waitlist(uuid, text, text), public.leave_waitlist(uuid),
  public.my_waitlist() from public, anon;
grant execute on function public.join_waitlist(uuid, text, text), public.leave_waitlist(uuid),
  public.my_waitlist() to authenticated;

create function public.claim_waitlist_notices(p_preview boolean default false)
returns table(
  entry_id uuid, reservation_id uuid, code text, member_name text, member_email text,
  class_name text, starts_at timestamptz, duration_minutes integer, room text, address text
)
language sql security invoker set search_path = '' as $$ select * from private.claim_waitlist_notices(p_preview); $$;
create function public.release_waitlist_notice(p_entry_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.release_waitlist_notice(p_entry_id); $$;
revoke all on function public.claim_waitlist_notices(boolean), public.release_waitlist_notice(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_waitlist_notices(boolean), public.release_waitlist_notice(uuid)
  to service_role;
