-- Roles asignados exclusivamente desde el servidor/editor SQL. Sin auto-promoción.
-- Versión alineada con el registro de migraciones del Supabase alojado.
create table private.administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.administrators enable row level security;
revoke all on private.administrators from public, anon, authenticated;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.administrators a join auth.users u on u.id=a.user_id
    where a.user_id=(select auth.uid()) and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false));
$$;
revoke all on function private.is_admin() from public,anon;
grant execute on function private.is_admin() to authenticated;
create function public.is_admin() returns boolean language sql stable security invoker set search_path = ''
as $$ select private.is_admin(); $$;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;

create table public.attendance (
  reservation_id uuid primary key references public.reservations(id),
  status text not null check(status in ('pending','present','absent')),
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index attendance_actor on public.attendance(recorded_by);
alter table public.attendance enable row level security;
revoke all on public.attendance from public,anon,authenticated;
grant select on public.attendance to authenticated;
create policy attendance_admin on public.attendance for select to authenticated
using ((select private.is_admin()));

create table private.attendance_history (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id),
  previous_status text check(previous_status in ('pending','present','absent')),
  status text not null check(status in ('pending','present','absent')),
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index attendance_history_reservation on private.attendance_history(reservation_id,created_at);
create index attendance_history_actor on private.attendance_history(recorded_by);
alter table private.attendance_history enable row level security;
revoke all on private.attendance_history from public,anon,authenticated;

create function private.admin_snapshot() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  return jsonb_build_object(
    'disciplines',(select coalesce(jsonb_agg(d order by name),'[]') from public.disciplines d),
    'locations',(select coalesce(jsonb_agg(l order by name),'[]') from public.locations l),
    'instructors',(select coalesce(jsonb_agg(i order by name),'[]') from public.instructors i),
    'classes',(select coalesce(jsonb_agg(c order by name),'[]') from public.classes c),
    'sessions',(select coalesce(jsonb_agg(x order by starts_at desc),'[]') from (
      select s.*,c.name,i.name instructor,l.name location,
        (select count(*)::integer from public.reservations r where r.session_id=s.id and r.status in ('confirmed','attended')) reserved
      from public.class_sessions s join public.classes c on c.id=s.class_id
      join public.instructors i on i.id=s.instructor_id join public.locations l on l.id=s.location_id
    ) x));
end $$;

create function private.admin_roster(p_session_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(x order by member_name),'[]') from (
    select r.id,r.code,r.member_name,r.member_email,r.status,
      coalesce(a.status,'pending') attendance_status,a.updated_at attendance_updated_at,
      (select coalesce(jsonb_agg(jsonb_build_object('status',h.status,'previous_status',h.previous_status,
        'recorded_by',h.recorded_by,'created_at',h.created_at) order by h.created_at desc),'[]')
        from private.attendance_history h where h.reservation_id=r.id) history
    from public.reservations r left join public.attendance a on a.reservation_id=r.id where r.session_id=p_session_id
  ) x);
end $$;

create function private.admin_save_class(p_data jsonb,p_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_data is null or length(trim(p_data->>'name')) not between 3 and 100
    or length(trim(p_data->>'description')) not between 10 and 3000
    or p_data->>'name' is null or p_data->>'description' is null then raise exception 'INVALID_CLASS'; end if;
  if p_data->>'image_url' is null or p_data->>'image_url' !~ '^/assets/[a-zA-Z0-9/_ .-]+\.(png|jpg|jpeg|webp)$' then
    raise exception 'INVALID_IMAGE'; end if;
  if p_id is null then
    insert into public.classes(name,description,discipline_id,image_url)
    values(trim(p_data->>'name'),trim(p_data->>'description'),(p_data->>'discipline_id')::uuid,p_data->>'image_url') returning id into result;
  else
    update public.classes set name=trim(p_data->>'name'),description=trim(p_data->>'description'),
      discipline_id=(p_data->>'discipline_id')::uuid,image_url=p_data->>'image_url' where id=p_id returning id into result;
    if result is null then raise exception 'CLASS_NOT_FOUND'; end if;
  end if;
  return result;
end $$;

create function private.admin_save_session(p_data jsonb,p_id uuid default null) returns uuid
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

create function private.admin_set_attendance(p_reservation_id uuid,p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; starts timestamptz; previous text;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_status is null or p_status not in ('pending','present','absent') then raise exception 'INVALID_ATTENDANCE'; end if;
  select * into r from public.reservations where id=p_reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if r.status='cancelled' then raise exception 'RESERVATION_CANCELLED'; end if;
  select starts_at into starts from public.class_sessions where id=r.session_id;
  if starts>now() then raise exception 'ATTENDANCE_TOO_EARLY'; end if;
  select status into previous from public.attendance where reservation_id=r.id;
  if previous is not distinct from p_status then return; end if;
  insert into public.attendance(reservation_id,status,recorded_by)
    values(r.id,p_status,auth.uid()) on conflict(reservation_id) do update
    set status=excluded.status,recorded_by=excluded.recorded_by,updated_at=now();
  insert into private.attendance_history(reservation_id,previous_status,status,recorded_by)
    values(r.id,previous,p_status,auth.uid());
end $$;

-- Fachadas invoker; las operaciones internas verifican el rol en cada solicitud.
create function public.admin_snapshot() returns jsonb language sql security invoker set search_path='' as $$ select private.admin_snapshot(); $$;
create function public.admin_roster(p_session_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_roster(p_session_id); $$;
create function public.admin_save_class(p_data jsonb,p_id uuid default null) returns uuid language sql security invoker set search_path='' as $$ select private.admin_save_class(p_data,p_id); $$;
create function public.admin_save_session(p_data jsonb,p_id uuid default null) returns uuid language sql security invoker set search_path='' as $$ select private.admin_save_session(p_data,p_id); $$;
create function public.admin_set_attendance(p_reservation_id uuid,p_status text) returns void language sql security invoker set search_path='' as $$ select private.admin_set_attendance(p_reservation_id,p_status); $$;
revoke all on function private.admin_snapshot(),private.admin_roster(uuid),private.admin_save_class(jsonb,uuid),private.admin_save_session(jsonb,uuid),private.admin_set_attendance(uuid,text),public.admin_snapshot(),public.admin_roster(uuid),public.admin_save_class(jsonb,uuid),public.admin_save_session(jsonb,uuid),public.admin_set_attendance(uuid,text) from public,anon;
grant execute on function private.admin_snapshot(),private.admin_roster(uuid),private.admin_save_class(jsonb,uuid),private.admin_save_session(jsonb,uuid),private.admin_set_attendance(uuid,text),public.admin_snapshot(),public.admin_roster(uuid),public.admin_save_class(jsonb,uuid),public.admin_save_session(jsonb,uuid),public.admin_set_attendance(uuid,text) to authenticated;
