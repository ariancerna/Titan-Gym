-- Código de reserva corto (va en el QR y se puede dictar) y registro de asistencia por escaneo.

-- 6 caracteres sin ambigüedades (sin 0/O ni 1/I): 32^6 ≈ mil millones de combinaciones.
create function private.new_reservation_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw bytea;
  candidate text;
begin
  loop
    -- Los primeros bytes de un UUID v4 son aleatorios; 256 es múltiplo de 32, así que no hay sesgo.
    raw := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    candidate := 'TG-';
    for i in 0..5 loop
      candidate := candidate || substr(alphabet, get_byte(raw, i) % 32 + 1, 1);
    end loop;
    exit when not exists(select 1 from public.reservations where code = candidate);
  end loop;
  return candidate;
end $$;
revoke all on function private.new_reservation_code() from public, anon, authenticated;

alter table public.reservations alter column code set default private.new_reservation_code();
-- Las reservas anteriores pasan al formato corto; el código largo no se usaba fuera del comprobante.
update public.reservations set code = private.new_reservation_code() where code ~ '^TG-[A-F0-9]{32}$';
alter table public.reservations add constraint reservations_code_format
  check (code ~ '^TG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$');

-- Recepción: el administrador escanea el QR (o escribe el código) y queda la asistencia "presente".
-- Se acepta desde 1 hora antes del inicio hasta el final de la sesión; fuera de ese rango se usa
-- la lista de inscritos. Comparte la auditoría de admin_set_attendance.
create function private.admin_check_in(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.reservations;
  s public.class_sessions;
  class_name text;
  previous text;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  select * into r from public.reservations where code = upper(trim(p_code)) for update;
  if not found then raise exception 'CODE_NOT_FOUND'; end if;
  if r.status = 'cancelled' then raise exception 'RESERVATION_CANCELLED'; end if;
  select * into s from public.class_sessions where id = r.session_id;
  select name into class_name from public.classes where id = s.class_id;
  if now() < s.starts_at - interval '1 hour' then raise exception 'CHECKIN_TOO_EARLY'; end if;
  if now() > s.starts_at + make_interval(mins => s.duration_minutes) then raise exception 'CHECKIN_CLOSED'; end if;
  select status into previous from public.attendance where reservation_id = r.id;
  if previous is distinct from 'present' then
    insert into public.attendance(reservation_id, status, recorded_by)
      values (r.id, 'present', auth.uid())
      on conflict (reservation_id) do update
      set status = excluded.status, recorded_by = excluded.recorded_by, updated_at = now();
    insert into private.attendance_history(reservation_id, previous_status, status, recorded_by)
      values (r.id, previous, 'present', auth.uid());
  end if;
  return jsonb_build_object(
    'reservation_id', r.id, 'code', r.code, 'member_name', r.member_name,
    'class_name', class_name, 'starts_at', s.starts_at, 'room', s.room,
    'already_present', coalesce(previous = 'present', false));
end $$;
revoke all on function private.admin_check_in(text) from public, anon;
grant execute on function private.admin_check_in(text) to authenticated;
create function public.admin_check_in(p_code text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.admin_check_in(p_code); $$;
revoke all on function public.admin_check_in(text) from public, anon;
grant execute on function public.admin_check_in(text) to authenticated;
