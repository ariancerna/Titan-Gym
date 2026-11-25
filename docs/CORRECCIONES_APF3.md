# Corrección del APF3 según la retroalimentación docente

Revisión del APF3 (Grupo 6, nota 18,55/20, sin penalizaciones). Este documento es la **tabla de corrección** que exige el Paso 2a del Proyecto Final: cada observación, la corrección aplicada y dónde está la evidencia. La versión corregida del modelo es **apf3-1.1**; la entregada en APF3 fue **apf3-1.0**.

## Tabla de corrección

| ID | Observación del docente | Corrección aplicada | Evidencia | Estado |
| --- | --- | --- | --- | --- |
| H5 | El umbral de contacto marcó 42,1 % de las reservas de prueba (tope operativo 40 %) y no se propuso un ajuste explícito. Recomendación: fijar por contrato el cupo de contactos y usar el riesgo alto como opción por defecto. | Cada cupo se exige ahora **en todos los pliegues temporales** de la validación (peor caso), no solo en el promedio. El riesgo **alto** pasa a ser la acción por defecto, con un cupo contractual del 20 % de las reservas; el riesgo medio queda como recordatorio adicional dentro del tope total del 40 %. El modelo y sus coeficientes no cambian. | Notebook, sección 3.4 (umbrales y peor pliegue) y tabla «APF3 entregado → APF3 corregido» (`ml/modelo/comparacion_apf3_proy.csv`). Umbrales nuevos en `ml/modelo/metadata.json` y `src/features/admin/noshow-model.json`; texto de «Ver inscritos» en `src/components/admin/AttendanceRoster.tsx`. | Hecho |
| H1 | Validez externa declarada, no demostrada: el dataset es 100 % sintético y la fuerza de cada relación la fijó el equipo. | Los registros con `origen = real` ya no se mezclan con el entrenamiento: se reservan para comprobar el modelo caso por caso (condición 5 del PROY). La comparación real frente a simulado (Kolmogorov-Smirnov) ya estaba implementada. | Notebook, sección 2.3 (fila «Reales reservados para validación») y sección 4.4; salida en `ml/modelo/validacion_registros_reales.csv` cuando exista `ml/data/export_mvp_real.csv`. | Código listo. **Falta que el equipo capture al menos 30 registros reales.** |
| H3 | El informe dice que falta desplegar el modelo, pero el bundle publicado en Vercel ya lo incluye (`apf3-1.0`, umbrales y niveles de riesgo). | La documentación declara el modelo como desplegado. Lo pendiente queda en confirmar la migración del recordatorio y servir el modelo desde el backend con registro de predicciones (requisito del PROY). | `ml/README.md`, sección «Integración con el MVP»; `docs/PROYECTO_FINAL.md` (estado real). En el PROY el modelo pasa a servirse desde Supabase con registro de cada predicción (migración `20261125000000_inferencia_servidor.sql`). | Hecho. **Falta una captura del panel en producción** (la toma el equipo con la cuenta administradora). |
| H4 | El anexo de IA del informe (diseño e imágenes) y el registro del repositorio (código y ML) no coinciden; la validación humana del registro estaba pendiente. | `docs/ANEXO_PROMPTS_IA.md` incorpora los prompts P23–P28 (revisión, informe y esta corrección). El informe del PROY referirá ese registro como anexo completo. | `docs/ANEXO_PROMPTS_IA.md`, sección 3. | Parcial. **El equipo debe completar la tabla de validación humana (sección 7) con nombre, fecha y resultado de lo que realmente verificó.** |
| H2 | Los 48 commits son de un solo integrante; la tabla de riesgos asigna responsabilidades a los otros tres. | No se puede corregir con código: cada integrante debe subir desde su propia cuenta el trabajo que le corresponde (por ejemplo, manual de usuario, pruebas, documentación o PPT) mediante ramas o pull requests. | `git shortlog -sn --all` | **Pendiente del equipo.** |
| R4 | Asegurar una cobertura de asistencia de al menos 90 % antes de reentrenar y repetir la tabla de prueba con unas 8 semanas reales. | Se mantiene el indicador de cobertura en el panel; el notebook ya separa los registros reales y compara distribuciones. | Panel `/admin` → Indicadores; notebook, secciones 2.2 y 4.4. | Depende de la operación real |
| F1 | El archivo del informe se llamó `APF3_GA6.pdf` en vez del nombre pedido. | En el PROY se usará `PROY_TD_Grupo6_ProyectoFinal.pdf` (y los demás nombres de la sección 5 de la consigna). | — | Para la entrega final |

## Resultado de la corrección (prueba cronológica, misma partición y semilla)

| Versión | Acción | Precisión | Recall | F2 | PR-AUC | % marcadas | Cupo | ¿Cumple? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| apf3-1.0 (entregado) | Contacto (medio o alto) | 0,243 | 0,697 | 0,508 | 0,319 | 42,1 % | 40 % | No |
| apf3-1.0 (entregado) | Solo riesgo alto | 0,311 | 0,417 | 0,390 | 0,319 | 19,7 % | — | — |
| **apf3-1.1 (corregido)** | Contacto (medio o alto) | 0,271 | 0,614 | 0,490 | 0,319 | 33,3 % | 40 % | **Sí** |
| **apf3-1.1 (corregido)** | **Solo riesgo alto (por defecto)** | 0,354 | 0,341 | 0,344 | 0,319 | 14,2 % | 20 % | **Sí** |

**Lectura.** Respetar el cupo en el peor caso cuesta recall: el contacto baja de 0,697 a 0,614 y queda bajo la meta de 0,65 fijada en APF3. Se prioriza la capacidad real de recepción, como recomendó el docente. El PR-AUC no cambia porque el modelo es el mismo. Recuperar recall dentro del cupo es el objetivo del ciclo de mejora del PROY (Paso 2b).

## Evidencia para la pregunta «¿las asistencias de Supabase son solo de demostración?»

Ejecutar en Supabase → SQL Editor y guardar una captura fechada para la sustentación:

```sql
select
  count(*) as asistencias_registradas,
  count(*) filter (where s.id::text like 'de000000-%') as en_sesiones_simuladas,
  count(*) filter (where r.user_id::text like '60000000-0000-4000-8000-%') as de_socios_demo
from public.attendance a
join public.reservations r on r.id = a.reservation_id
join public.class_sessions s on s.id = r.session_id;
```

Si las tres cifras coinciden, toda la asistencia registrada proviene del script de demostración (`supabase/demo/datos_simulados_exposicion.sql`).
