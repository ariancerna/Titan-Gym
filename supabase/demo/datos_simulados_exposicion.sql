-- DATOS SIMULADOS PARA LA EXPOSICIÓN. No son datos reales de TITAN GYM.
-- No es una migración: se ejecuta a mano en Supabase → SQL Editor y se borra con
-- supabase/demo/borrar_datos_simulados.sql.
--
-- Crea un horario semanal desde el 21/09/2026 hasta el 31/12/2026:
--   · sesiones ya pasadas con reservas, cancelaciones y asistencia (presente/ausente);
--   · sesiones futuras con reservas (algunas llenas).
-- Las reservas usan los 30 socios de demostración del seed (id '60000000-…'). Antes de crear
-- las sesiones, el script les da nombres peruanos y correos que son subdirecciones del Gmail
-- del administrador (admin+nombre.apellido@gmail.com): se ven reales, pero cualquier correo
-- que se envíe por error llega al administrador y nunca a una persona desconocida.
-- Las sesiones simuladas tienen id 'de000000-…' para poder identificarlas y borrarlas.
--
-- Las inasistencias siguen patrones (madrugada, lunes, socios con faltas frecuentes,
-- reservas hechas con mucha anticipación) para que el modelo de ML tenga algo que aprender.
-- Requiere un administrador asignado: la asistencia queda registrada a su nombre.

do $$
declare
  admin_id uuid;
  admin_email text;
  mail_user text;
  mail_domain text;
  member_names constant text[] := array[
    'María Fernanda Quispe', 'Luis Alberto Huamán', 'Carmen Rosa Flores', 'José Antonio Mamani',
    'Ana Lucía Torres', 'Jorge Luis Castillo', 'Rosa Elena Vargas', 'Carlos Eduardo Ramírez',
    'Patricia Salazar', 'Miguel Ángel Chávez', 'Lucía Paredes', 'Diego Alonso Sánchez',
    'Valeria Gutiérrez', 'Renzo Díaz', 'Daniela Espinoza', 'Kevin Alvarado',
    'Milagros Ccori', 'Jhonatan Medina', 'Fiorella Navarro', 'Christian Aguilar',
    'Andrea Herrera', 'Bryan Cárdenas', 'Katherine Ríos', 'Junior Romero',
    'Gianella Cruz', 'Piero García', 'Mariela Silva', 'Franco Loayza',
    'Sandra Huanca', 'Erick Palomino'];
  full_name text;
  name_parts text[];
  demo_members int;
  d date;
  slot record;
  session_id uuid;
  n int := 0;
  starts timestamptz;
  target int;
  member record;
  booked_at timestamptz;
  cancelled boolean;
  reservation_id uuid;
  absent_probability numeric;
  attendance_status text;
  sessions_created int := 0;
  reservations_created int := 0;
  attendance_created int := 0;
