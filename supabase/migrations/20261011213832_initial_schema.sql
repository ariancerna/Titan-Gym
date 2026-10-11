-- FitSmart Agenda: catálogo público, identidad verificada y reservas atómicas.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table public.disciplines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, address text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  name text not null, bio text not null default '', image_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  discipline_id uuid not null references public.disciplines(id),
  name text not null unique, description text not null, image_url text, featured_image_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id),
  instructor_id uuid not null references public.instructors(id),
  location_id uuid not null references public.locations(id),
  room text not null, starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 10 and 240),
  capacity integer not null check (capacity between 1 and 500),
  published boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(location_id, room, starts_at)
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('TG-' || upper(replace(gen_random_uuid()::text, '-', ''))),
  session_id uuid not null references public.class_sessions(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  member_name text not null check (length(trim(member_name)) between 3 and 100),
  member_email text not null check (length(member_email) <= 254 and member_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'attended')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index reservations_one_active on public.reservations(session_id,user_id) where status in ('confirmed','attended');
create index reservations_owner on public.reservations(user_id, created_at desc);
create index reservations_active_session on public.reservations(session_id) where status in ('confirmed','attended');
create index sessions_start on public.class_sessions(starts_at) where published;
create index sessions_class on public.class_sessions(class_id);
create index sessions_instructor on public.class_sessions(instructor_id);
create index sessions_location on public.class_sessions(location_id);
create index classes_discipline on public.classes(discipline_id);

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['disciplines','locations','instructors','classes','class_sessions','reservations'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
  end loop;
end $$;
grant select on public.disciplines,public.locations,public.instructors,public.classes,public.class_sessions to anon,authenticated;
grant select on public.reservations to authenticated;
create policy disciplines_read on public.disciplines for select to anon,authenticated using (true);
create policy locations_read on public.locations for select to anon,authenticated using (true);
create policy instructors_read on public.instructors for select to anon,authenticated using (true);
create policy classes_read on public.classes for select to anon,authenticated using (true);
create policy sessions_read on public.class_sessions for select to anon,authenticated using (published);
create policy reservations_owner on public.reservations for select to authenticated using ((select auth.uid()) = user_id);

-- Defensa también frente a escrituras administrativas/importaciones.
create function private.guard_reservation() returns trigger language plpgsql set search_path = '' as $$
declare max_capacity integer; occupied integer;
begin
  if tg_op = 'UPDATE' and (new.session_id <> old.session_id or new.user_id <> old.user_id) then
    raise exception 'RESERVATION_IMMUTABLE';
  end if;
  if new.status in ('confirmed','attended') then
    select capacity into max_capacity from public.class_sessions where id = new.session_id for update;
    select count(*) into occupied from public.reservations where session_id = new.session_id
      and status in ('confirmed','attended') and id <> new.id;
    if occupied >= max_capacity then raise exception 'SESSION_FULL'; end if;
  end if;
  return new;
end $$;
create trigger reservation_capacity before insert or update on public.reservations for each row execute function private.guard_reservation();
create function private.guard_capacity() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.capacity < (select count(*) from public.reservations where session_id=new.id and status in ('confirmed','attended')) then
    raise exception 'CAPACITY_BELOW_RESERVATIONS';
  end if;
  return new;
end $$;
create trigger session_capacity before update of capacity on public.class_sessions for each row execute function private.guard_capacity();

-- Privilegio elevado restringido a una función interna: no hay INSERT público.
create function private.reserve_session(p_session_id uuid, p_member_name text, p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.class_sessions; owner_id uuid; verified_email text; result_id uuid;
begin
  owner_id := auth.uid();
  select lower(email) into verified_email from auth.users
    where id=owner_id and email_confirmed_at is not null and not coalesce(is_anonymous,false);
  if owner_id is null or verified_email is null then raise exception 'AUTH_REQUIRED'; end if;
  if lower(trim(p_email)) is distinct from verified_email then raise exception 'EMAIL_MISMATCH'; end if;
  if p_member_name is null or length(trim(p_member_name)) not between 3 and 100
    or trim(p_member_name) !~ '[[:space:]]' then raise exception 'INVALID_MEMBER'; end if;
  select * into s from public.class_sessions where id=p_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  if not s.published or s.starts_at <= now() then raise exception 'SESSION_CLOSED'; end if;
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
revoke all on function private.reserve_session(uuid,text,text) from public,anon;
grant execute on function private.reserve_session(uuid,text,text) to authenticated;
create function public.reserve_session(p_session_id uuid, p_member_name text, p_email text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.reserve_session(p_session_id,p_member_name,p_email);
$$;
revoke all on function public.reserve_session(uuid,text,text) from public,anon;
grant execute on function public.reserve_session(uuid,text,text) to authenticated;

-- Solo datos de catálogo + conteo, jamás identidad de otros socios.
create function private.list_sessions(p_session_id uuid default null)
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
where s.published and (p_session_id is not null or s.starts_at > now()) and (p_session_id is null or s.id=p_session_id)
order by s.starts_at;
$$;
revoke all on function private.list_sessions(uuid) from public;
grant execute on function private.list_sessions(uuid) to anon,authenticated;
create function public.list_sessions(p_session_id uuid default null)
returns table(id uuid,class_id uuid,name text,description text,discipline text,image_url text,featured_image_url text,
 instructor text,instructor_bio text,instructor_image text,location text,address text,room text,
 starts_at timestamptz,duration_minutes integer,capacity integer,reserved integer,available integer)
language sql stable security invoker set search_path = '' as $$ select * from private.list_sessions(p_session_id); $$;
revoke all on function public.list_sessions(uuid) from public;
grant execute on function public.list_sessions(uuid) to anon,authenticated;
revoke all on function private.touch_updated_at(),private.guard_reservation(),private.guard_capacity() from public,anon,authenticated;
