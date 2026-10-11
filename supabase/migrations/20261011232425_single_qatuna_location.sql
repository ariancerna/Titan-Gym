-- Corrección solicitada: una única sede, según la referencia image.png del propietario.
-- Versión local alineada con la migración alojada.
-- Se conservan las sesiones, UUID de reservas, aforo y alumnos inscritos.
update public.locations set name='TITAN GYM QATUNA',address='Isabel Chimpu Ocllo cdra 10, Carabayllo 15318'
where id='20000000-0000-4000-8000-000000000001';
update public.class_sessions set location_id='20000000-0000-4000-8000-000000000001'
where location_id in ('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003');
delete from public.locations
where (id='20000000-0000-4000-8000-000000000002' and name='Sede Norte')
   or (id='20000000-0000-4000-8000-000000000003' and name='Sede Financiera');
