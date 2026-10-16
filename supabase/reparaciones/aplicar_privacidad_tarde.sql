-- REPARACIÓN: la migración 20261017 (privacidad) no se aplicó antes que la 20261019 (ventana de 7 días).
-- Ejecuta este archivo COMPLETO una sola vez en Supabase → SQL Editor.
-- 1) Aplica 20261017. 2) Restaura la función de reservar de 20261019, que 20261017 reemplazaría
--    por una versión sin la regla de 7 días. 3) Registra 20261017 en el historial.

-- ===== 1) 20261017_privacy_consent.sql =====
-- Ley N.° 29733: consentimiento informado antes de tratar datos personales.
-- Se guarda qué versión de la política aceptó cada socio y cuándo (hora del servidor).

create table public.privacy_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null check (policy_version ~ '^\d{4}-\d{2}-\d{2}$'),
  accepted_at timestamptz not null default now(),
  source text not null check (source in ('signup', 'reservation')),
  primary key (user_id, policy_version)
);
alter table public.privacy_consents enable row level security;
revoke all on public.privacy_consents from public, anon, authenticated;
grant select on public.privacy_consents to authenticated;
create policy privacy_consents_owner on public.privacy_consents for select to authenticated
  using ((select auth.uid()) = user_id);

-- Versión vigente: debe coincidir con privacyPolicyVersion en src/content/privacy.ts.
create function private.current_privacy_version() returns text
language sql immutable set search_path = '' as $$ select '2026-10-16'::text $$;
grant execute on function private.current_privacy_version() to anon, authenticated;

-- Alta con "Crear cuenta": la casilla viaja en los metadatos y se registra al crear el usuario,
-- antes incluso de confirmar el correo. La fecha la pone la base de datos, no el navegador.
create function private.record_signup_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_user_meta_data ->> 'privacy_version' = private.current_privacy_version() then
    insert into public.privacy_consents(user_id, policy_version, source)
    values (new.id, private.current_privacy_version(), 'signup')
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function private.record_signup_consent() from public, anon, authenticated;
create trigger record_signup_consent after insert on auth.users
  for each row execute function private.record_signup_consent();

-- Socios que entraron con Google o con enlace: aceptan desde el formulario de reserva.
create function private.accept_privacy_policy(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_version is distinct from private.current_privacy_version() then
    raise exception 'PRIVACY_VERSION_OUTDATED';
  end if;
  insert into public.privacy_consents(user_id, policy_version, source)
  values (auth.uid(), p_version, 'reservation')
  on conflict do nothing;
end $$;
revoke all on function private.accept_privacy_policy(text) from public, anon;
grant execute on function private.accept_privacy_policy(text) to authenticated;
create function public.accept_privacy_policy(p_version text) returns void
language sql security invoker set search_path = '' as $$ select private.accept_privacy_policy(p_version); $$;
revoke all on function public.accept_privacy_policy(text) from public, anon;
grant execute on function public.accept_privacy_policy(text) to authenticated;

-- La reserva guarda nombre y correo: sin consentimiento vigente no se registra.
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

-- ===== 2) Función de reservar vigente (de 20261019_ventana_reservas.sql) =====
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

-- ===== 3) Historial de migraciones =====
insert into supabase_migrations.schema_migrations(version, name)
values ('20261017000000', 'privacy_consent')
on conflict (version) do nothing;
