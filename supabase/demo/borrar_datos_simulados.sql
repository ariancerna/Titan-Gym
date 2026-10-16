-- Borra todo lo creado por datos_simulados_exposicion.sql (sesiones con id 'de000000-…').
-- Atención: también borra las reservas que personas reales hayan hecho en esas sesiones.
-- No toca las clases, los socios, el seed original ni las sesiones creadas desde el panel.

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

commit;

select count(*) as sesiones_simuladas_restantes
from public.class_sessions where id::text like 'de000000-%';