begin
  select user_id into admin_id from private.administrators order by created_at limit 1;
  if admin_id is null then
    raise exception 'Asigna primero un administrador (docs/ADMINISTRACION.md).';
  end if;
  if exists(select 1 from public.class_sessions where id::text like 'de000000-%') then
    raise exception 'Los datos simulados ya existen. Ejecuta primero borrar_datos_simulados.sql.';
  end if;
  select count(*) into demo_members from auth.users where id::text like '60000000-0000-4000-8000-%';
  if demo_members < 10 then
    raise exception 'Faltan los socios de demostración del seed (id 60000000-…). Hay %.', demo_members;
  end if;

  -- Identidades realistas: subdirecciones del correo del administrador.
  select email into admin_email from auth.users where id = admin_id;
  mail_user := split_part(split_part(admin_email, '@', 1), '+', 1);
  mail_domain := split_part(admin_email, '@', 2);
  for member in
    select id, right(id::text, 12)::int as member_no
    from auth.users where id::text like '60000000-0000-4000-8000-%'
  loop
    full_name := member_names[(member.member_no - 1) % array_length(member_names, 1) + 1];
    name_parts := string_to_array(full_name, ' ');
    update auth.users
    set email = mail_user || '+' ||
          translate(lower(name_parts[1] || '.' || name_parts[array_length(name_parts, 1)]), 'áéíóúñü', 'aeiounu')
          || '@' || mail_domain,
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', full_name)
    where id = member.id;
    -- Las reservas del seed de estos socios también pasan a su nombre nuevo.
    update public.reservations r
    set member_name = full_name, member_email = (select email from auth.users where id = member.id)
    where r.user_id = member.id;
  end loop;

  perform setseed(0.2026); -- mismos resultados cada vez que se ejecuta

  for d in select generate_series(date '2026-09-21', date '2026-12-31', interval '1 day')::date loop
    for slot in
      select * from (values
        -- isodow, hora, clase, instructor, sala, duración, capacidad
        (1, time '07:00', '40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'Sala Funcional',    60, 18),
        (1, time '18:00', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Sala de Ciclismo',  50, 25),
        (1, time '19:30', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'Sala HIIT',         45, 20),
        (2, time '08:30', '40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 'Sala de Baile',     60, 30),
        (2, time '17:30', '40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005', 'Sala de Yoga',      60, 15),
        (2, time '19:00', '40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000006', 'Sala de Circuitos', 60, 16),
        (3, time '07:00', '40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'Sala Funcional',    60, 18),
        (3, time '18:00', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Sala de Ciclismo',  50, 25),
        (3, time '19:30', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'Sala HIIT',         45, 20),
        (4, time '08:30', '40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 'Sala de Baile',     60, 30),
        (4, time '17:30', '40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005', 'Sala de Yoga',      60, 15),
        (4, time '19:00', '40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000006', 'Sala de Circuitos', 60, 16),
        (5, time '07:00', '40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'Sala Funcional',    60, 18),
        (5, time '18:00', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Sala de Ciclismo',  50, 25),
        (6, time '09:00', '40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 'Sala de Baile',     60, 30),
        (6, time '10:30', '40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000006', 'Sala de Circuitos', 60, 16)
      ) as t(dow, starts_time, class_id, instructor_id, room, duration, capacity)
      where t.dow = extract(isodow from d)
    loop
      n := n + 1;
      session_id := ('de000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid;
      starts := (d + slot.starts_time) at time zone 'America/Lima';
      insert into public.class_sessions(id, class_id, instructor_id, location_id, room, starts_at, duration_minutes, capacity)
      values (session_id, slot.class_id::uuid, slot.instructor_id::uuid,
        '20000000-0000-4000-8000-000000000001', slot.room, starts, slot.duration, slot.capacity)
      on conflict do nothing;
      if not found then continue; end if; -- ya había una sesión en esa sala y hora
      sessions_created := sessions_created + 1;

      -- Ocupación entre 35 % y 85 %; 1 de cada 12 sesiones se llena.
      target := case when random() < 0.08 then slot.capacity
                     else greatest(2, round(slot.capacity * (0.35 + random() * 0.5))::int) end;
      target := least(target, demo_members);

      for member in
        select id, email, raw_user_meta_data ->> 'full_name' as full_name,
          right(id::text, 12)::int as member_no
        from auth.users where id::text like '60000000-0000-4000-8000-%'
        order by random() limit target
      loop
        booked_at := starts - make_interval(hours => 2 + floor(random() * 118)::int);
        cancelled := starts < now() and random() < 0.07;
        insert into public.reservations(session_id, user_id, member_name, member_email, status, cancelled_at, created_at, updated_at)
        values (session_id, member.id, member.full_name, member.email,
          case when cancelled then 'cancelled' else 'confirmed' end,
          case when cancelled then booked_at + (starts - booked_at) * random() end,
          booked_at, booked_at)
        returning id into reservation_id;
        reservations_created := reservations_created + 1;

        if starts < now() and not cancelled then
          absent_probability := 0.10
            + case when slot.starts_time < time '08:00' then 0.12 else 0 end
            + case when slot.dow = 1 then 0.05 else 0 end
            + case when member.member_no <= 5 then 0.25 else 0 end
            + case when starts - booked_at > interval '72 hours' then 0.08 else 0 end;
          attendance_status := case when random() < absent_probability then 'absent' else 'present' end;
          insert into public.attendance(reservation_id, status, recorded_by, created_at, updated_at)
          values (reservation_id, attendance_status, admin_id, starts + interval '10 minutes', starts + interval '10 minutes');
          insert into private.attendance_history(reservation_id, previous_status, status, recorded_by, created_at)
          values (reservation_id, null, attendance_status, admin_id, starts + interval '10 minutes');
          attendance_created := attendance_created + 1;
        end if;
      end loop;
    end loop;
  end loop;

  raise notice 'Datos simulados creados: % sesiones, % reservas, % asistencias registradas.',
    sessions_created, reservations_created, attendance_created;
end $$;
