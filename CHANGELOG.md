# CHANGELOG · FitSmart Agenda (TITAN GYM)

Cambios del MVP y del modelo de Machine Learning desde la entrega del APF2. Fechas en hora de Lima.

## [apf3-1.1] · 2026-11-24 · Corrección del APF3 según la retroalimentación docente

Detalle y evidencia de cada corrección: [docs/CORRECCIONES_APF3.md](docs/CORRECCIONES_APF3.md).

### Modelo
- Los umbrales se fijan exigiendo cada cupo en todos los pliegues temporales de la validación (peor caso). En la prueba, el contacto marca 33,3 % de las reservas (antes 42,1 %, tope 40 %) y el riesgo alto, 14,2 % (cupo 20 %). Recall de contacto 0,614 (antes 0,697); el modelo y su PR-AUC (0,319) no cambian.
- El riesgo alto pasa a ser la acción por defecto de recepción, con cupo contractual del 20 %.
- Los registros con `origen = real` se reservan solo para validar el modelo caso por caso; ya no se mezclan con el entrenamiento.
- Se guardan las métricas de la versión entregada (`ml/modelo/metricas_apf3_entregado.csv`) y la comparación con la corregida (`ml/modelo/comparacion_apf3_corregido.csv`).

### MVP
- «Ver inscritos» indica que por defecto solo se confirma el riesgo alto y usa los umbrales nuevos.

### Documentación
- `ml/README.md` declara el modelo como desplegado en Vercel (hallazgo H3) y publica las métricas corregidas.
- `docs/ANEXO_PROMPTS_IA.md` incorpora los prompts P23–P28.

## [apf3-1.0] · 2026-11-12 a 2026-11-18 · APF3 entregado

### Modelo
- Componente `ml/`: dataset simulado y rotulado con el esquema de `admin_dataset()`, 25 reglas de coherencia, EDA, pipeline sin fuga, partición cronológica 80/20, cuatro modelos de la Unidad 3 frente a tres líneas base, evaluación, exportación con joblib, `predict.py` y endpoint FastAPI.
- `scipy==1.14.1` fijado para que el notebook corra sin advertencias en entornos nuevos.

### MVP
- La regresión logística exportada calcula nivel y probabilidad de no-show en «Ver inscritos»; Indicadores compara modelo y regla.
- Migración `20261113000000_modelo_noshow_roster.sql`: `admin_roster` entrega el estado del recordatorio.
- Prueba de paridad TypeScript frente a scikit-learn (200 reservas).
- Corrección visual de la casilla de aceptar la política al crear la cuenta.

## Entre APF2 y APF3 · 2026-10-15 a 2026-10-27

### Funcionalidades nuevas
- Cancelación de reservas (HU05) y dataset de asistencia exportable desde el panel.
- Política de privacidad y consentimiento obligatorio (Ley N.° 29733), con versión 2026-10-19.
- Comprobante con QR y registro de llegada en recepción.
- Recordatorio por correo 3 horas antes de cada clase (HU07), desactivable en Mi perfil.
- Lista de espera para clases llenas (HU08).
- Riesgo de no-show por reglas en el panel (línea base del modelo).
- Mi perfil, asistente guiado sin IA con contacto por WhatsApp, calendario, app instalable e imagen para compartir.
- Reservas abiertas 7 días antes de cada clase; panel reorganizado con gestión de sesiones.

### Correcciones y seguridad
- Content-Security-Policy y Permissions-Policy; enlaces de correo validados en el dominio de la app.
- Mis reservas en una sola consulta; fotos en WebP; hallazgos de auditoría Q3, Q5 y D1 corregidos.
- Se probó disparar los recordatorios desde Supabase y Vercel y se revirtió.

### Identidad visual
- Identidad propia de TITAN GYM (negro, blanco y morado neón), logo real, mapa real de la sede y fotos ajustadas a su iluminación.

## [APF2] · 2026-10-11

- Primera versión publicada: catálogo, reservas con validación atómica de aforo, panel administrativo y asistencia auditada, sobre Supabase y Vercel.
