-- Datos académicos. Aplicar solamente en una base de demostración vacía.
-- Las sesiones se programan con relación al día de ejecución, zona America/Lima.
insert into public.disciplines(id,name) values
('10000000-0000-4000-8000-000000000001','Spinning'),('10000000-0000-4000-8000-000000000002','HIIT'),
('10000000-0000-4000-8000-000000000003','Funcional'),('10000000-0000-4000-8000-000000000004','Zumba'),
('10000000-0000-4000-8000-000000000005','Yoga'),('10000000-0000-4000-8000-000000000006','Cross Training');
insert into public.locations(id,name,address) values
('20000000-0000-4000-8000-000000000001','TITAN GYM QATUNA','Isabel Chimpu Ocllo cdra 10, Carabayllo 15318');
insert into public.instructors(id,name,bio,image_url) values
('30000000-0000-4000-8000-000000000001','Carlos Mendoza','Especialista en ciclismo indoor y entrenamiento cardiovascular.','/assets/1-758/asset-1.png'),
('30000000-0000-4000-8000-000000000002','Sofía Herrera','Instructora de intervalos de alta intensidad y resistencia metabólica.',null),
('30000000-0000-4000-8000-000000000003','David Ruiz','Instructor de fuerza funcional y movilidad.',null),
('30000000-0000-4000-8000-000000000004','Camila Ortiz','Instructora de baile y acondicionamiento físico.',null),
('30000000-0000-4000-8000-000000000005','Mateo Silva','Instructor de yoga, movilidad y recuperación.',null),
('30000000-0000-4000-8000-000000000006','Lucas Prado','Instructor de circuitos de fuerza y resistencia.',null);
insert into public.classes(id,discipline_id,name,description,image_url) values
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Power Spinning Extreme','Sesión cardiovascular de alta intensidad combinada con intervalos de potencia en bicicleta estática. Diseñada para trabajar la capacidad aeróbica y fortalecer el tren inferior bajo la dirección de tu instructor.','/assets/generated/spinning.jpg'),
('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','HIIT Titan Burn','Intervalos de trabajo y recuperación para mejorar tu resistencia. El instructor adapta los movimientos según tu nivel.','/assets/generated/hiit.jpg'),
('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','Entrenamiento Funcional Élite','Circuito de fuerza, coordinación y movilidad con movimientos que trabajan todo el cuerpo.','/assets/generated/funcional.jpg'),
('40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004','Zumba Energy Party','Entrenamiento de baile con ritmos variados y pasos guiados. Una sesión dinámica para moverte y disfrutar.','/assets/generated/zumba.jpg'),
('40000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005','Power Yoga & Recovery','Práctica guiada de movilidad, respiración y equilibrio. Recupera energía y mejora tu control corporal.','/assets/generated/yoga.jpg'),
('40000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000006','Titan Cross Training','Circuitos que combinan fuerza y resistencia con ejercicios adaptables. Entrena con técnica y progresa a tu ritmo.','/assets/generated/cross-training.jpg');
update public.classes set featured_image_url='/assets/generated/spinning.jpg' where id='40000000-0000-4000-8000-000000000001';
insert into public.class_sessions(id,class_id,instructor_id,location_id,room,starts_at,duration_minutes,capacity)
select ('50000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
('40000000-0000-4000-8000-'||lpad(c::text,12,'0'))::uuid,
('30000000-0000-4000-8000-'||lpad(c::text,12,'0'))::uuid,
('20000000-0000-4000-8000-'||lpad(l::text,12,'0'))::uuid,room,
((now() at time zone 'America/Lima')::date + day_offset + session_time) at time zone 'America/Lima',duration,cap
from (values
 (1,1,1,'Sala de Ciclismo',1,time '18:00',50,25),
 (2,2,1,'Sala HIIT',1,time '19:30',45,20),
 (3,3,1,'Sala Funcional',2,time '07:00',60,18),
 (4,4,1,'Sala de Baile',2,time '08:30',60,30),
 (5,5,1,'Sala de Yoga',2,time '17:30',60,15),
 (6,6,1,'Sala de Circuitos',3,time '19:00',60,16),
 (7,1,1,'Sala de Ciclismo',4,time '18:00',50,25),
 (8,2,1,'Sala HIIT',5,time '09:00',45,20)
) as demo(n,c,l,room,day_offset,session_time,duration,cap);
-- Identidades de demostración sin contraseña, sin tokens y con dominios .invalid.
-- Ocupación real mediante filas en reservations, no contadores ficticios.
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
select ('60000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'socio-demo-'||n||'@titan.invalid',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb
from generate_series(1,30) n;
insert into public.reservations(session_id,user_id,member_name,member_email)
select ('50000000-0000-4000-8000-'||lpad(s::text,12,'0'))::uuid,
('60000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
'Socio Demo '||n,'socio-demo-'||n||'@titan.invalid'
from (values (1,21),(2,11),(3,18),(4,16),(5,13),(6,9)) as counts(s,occupied)
cross join lateral generate_series(1,occupied) n;
