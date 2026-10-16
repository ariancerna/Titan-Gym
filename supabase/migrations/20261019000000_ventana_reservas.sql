-- Regla del gimnasio: las reservas de cada clase se abren 7 días antes de su inicio.
-- El catálogo muestra solo esa ventana; el panel de administración sigue viendo todas las sesiones.

-- Debe coincidir con bookingWindowDays en src/utils/sessions.ts.
create function private.booking_window() returns interval
language sql immutable set search_path = '' as $$ select interval '7 days' $$;
grant execute on function private.booking_window() to anon, authenticated;

-- Catálogo: sesiones publicadas dentro de la ventana. Por id se sigue devolviendo cualquier
-- sesión publicada, para que el detalle explique desde cuándo se puede reservar.
create or replace function private.list_sessions(p_session_id uuid default null)
returns table(id uuid,class_id uuid,name text,description text,discipline text,image_url text,featured_image_url text,
 instructor text,instructor_bio text,instructor_image text,location text,address text,room text,
 starts_at timestamptz,duration_minutes integer,capacity integer,reserved integer,available integer)
language sql stable security definer set search_path = '' as $$
select s.id,c.id,c.name,c.description,d.name,c.image_url,c.featured_image_url,i.name,i.bio,i.image_url,l.name,l.address,s.room,
 s.starts_at,s.duration_minutes,s.capacity,counts.n::integer,(s.capacity-counts.n)::integer
from public.class_sessions s
join public.classes c on c.id=s.class_id join public.disciplines d on d.id=c.discipline_id
join public.instructors i on i.id=s.instructor_id join public.locations l on l.id=s.location_id
cross join lateral (select count(*) n from public.reservations r where r.session_id=s.id and r.status in ('confirmed','attended')) counts
where s.published
  and (p_session_id is not null or (s.starts_at > now() and s.starts_at <= now() + private.booking_window()))
  and (p_session_id is null or s.id=p_session_id)
order by s.starts_at;
$$;

-- La reserva también respeta la ventana, aunque se llegue por un enlace directo.
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
  if not s.published or s.starts_at <= now() then raise exception 'SESSION_CLOSED'; end if;
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
