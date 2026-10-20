-- Hallazgo Q3: el panel cargaba todas las sesiones históricas en cada consulta. Ahora trae las
-- futuras y solo las de los últimos 90 días; el historial completo sigue en admin_dataset
-- (pestaña Indicadores y exportación). Parte de la versión de 20261023000000_panel_admin.sql.

create or replace function private.admin_snapshot() returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  return jsonb_build_object(
    'disciplines',(select coalesce(jsonb_agg(d order by name),'[]') from public.disciplines d),
    'locations',(select coalesce(jsonb_agg(l order by name),'[]') from public.locations l),
    'instructors',(select coalesce(jsonb_agg(i order by name),'[]') from public.instructors i),
    'classes',(select coalesce(jsonb_agg(c order by name),'[]') from public.classes c),
    'sessions',(select coalesce(jsonb_agg(x order by starts_at desc),'[]') from (
      select s.*,c.name,i.name instructor,l.name location,
        (select count(*)::integer from public.reservations r where r.session_id=s.id and r.status in ('confirmed','attended')) reserved,
        (select count(*)::integer from public.waitlist w where w.session_id=s.id and w.status='waiting') waiting,
        (select count(*)::integer from public.attendance a join public.reservations r2 on r2.id=a.reservation_id
          where r2.session_id=s.id and a.status='present') present
      from public.class_sessions s join public.classes c on c.id=s.class_id
      join public.instructors i on i.id=s.instructor_id join public.locations l on l.id=s.location_id
      where s.starts_at >= now() - interval '90 days'
    ) x));
end $$;
