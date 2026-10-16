-- Borra todo lo creado por datos_simulados_exposicion.sql (sesiones con id 'de000000-…').
-- Atención: también borra las reservas que personas reales hayan hecho en esas sesiones.
-- Devuelve a los socios de demostración su nombre y correo originales (Socio Demo N).
-- No toca las clases, el seed original ni las sesiones creadas desde el panel.

begin;

delete from private.attendance_history
where reservation_id in (
  select r.id from public.reservations r where r.session_id::text like 'de000000-%'
);
delete from public.attendance
where reservation_id in (
  select r.id from public.reservations r where r.session_id::text like 'de000000-%'
);
delete from public.reservations where session_id::text like 'de000000-%';
delete from public.class_sessions where id::text like 'de000000-%';

-- Los socios de demostración recuperan su identidad original del seed.
update auth.users
set email = 'socio-demo-' || right(id::text, 12)::int || '@titan.invalid',
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'full_name'
where id::text like '60000000-0000-4000-8000-%';
update public.reservations
set member_name = 'Socio Demo ' || right(user_id::text, 12)::int,
    member_email = 'socio-demo-' || right(user_id::text, 12)::int || '@titan.invalid'
where user_id::text like '60000000-0000-4000-8000-%';

commit;

select count(*) as sesiones_simuladas_restantes
from public.class_sessions where id::text like 'de000000-%';
