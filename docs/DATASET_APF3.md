# Dataset de asistencia · APF3

Este documento describe el dataset que FitSmart Agenda genera para el futuro modelo de predicción de inasistencias (no-shows). Reemplaza al contrato de datos preliminar del APF2 (sección 4.3 del informe), que se escribió antes de tener el esquema definitivo.

## Origen

- Función SQL `public.admin_dataset()`, definida en `supabase/migrations/20261016000000_apf3_cancelacion_dataset.sql`.
- Solo la puede ejecutar un administrador autorizado (`private.is_admin()`); socios y anónimos reciben error.
- En el panel `/admin`, el botón **Exportar dataset CSV** descarga el resultado (UTF-8, una fila por reserva).

## Unidad de análisis

Una fila por **reserva de una sesión que ya comenzó**. Las sesiones futuras no se incluyen porque todavía no tienen resultado.

## Variable objetivo

`asistio`:

| Valor | Significado |
| --- | --- |
| `true` | El socio fue registrado como presente: al escanear su QR en recepción o desde la lista de inscritos. |
| `false` | Ausente sin cancelar: **no-show** (inasistencia no avisada). |
| vacío | Reserva cancelada con aviso, o asistencia aún sin registrar. No se usa para entrenar. |

La cancelación (HU05) solo se permite antes del inicio de la clase y la asistencia solo después del inicio, así que una reserva no puede estar cancelada y marcada como ausente a la vez. Por eso `asistio = false` equivale exactamente a no-show.

Las sesiones canceladas por el gimnasio no forman parte del dataset: esas reservas no reflejan una decisión del socio.

## Diccionario de datos

| Columna | Tipo | Descripción | Uso previsto |
| --- | --- | --- | --- |
| `reserva_id` | uuid | Identificador de la reserva. | Identificador, no es variable. |
| `socio_ref` | texto (16 hex) | Hash SHA-256 truncado del UUID del socio. Permite agrupar reservas del mismo socio sin nombre ni correo. | Identificador / agrupación. |
| `sesion_id` | uuid | Sesión reservada. | Identificador. |
| `clase` | texto | Nombre de la clase. | Variable categórica. |
| `disciplina` | texto | Spinning, HIIT, Funcional, etc. | Variable categórica. |
| `instructor` | texto | Instructor de la sesión. | Variable categórica. |
| `inicio_sesion` | timestamptz | Fecha y hora de inicio. | Orden temporal para la partición. |
| `dia_semana` | entero 1–7 | Día de la semana en hora de Lima (1 = lunes). | Variable. |
| `hora_inicio` | entero 0–23 | Hora de inicio en Lima. | Variable. |
| `duracion_min` | entero | Duración de la sesión. | Variable. |
| `capacidad` | entero | Aforo máximo. | Variable. |
| `reservas_activas` | entero | Reservas no canceladas de la sesión. | Variable (ocupación). |
| `fecha_reserva` | timestamptz | Momento en que se hizo la reserva. | Base de `anticipacion_horas`. |
| `anticipacion_horas` | decimal | Horas entre la reserva y el inicio de la clase. | Variable. |
| `reservas_previas` | entero | Reservas del mismo socio en sesiones anteriores. | Variable (historial). |
| `inasistencias_previas` | entero | No-shows del mismo socio en sesiones anteriores. | Variable (historial). |
| `recordatorio_enviado` | booleano | Se envió el recordatorio por correo 3 horas antes (HU07). | Variable; permite medir el efecto del recordatorio. |
| `estado` | texto | `confirmed`, `cancelled` o `attended`. | Filtro. |
| `cancelada_en` | timestamptz | Cuándo canceló el socio; vacío si no canceló. | Análisis de cancelaciones. |
| `asistencia` | texto | `pending`, `present`, `absent`; vacío si se canceló. | Control de calidad. |
| `asistio` | booleano | Variable objetivo (ver arriba). | **Objetivo.** |

No se exportan nombres, correos ni el UUID real del socio.

## Diferencias con el contrato preliminar del APF2

| APF2 (preliminar) | Implementado | Motivo |
| --- | --- | --- |
| `usuario_id` | `socio_ref` (hash) | Seudonimización para cumplir la Ley N.° 29733. |
| `clase_id` | `sesion_id` + `clase` | La capacidad y el horario pertenecen a la sesión, no a la clase. |
| `estado`: pago pendiente, matriculado, cancelado | `estado`: confirmed, cancelled, attended | El MVP no gestiona pagos ni matrículas. |
| `asistio` guardado en la reserva | `asistio` calculado desde la tabla `attendance` | La asistencia tiene historial auditado (quién y cuándo la registró). |
| — | `anticipacion_horas`, `reservas_previas`, `inasistencias_previas`, `dia_semana`, `hora_inicio` | Variables explicativas habituales para predecir no-shows. |

## Calidad de los datos

- **Nulos y valores válidos:** las columnas de origen tienen `NOT NULL` y `CHECK` en PostgreSQL (estado de reserva, estado de asistencia, duración, capacidad).
- **Cobertura:** el panel muestra "Asistencia registrada", el porcentaje de reservas no canceladas que tienen asistencia marcada. Si es bajo, el dataset no sirve para entrenar aunque tenga muchas filas. Es el control que mitiga el riesgo 3 del informe APF2.
- **Duplicados:** un índice único impide dos reservas activas del mismo socio en la misma sesión.
- **Datos simulados para la exposición:** `supabase/demo/datos_simulados_exposicion.sql` crea sesiones del 21/09 al 31/12/2026 con reservas, cancelaciones y asistencia simuladas (sesiones con id `de000000-…`). Los 30 socios de demostración reciben nombres realistas y correos que son subdirecciones del correo del administrador, para que ningún mensaje llegue a terceros. `borrar_datos_simulados.sql` elimina las sesiones y les devuelve su identidad original. Sirven para demostrar el flujo y el indicador, no para reportar resultados reales.
- **Datos de demostración:** las 89 reservas del seed son académicas (`socio-demo-N@titan.invalid`). No deben presentarse como comportamiento real de socios de TITAN GYM ni usarse para reportar la precisión de un modelo.

## Partición recomendada

El informe APF2 propuso 80 % entrenamiento y 20 % prueba. Se recomienda que la partición sea **temporal**: ordenar por `inicio_sesion`, entrenar con el primer 80 % y evaluar con el último 20 %. Una partición aleatoria mezclaría reservas futuras del mismo socio en el entrenamiento y daría una precisión engañosamente alta, porque `inasistencias_previas` ya resume parte de ese historial.

## Pendiente para el componente de Machine Learning

1. Registrar asistencia real en las clases durante varias semanas (ver cobertura en el panel).
2. Exportar el CSV y describir el volumen real, la proporción de no-shows y los valores faltantes.
3. Entrenar un modelo base sencillo (por ejemplo, regresión logística) y compararlo contra la regla trivial "todos asisten".
4. Reportar precisión, recall y F1 de la clase no-show, no solo la exactitud, porque las clases estarán desbalanceadas.
