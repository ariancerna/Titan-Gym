-- Modelo de no-show (APF3) en "Ver inscritos": además de los datos de la regla anterior, el panel
-- necesita saber si el socio recibió (o recibirá) el recordatorio por correo, una de las variables del
-- modelo entrenado (ml/APF3_TD_Grupo6_ML_Innovacion.ipynb, exportado a
-- src/features/admin/noshow-model.json). Se agregan dos campos; el resto queda igual que en
-- 20261025000000_riesgo_noshow.sql. Si esta migración no está aplicada, el panel imputa el dato con
-- el mismo valor que usó el pipeline de entrenamiento.

create or replace function private.admin_roster(p_session_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(x order by member_name),'[]') from (
    select r.id,r.code,r.member_name,r.member_email,r.status,
      coalesce(a.status,'pending') attendance_status,a.updated_at attendance_updated_at,
      r.created_at booked_at,
      (select count(*)::integer from public.reservations p join public.class_sessions ps on ps.id=p.session_id
        where p.user_id=r.user_id and ps.starts_at<s.starts_at) prior_reservations,
      (select count(*)::integer from public.reservations p join public.class_sessions ps on ps.id=p.session_id
        join public.attendance pa on pa.reservation_id=p.id
        where p.user_id=r.user_id and ps.starts_at<s.starts_at and pa.status='absent') prior_absences,
      r.reminder_sent_at,
      coalesce((select mp.email_reminders from public.member_preferences mp where mp.user_id=r.user_id), true) email_reminders,
      (select coalesce(jsonb_agg(jsonb_build_object('status',h.status,'previous_status',h.previous_status,
        'recorded_by',h.recorded_by,'recorded_by_email',(select u.email from auth.users u where u.id=h.recorded_by),'created_at',h.created_at) order by h.created_at desc),'[]')
        from private.attendance_history h where h.reservation_id=r.id) history
    from public.reservations r
    join public.class_sessions s on s.id=r.session_id
    left join public.attendance a on a.reservation_id=r.id
    where r.session_id=p_session_id
  ) x);
end $$;
