# Riesgo de no-show

Un **no-show** es una reserva en la que el socio no asistió y tampoco canceló. Su cupo se pierde. Reducir la tasa de no-shows es el indicador principal del proyecto.

El panel de administración estima, para cada inscrito, un riesgo **bajo**, **medio** o **alto** de no presentarse. Es la primera versión del componente predictivo: una **regla explicable**, no un modelo entrenado.

## Dónde se ve

- **Ver inscritos:** junto a cada reserva activa aparece la etiqueta con su motivo, por ejemplo «Riesgo alto · Faltó sin avisar a 3 de sus 8 reservas anteriores». Si la clase todavía no empezó y hay inscritos con riesgo alto, el panel sugiere confirmarles la asistencia.
- **Indicadores → ¿Acierta el riesgo de no-show?:** aplica la misma regla a las clases ya dictadas y compara cada nivel con lo que pasó de verdad.

## La regla

Cada factor suma puntos. Con 0–1 punto el riesgo es bajo, con 2 es medio y con 3 o más es alto.

| Factor | Puntos | Por qué |
| --- | --- | --- |
| Faltó sin avisar 2 o más veces y en al menos el 30 % de sus reservas anteriores | 3 | El historial propio es el mejor indicador: quien falta seguido suele volver a faltar. |
| Faltó sin avisar 1 vez (o varias, pero en menos del 30 %) | 1 | Señal débil: una falta aislada no define un hábito. |
| Es su primera reserva | 1 | Sin historial no hay compromiso demostrado. |
| Reservó con más de 3 días (72 h) de anticipación | 1 | Entre la reserva y la clase hay más tiempo para olvidarla o cambiar de planes. |
| La clase empieza antes de las 8:00 | 1 | Los horarios tempranos concentran más inasistencias. |

La regla vive en un solo lugar, [`src/features/admin/risk.ts`](../src/features/admin/risk.ts), y la usan tanto «Ver inscritos» como la comprobación de Indicadores. La base de datos solo entrega los datos que necesita (`admin_roster`, migración `20261025000000_riesgo_noshow.sql`), con las mismas definiciones que las columnas `reservas_previas` e `inasistencias_previas` del [dataset](DATASET_APF3.md).

Para cada reserva, la regla solo usa información anterior a la clase. Así la comprobación no «ve» el resultado que intenta anticipar.

## Comprobación con los datos simulados

Con los datos simulados de la exposición (`supabase/demo/datos_simulados_exposicion.sql`), 831 reservas con asistencia registrada al 19/10/2026:

| Riesgo estimado | Reservas | Ausentes | No-shows reales |
| --- | --- | --- | --- |
| Bajo | 425 | 58 | 13,6 % |
| Medio | 222 | 52 | 23,4 % |
| Alto | 184 | 59 | 32,1 % |

Los socios con riesgo alto faltaron unas 2,4 veces más que los de riesgo bajo, y la tasa sube de forma ordenada de un nivel al siguiente.

**Límite importante:** los datos simulados se generaron con factores parecidos a los de la regla (historial, anticipación y horario). Por eso este resultado solo demuestra que **el cálculo funciona de punta a punta**. No demuestra que la regla acierte con socios reales. Esa validación se hace con la misma tabla de Indicadores cuando haya semanas de asistencia real registrada.

## Siguiente paso

Con asistencia real suficiente, del orden de cientos de reservas registradas:

1. Exportar el dataset desde Indicadores (CSV).
2. Entrenar un modelo simple, por ejemplo una regresión logística, con las mismas variables y algunas más (día de la semana, ocupación, recordatorio enviado).
3. Compararlo con esta regla en la misma tabla. Solo conviene reemplazarla si separa mejor el riesgo alto del bajo.

La regla sirve de **línea base**: un modelo entrenado tiene que superarla para justificar su complejidad.
