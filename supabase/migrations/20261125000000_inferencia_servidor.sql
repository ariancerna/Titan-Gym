-- PROY · Inferencia del modelo de no-show EN EL SERVIDOR (Supabase), con registro de cada predicción.
--
-- Hasta APF3 la regresión logística se evaluaba en el navegador del administrador. La consigna del Proyecto
-- Final exige que el modelo lo sirva el backend del despliegue y que cada predicción quede registrada con su
-- entrada, salida, probabilidad, versión del modelo y fecha. Aquí:
--   * private.ml_modelos       versiones del modelo exportado por el notebook (coeficientes, escalas, umbrales);
--                              solo una activa. Desactivarla es el interruptor de degradación y de reversión.
--   * private.ml_predicciones  registro de auditoría de cada predicción (sin nombres ni correos).
--   * predecir_noshow()        valida la entrada, calcula la probabilidad y la registra.
--   * admin_roster_riesgo()    predice en el servidor el riesgo de cada inscrito de una sesión («Ver inscritos»).
-- El cálculo reproduce el pipeline de scikit-learn (variables derivadas → imputación → escalado / one-hot →
-- sigmoide); tests/integration/database.mjs comprueba que coincide con scikit-learn en 200 reservas.

create table private.ml_modelos (
  version text primary key,
  modelo text not null,
  definicion jsonb not null,
  activo boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index ml_modelos_una_version_activa on private.ml_modelos ((true)) where activo;

create table private.ml_predicciones (
  id bigint generated always as identity primary key,
  creado_en timestamptz not null default now(),
  version text not null references private.ml_modelos(version),
  origen text not null check (origen in ('panel', 'prueba')),
  reservation_id uuid references public.reservations(id) on delete set null,
  session_id uuid references public.class_sessions(id) on delete set null,
  entrada jsonb not null,
  probabilidad double precision not null check (probabilidad between 0 and 1),
  riesgo text not null check (riesgo in ('bajo', 'medio', 'alto')),
  solicitado_por uuid
);
create index ml_predicciones_por_fecha on private.ml_predicciones (creado_en desc);

-- Validación del contrato de entrada (mismos rangos que las restricciones de la base y que la API FastAPI).
create function private.noshow_validar(p jsonb) returns void language plpgsql immutable set search_path = '' as $$
declare
  k text;
  v numeric;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'ENTRADA_INVALIDA: la entrada debe ser un objeto JSON' using errcode = '22023';
  end if;
  foreach k in array array['disciplina', 'inicio_sesion', 'dia_semana', 'hora_inicio', 'duracion_min', 'capacidad',
                           'reservas_activas', 'anticipacion_horas', 'reservas_previas', 'inasistencias_previas'] loop
    if not p ? k or jsonb_typeof(p -> k) = 'null' then
      raise exception 'ENTRADA_INVALIDA: falta el campo %', k using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(p -> 'disciplina') <> 'string' or length(trim(p ->> 'disciplina')) = 0 then
    raise exception 'ENTRADA_INVALIDA: disciplina debe ser un texto' using errcode = '22023';
  end if;
  begin
    perform (p ->> 'inicio_sesion')::timestamptz;
  exception when others then
    raise exception 'ENTRADA_INVALIDA: inicio_sesion no es una fecha válida' using errcode = '22023';
  end;
  foreach k in array array['dia_semana', 'hora_inicio', 'duracion_min', 'capacidad', 'reservas_activas',
                           'anticipacion_horas', 'reservas_previas', 'inasistencias_previas'] loop
    if jsonb_typeof(p -> k) <> 'number' then
      raise exception 'ENTRADA_INVALIDA: % debe ser un número', k using errcode = '22023';
    end if;
    v := (p ->> k)::numeric;
    if k <> 'anticipacion_horas' and v <> trunc(v) then
      raise exception 'ENTRADA_INVALIDA: % debe ser un número entero', k using errcode = '22023';
    end if;
  end loop;
  if (p ->> 'dia_semana')::numeric not between 1 and 7 then
    raise exception 'ENTRADA_INVALIDA: dia_semana debe estar entre 1 (lunes) y 7 (domingo)' using errcode = '22023';
  end if;
  if (p ->> 'hora_inicio')::numeric not between 0 and 23 then
    raise exception 'ENTRADA_INVALIDA: hora_inicio debe estar entre 0 y 23' using errcode = '22023';
  end if;
  if (p ->> 'duracion_min')::numeric not between 10 and 240 then
    raise exception 'ENTRADA_INVALIDA: duracion_min debe estar entre 10 y 240 minutos' using errcode = '22023';
  end if;
  if (p ->> 'capacidad')::numeric not between 1 and 500 then
    raise exception 'ENTRADA_INVALIDA: capacidad debe estar entre 1 y 500' using errcode = '22023';
  end if;
  if (p ->> 'reservas_activas')::numeric not between 0 and (p ->> 'capacidad')::numeric then
    raise exception 'ENTRADA_INVALIDA: reservas_activas debe estar entre 0 y la capacidad' using errcode = '22023';
  end if;
  if (p ->> 'anticipacion_horas')::numeric <= 0 or (p ->> 'anticipacion_horas')::numeric > 168 then
    raise exception 'ENTRADA_INVALIDA: anticipacion_horas debe ser mayor que 0 y como máximo 168 (7 días)' using errcode = '22023';
  end if;
  if (p ->> 'reservas_previas')::numeric < 0 then
    raise exception 'ENTRADA_INVALIDA: reservas_previas no puede ser negativo' using errcode = '22023';
  end if;
  if (p ->> 'inasistencias_previas')::numeric not between 0 and (p ->> 'reservas_previas')::numeric then
    raise exception 'ENTRADA_INVALIDA: inasistencias_previas debe estar entre 0 y reservas_previas' using errcode = '22023';
  end if;
  if p ? 'recordatorio_enviado' and jsonb_typeof(p -> 'recordatorio_enviado') not in ('boolean', 'null') then
    raise exception 'ENTRADA_INVALIDA: recordatorio_enviado debe ser verdadero, falso o vacío' using errcode = '22023';
  end if;
end $$;

-- Probabilidad de no-show: el mismo pipeline que CaracteristicasNoShow + ColumnTransformer + LogisticRegression.
create function private.noshow_probabilidad(p jsonb, m jsonb) returns double precision
language plpgsql immutable set search_path = '' as $$
declare
  h double precision := (p ->> 'anticipacion_horas')::double precision;
  previas double precision := (p ->> 'reservas_previas')::double precision;
  faltas double precision := (p ->> 'inasistencias_previas')::double precision;
  capacidad double precision := (p ->> 'capacidad')::double precision;
  hora integer := (p ->> 'hora_inicio')::integer;
  mes integer := extract(month from ((p ->> 'inicio_sesion')::timestamptz at time zone 'America/Lima'))::integer;
  prior double precision := (m ->> 'prior_no_show')::double precision;
  k double precision := (m ->> 'k_suavizado')::double precision;
  recordatorio double precision := case jsonb_typeof(p -> 'recordatorio_enviado')
    when 'boolean' then case when (p ->> 'recordatorio_enviado')::boolean then 1 else 0 end end;
  numericas jsonb;
  categoricas jsonb;
  z double precision := (m ->> 'intercepto')::double precision;
  i integer := 0;
  v double precision;
  item jsonb;
  valor text;
  categoria text;
begin
  numericas := jsonb_build_object(
    'log_anticipacion', ln(1 + greatest(h, 0)),
    'reserva_mismo_dia', case when h <= 12 then 1 else 0 end,
    'ocupacion', (p ->> 'reservas_activas')::double precision / capacidad,
    'tasa_inasistencia_suavizada', (faltas + prior * k) / (previas + k),
    'inasistencias_previas', faltas,
    'log_reservas_previas', ln(1 + previas),
    'es_primera_reserva', case when previas = 0 then 1 else 0 end,
    'recordatorio_enviado', recordatorio, -- vacío → se imputa como en el entrenamiento
    'duracion_min', (p ->> 'duracion_min')::double precision,
    'capacidad', capacidad,
    'temprano_x_anticipada', case when hora < 8 and h > 72 then 1 else 0 end
  );
  categoricas := jsonb_build_object(
    'disciplina', p ->> 'disciplina',
    'franja_horaria', case when hora <= 7 then 'temprano' when hora <= 11 then 'manana' when hora <= 17 then 'tarde' else 'noche' end,
    'dia_semana', ((p ->> 'dia_semana')::integer)::text,
    'temporada', case when mes in (1, 2, 3) then 'verano' when mes in (7, 12) then 'fiestas' else 'regular' end
  );
  -- Numéricas: SimpleImputer(median) + StandardScaler, en el orden del modelo exportado.
  for item in select value from jsonb_array_elements(m -> 'numericas') with ordinality order by ordinality loop
    v := (numericas ->> (item ->> 'nombre'))::double precision;
    if v is null then v := (item ->> 'imputacion')::double precision; end if;
    z := z + (v - (item ->> 'media')::double precision) / (item ->> 'escala')::double precision
             * (m -> 'coeficientes' ->> i)::double precision;
    i := i + 1;
  end loop;
  -- Categóricas: OneHotEncoder(handle_unknown="ignore"); una categoría desconocida deja todo en 0.
  for item in select value from jsonb_array_elements(m -> 'categoricas') with ordinality order by ordinality loop
    valor := coalesce(categoricas ->> (item ->> 'nombre'), item ->> 'imputacion');
    for categoria in select value from jsonb_array_elements_text(item -> 'categorias') with ordinality order by ordinality loop
      if categoria = valor then z := z + (m -> 'coeficientes' ->> i)::double precision; end if;
      i := i + 1;
    end loop;
  end loop;
  return 1 / (1 + exp(-z));
end $$;

-- Predice, registra y responde con el contrato de integración. Solo administradores.
create function private.predecir_noshow(p_entrada jsonb, p_origen text, p_reserva uuid, p_sesion uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m private.ml_modelos;
  prob double precision;
  nivel text;
  nuevo_id bigint;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  select * into m from private.ml_modelos where activo;
  if not found then raise exception 'MODELO_NO_DISPONIBLE' using errcode = 'P0001'; end if;
  perform private.noshow_validar(p_entrada);
  prob := private.noshow_probabilidad(p_entrada, m.definicion);
  nivel := case
    when prob >= (m.definicion ->> 'umbral_alto')::double precision then 'alto'
    when prob >= (m.definicion ->> 'umbral_contacto')::double precision then 'medio'
    else 'bajo' end;
  insert into private.ml_predicciones(version, origen, reservation_id, session_id, entrada, probabilidad, riesgo, solicitado_por)
  values (m.version, p_origen, p_reserva, p_sesion, p_entrada, prob, nivel, auth.uid())
  returning id into nuevo_id;
  return jsonb_build_object(
    'prediccion_id', nuevo_id,
    'probabilidad_no_show', round(prob::numeric, 4),
    'riesgo', nivel,
    'umbral_contacto', (m.definicion ->> 'umbral_contacto')::numeric,
    'umbral_alto', (m.definicion ->> 'umbral_alto')::numeric,
    'accion_sugerida', case nivel
      when 'alto' then 'Confirmar asistencia por WhatsApp antes de la clase; si no confirma, liberar el cupo a la lista de espera.'
      when 'medio' then 'Enviar un recordatorio adicional si recepción tiene tiempo.'
      else 'Sin acción adicional.' end,
    'modelo_version', m.version,
    'modelo', m.modelo,
    'fecha', now()
  );
end $$;
revoke all on function private.noshow_validar(jsonb) from public, anon, authenticated;
revoke all on function private.noshow_probabilidad(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.predecir_noshow(jsonb, text, uuid, uuid) from public, anon;
grant execute on function private.predecir_noshow(jsonb, text, uuid, uuid) to authenticated;

-- Prueba manual desde el panel (caso de demostración y de error): registra con origen «prueba».
create function public.predecir_noshow(p_entrada jsonb) returns jsonb language sql security invoker set search_path = '' as $$
  select private.predecir_noshow(p_entrada, 'prueba', null, null);
$$;
revoke all on function public.predecir_noshow(jsonb) from public, anon;
grant execute on function public.predecir_noshow(jsonb) to authenticated;

-- «Ver inscritos»: el servidor arma la entrada de cada reserva activa con los datos que ya guarda y predice.
create function private.admin_roster_riesgo(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  resultado jsonb := '[]';
  fila record;
  entrada jsonb;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from private.ml_modelos where activo) then
    raise exception 'MODELO_NO_DISPONIBLE' using errcode = 'P0001';
  end if;
  for fila in
    select r.id, r.user_id, r.created_at, r.reminder_sent_at, s.starts_at, s.duration_minutes, s.capacity, d.name disciplina,
      (select count(*) from public.reservations x where x.session_id = s.id and x.status in ('confirmed', 'attended')) activas,
      (select count(*) from public.reservations q join public.class_sessions qs on qs.id = q.session_id
        where q.user_id = r.user_id and qs.starts_at < s.starts_at) previas,
      (select count(*) from public.reservations q join public.class_sessions qs on qs.id = q.session_id
        join public.attendance qa on qa.reservation_id = q.id
        where q.user_id = r.user_id and qs.starts_at < s.starts_at and qa.status = 'absent') faltas,
      coalesce((select mp.email_reminders from public.member_preferences mp where mp.user_id = r.user_id), true) avisos
    from public.reservations r
    join public.class_sessions s on s.id = r.session_id
    join public.classes c on c.id = s.class_id
    join public.disciplines d on d.id = c.discipline_id
    where r.session_id = p_session_id and r.status in ('confirmed', 'attended')
  loop
    entrada := jsonb_build_object(
      'disciplina', fila.disciplina,
      'inicio_sesion', to_char(fila.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'dia_semana', extract(isodow from fila.starts_at at time zone 'America/Lima')::integer,
      'hora_inicio', extract(hour from fila.starts_at at time zone 'America/Lima')::integer,
      'duracion_min', fila.duration_minutes,
      'capacidad', fila.capacity,
      'reservas_activas', fila.activas,
      -- La ventana de reservas es de 7 días; reservas anteriores a esa regla se acotan al rango del modelo.
      'anticipacion_horas', round(least(greatest(extract(epoch from fila.starts_at - fila.created_at) / 3600, 0.1), 168)::numeric, 1),
      'reservas_previas', fila.previas,
      'inasistencias_previas', fila.faltas,
      'recordatorio_enviado', case
        when fila.reminder_sent_at is not null then true
        when not fila.avisos then false
        else fila.starts_at - fila.created_at > interval '3 hours' and fila.starts_at - now() > interval '3 hours' end
    );
    resultado := resultado || jsonb_build_array(
      jsonb_build_object('reservation_id', fila.id, 'recordatorio_enviado', entrada -> 'recordatorio_enviado')
        || private.predecir_noshow(entrada, 'panel', fila.id, p_session_id)
    );
  end loop;
  return resultado;
end $$;
revoke all on function private.admin_roster_riesgo(uuid) from public, anon;
grant execute on function private.admin_roster_riesgo(uuid) to authenticated;
create function public.admin_roster_riesgo(p_session_id uuid) returns jsonb language sql security invoker set search_path = '' as $$
  select private.admin_roster_riesgo(p_session_id);
$$;
revoke all on function public.admin_roster_riesgo(uuid) from public, anon;
grant execute on function public.admin_roster_riesgo(uuid) to authenticated;

-- Estado del servicio y del registro (panel → Indicadores).
create function private.admin_modelo_estado() returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m private.ml_modelos;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  select * into m from private.ml_modelos order by activo desc, creado_en desc limit 1;
  return jsonb_build_object(
    'version', m.version,
    'modelo', m.modelo,
    'activo', coalesce(m.activo, false),
    'actualizado_en', m.actualizado_en,
    'umbral_contacto', (m.definicion ->> 'umbral_contacto')::numeric,
    'umbral_alto', (m.definicion ->> 'umbral_alto')::numeric,
    'predicciones_registradas', (select count(*) from private.ml_predicciones),
    'ultima_prediccion', (select max(creado_en) from private.ml_predicciones)
  );
end $$;
revoke all on function private.admin_modelo_estado() from public, anon;
grant execute on function private.admin_modelo_estado() to authenticated;
create function public.admin_modelo_estado() returns jsonb language sql security invoker set search_path = '' as $$
  select private.admin_modelo_estado();
$$;
revoke all on function public.admin_modelo_estado() from public, anon;
grant execute on function public.admin_modelo_estado() to authenticated;

-- Interruptor: desactivar el modelo deja al panel en la regla de respaldo (degradación controlada);
-- activarlo vuelve a usar la versión más reciente. Sirve también para revertir una versión defectuosa.
create function private.admin_set_modelo_activo(p_activo boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  update private.ml_modelos set activo = false, actualizado_en = now() where activo;
  if p_activo then
    update private.ml_modelos set activo = true, actualizado_en = now()
    where version = (select version from private.ml_modelos order by creado_en desc limit 1);
  end if;
  return private.admin_modelo_estado();
end $$;
revoke all on function private.admin_set_modelo_activo(boolean) from public, anon;
grant execute on function private.admin_set_modelo_activo(boolean) to authenticated;
create function public.admin_set_modelo_activo(p_activo boolean) returns jsonb language sql security invoker set search_path = '' as $$
  select private.admin_set_modelo_activo(p_activo);
$$;
revoke all on function public.admin_set_modelo_activo(boolean) from public, anon;
grant execute on function public.admin_set_modelo_activo(boolean) to authenticated;

-- Últimas predicciones registradas (evidencia consultable en la demo).
create function private.admin_predicciones(p_limite integer) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(x order by x.creado_en desc), '[]') from (
    select p.id, p.creado_en, p.version, p.origen, p.reservation_id, p.session_id, p.entrada,
      round(p.probabilidad::numeric, 4) probabilidad, p.riesgo
    from private.ml_predicciones p
    order by p.creado_en desc, p.id desc
    limit least(greatest(coalesce(p_limite, 20), 1), 200)
  ) x);
end $$;
revoke all on function private.admin_predicciones(integer) from public, anon;
grant execute on function private.admin_predicciones(integer) to authenticated;
create function public.admin_predicciones(p_limite integer) returns jsonb language sql security invoker set search_path = '' as $$
  select private.admin_predicciones(p_limite);
$$;
revoke all on function public.admin_predicciones(integer) from public, anon;
grant execute on function public.admin_predicciones(integer) to authenticated;

-- Versión del Proyecto Final exportada por ml/APF3_TD_Grupo6_ML_Innovacion.ipynb (ml/modelo/noshow-model.json).
insert into private.ml_modelos(version, modelo, definicion, activo)
values ('proy-1.0', 'Regresión logística + interacción temprano × anticipada', $modelo${"version":"proy-1.0","modelo":"Regresión logística + interacción temprano × anticipada","datos":"100 % simulados (origen = simulado); reentrenar con datos reales del MVP","umbral_contacto":0.2177,"umbral_alto":0.2788,"prior_no_show":0.17,"k_suavizado":2.0,"numericas":[{"nombre":"log_anticipacion","imputacion":3.713572066704308,"media":3.6925978542780813,"escala":0.8903656069193988},{"nombre":"reserva_mismo_dia","imputacion":0.0,"media":0.11184755592377796,"escala":0.3151788066441894},{"nombre":"ocupacion","imputacion":0.32,"media":0.3339158918653533,"escala":0.14246117634618266},{"nombre":"tasa_inasistencia_suavizada","imputacion":0.16714285714285712,"media":0.17342814943675575,"escala":0.11395961544012131},{"nombre":"inasistencias_previas","imputacion":2.0,"media":3.356255178127589,"escala":4.612712248060421},{"nombre":"log_reservas_previas","imputacion":2.6390573296152584,"media":2.48373371782312,"escala":1.0912747676414745},{"nombre":"es_primera_reserva","imputacion":0.0,"media":0.05274785970726319,"escala":0.22352969154804933},{"nombre":"recordatorio_enviado","imputacion":1.0,"media":0.8022645677989506,"escala":0.3982915151661075},{"nombre":"duracion_min","imputacion":60.0,"media":55.52885943109638,"escala":5.841556933205416},{"nombre":"capacidad","imputacion":20.0,"media":22.15631041148854,"escala":5.441296984298247},{"nombre":"temprano_x_anticipada","imputacion":0.0,"media":0.04004418668876001,"escala":0.19606287206198875}],"categoricas":[{"nombre":"disciplina","imputacion":"Spinning","categorias":["Cross Training","Funcional","HIIT","Spinning","Yoga","Zumba"]},{"nombre":"franja_horaria","imputacion":"noche","categorias":["manana","noche","tarde","temprano"]},{"nombre":"dia_semana","imputacion":"1","categorias":["1","2","3","4","5","6"]},{"nombre":"temporada","imputacion":"regular","categorias":["fiestas","regular","verano"]}],"variables":["log_anticipacion","reserva_mismo_dia","ocupacion","tasa_inasistencia_suavizada","inasistencias_previas","log_reservas_previas","es_primera_reserva","recordatorio_enviado","duracion_min","capacidad","temprano_x_anticipada","disciplina_Cross Training","disciplina_Funcional","disciplina_HIIT","disciplina_Spinning","disciplina_Yoga","disciplina_Zumba","franja_horaria_manana","franja_horaria_noche","franja_horaria_tarde","franja_horaria_temprano","dia_semana_1","dia_semana_2","dia_semana_3","dia_semana_4","dia_semana_5","dia_semana_6","temporada_fiestas","temporada_regular","temporada_verano"],"coeficientes":[0.1937776975827837,-0.01784813716118233,-0.13380580792634544,0.3060626918030332,0.09611739523103528,-0.03225969403756347,0.04452688579731378,-0.12022910820860819,-0.03445022717450802,0.018905412990439997,0.11287025709730948,0.02455182845196539,0.07863102669638954,0.04977540273976217,-0.05443795650785111,-0.10759752692266675,0.00930278602313937,-0.011127521559838923,0.04031958226685463,-0.10759752692266675,0.07863102669638954,0.09208972401451836,-0.00665681057066344,-0.07744639843170469,0.03133504223117927,0.059325147345487016,-0.0984211441080778,0.0448811678897756,0.015877152276619955,-0.060532759685657064],"intercepto":-1.5611680033548516,"metricas_prueba":{"accuracy":0.7001,"precision":0.2724,"recall":0.6212,"F1":0.3788,"F2":0.4946,"PR-AUC":0.3133,"ROC-AUC":0.7235,"% marcadas":0.3356}}$modelo$::jsonb, true);
