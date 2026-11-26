# Componente de Machine Learning · APF3 (Grupo 6)

Modelo que estima, para cada reserva de TITAN GYM, la **probabilidad de no-show** (inasistencia sin cancelar) y la
convierte en un nivel de riesgo que el panel `/admin` del MVP muestra en *Ver inscritos*.

> **Datos 100 % simulados** (columna `origen = "simulado"`), calibrados con el Contrato de Datos de APF2. Los resultados
> son indicativos hasta reentrenar con asistencia real exportada desde el panel.

## Contenido

| Archivo | Qué es |
| --- | --- |
| `APF3_TD_Grupo6_ML_Innovacion.ipynb` | **Entregable**: notebook ejecutado con todas las salidas y figuras. |
| `APF3_TD_Grupo6_ML_Innovacion.py` | Misma fuente en formato de celdas `# %%`; también corre como script. |
| `simulacion.py` | Generador del dataset (distribuciones, efectos, semilla 2026) con el esquema exacto de `admin_dataset()`. |
| `titan_noshow.py` | Variables derivadas, pipeline de scikit-learn y la regla del MVP portada como línea base. |
| `integracion/predict.py` | Función `predecir()` y CLI que cargan el modelo exportado y responden con el esquema del MVP. |
| `integracion/api.py` | Endpoint FastAPI `POST /predict` (y `GET /salud`). |
| `integracion/ejemplo_entrada.json` | Dos reservas de ejemplo con el esquema de entrada. |
| `integracion/evidencia_llamada.json` | Log de la última llamada real al endpoint (lo genera el notebook). |
| `data/` | Dataset simulado (CSV, anexo) y diccionario de datos. |
| `figuras/` | Las 8 figuras del notebook en PNG, listas para el informe. |
| `modelo/` | `modelo_noshow_titan.joblib` (pipeline completo), `metadata.json`, métricas de prueba y la exportación para el MVP. |
| `construir_notebook.py` | Convierte el `.py` en el `.ipynb`. |
| `preparar_export_real.py` | Limpia la exportación real del panel (quita demostración, anonimiza, rotula `origen = real`). |

## Cómo ejecutar

**Local (Python 3.11):**

```powershell
cd ml
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\jupyter notebook APF3_TD_Grupo6_ML_Innovacion.ipynb   # Run All
```

Regenerar el notebook ejecutado desde la fuente:

```powershell
.venv\Scripts\python construir_notebook.py
.venv\Scripts\jupyter nbconvert --to notebook --execute --inplace APF3_TD_Grupo6_ML_Innovacion.ipynb
```

**Google Colab:** abrir el `.ipynb` desde GitHub y ejecutar todo. La primera celda instala las dependencias que faltan y la
siguiente descarga `simulacion.py`, `titan_noshow.py` e `integracion/` del repositorio público.

**Predicción y endpoint:**

```powershell
.venv\Scripts\python integracion\predict.py integracion\ejemplo_entrada.json
.venv\Scripts\uvicorn integracion.api:app --port 8000      # luego POST http://127.0.0.1:8000/predict
```

## Resultados (prueba cronológica: 18/08–31/10/2026, 897 reservas)

Comparación con la misma partición, el mismo preprocesamiento y `random_state = 2026`
(`modelo/comparacion_apf3_proy.csv`):

| Versión | Acción | Precisión | Recall | F2 | PR-AUC | % marcadas | Cupo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Línea base: regla del MVP | Riesgo alto | 0.318 | 0.311 | 0.312 | 0.230 | 14 % | — |
| apf3-1.0 (APF3 entregado) | Contacto (medio o alto) | 0.243 | 0.697 | 0.508 | 0.319 | 42 % | 40 %: **no cumple** |
| apf3-1.1 (APF3 corregido) | Contacto | 0.271 | 0.614 | 0.490 | 0.319 | 33 % | 40 %: cumple |
| apf3-1.1 (APF3 corregido) | Solo riesgo alto | 0.354 | 0.341 | 0.344 | 0.319 | 14 % | 20 %: cumple |
| **proy-1.0 (PROY, servido)** | Contacto | 0.272 | **0.621** | **0.495** | 0.313 | 34 % | 40 %: cumple |
| **proy-1.0 (PROY, servido)** | **Solo riesgo alto (por defecto)** | 0.343 | **0.364** | **0.359** | 0.313 | 16 % | 20 %: cumple |

- **Corrección APF3 (apf3-1.1):** cada cupo se exige en todos los pliegues temporales; el riesgo alto pasa a ser la acción por
  defecto. Detalle: [docs/CORRECCIONES_APF3.md](../docs/CORRECCIONES_APF3.md).
- **Ciclo de mejora (proy-1.0):** se acepta la variable `temprano_x_anticipada` por la regla fijada de antemano (PR-AUC de
  validación 0.315 → 0.324, mejor en 4 de 5 pliegues; `modelo/ciclo_mejora_cv.csv`). En la prueba mejora recall y F2 dentro
  del cupo, pero el PR-AUC baja 0.006: la ganancia es pequeña y está dentro de la variación entre pliegues. `viernes_tarde` y
  el balanceo de clases se descartan.

## Cargar datos reales (condición 5 del Proyecto Final)

Los registros reales **no entrenan** el modelo: sirven para comprobar, caso por caso, si el modelo entrenado con datos
simulados acierta con socios reales (sección 4.4 del notebook) y para comparar distribuciones real frente a simulado.

1. **Registrar la asistencia real** en el panel durante unos días: «Registrar llegada» con el QR o «Ver inscritos» →
   Presente / Ausente. El aviso «asistencia sin registrar» de la pestaña Hoy muestra lo que falta.
2. **Exportar:** panel `/admin` → Indicadores → **Exportar dataset CSV** (descarga `fitsmart-dataset-AAAA-MM-DD.csv`).
3. **Limpiar y rotular** desde la carpeta `ml/`:
   ```bash
   python preparar_export_real.py ruta/a/fitsmart-dataset-AAAA-MM-DD.csv --desde AAAA-MM-DD
   ```
   `--desde` es la fecha en que el gimnasio empezó a usar el sistema. El script quita las sesiones simuladas y los socios
   de demostración, anonimiza a los instructores, rotula `origen = real`, informa cuántas reservas tienen asistencia y
   guarda `data/export_mvp_real.csv` (excluido de git: no se publica).
4. **Volver a ejecutar el notebook completo.** La sección 2.2 compara real frente a simulado (prueba de Kolmogorov-Smirnov)
   y la 4.4 muestra la predicción de cada reserva real y su matriz de confusión.

Con al menos 30 reservas reales con asistencia se cumple el mínimo de la consigna; con 100 o más reales se pueden sumar al
entrenamiento en un ciclo posterior (bonificación).

## Integración con el MVP

1. **Servido por el backend (en producción):** la migración `supabase/migrations/20261125000000_inferencia_servidor.sql`
   guarda la versión exportada en `private.ml_modelos` y expone `predecir_noshow()` y `admin_roster_riesgo()`. Supabase valida
   la entrada, calcula la probabilidad con el mismo pipeline y registra cada predicción en `private.ml_predicciones` (entrada,
   probabilidad, riesgo, versión y fecha). `tests/integration/database.mjs` comprueba la paridad con scikit-learn en 200
   reservas (diferencia < 1e-9).
2. **En el panel:** «Ver inscritos» pide el riesgo al servidor; si el modelo está desactivado, falla o tarda más de 6 s,
   muestra la regla de respaldo con un aviso. Indicadores → *Servicio de predicción* permite probar una predicción, ver el
   registro y desactivar el modelo para comprobar la degradación.
3. **Endpoint HTTP (probado en local):** `integracion/api.py` responde con el mismo contrato; queda para modelos no lineales
   que no puedan evaluarse en SQL.
4. **Validación con datos reales:** los registros exportados a `data/export_mvp_real.csv` (con `origen = real`) no entrenan
   el modelo: la sección 4.4 del notebook los predice y los revisa caso por caso.
5. **Publicar una versión nueva:** ejecutar el notebook, insertar la nueva fila en `private.ml_modelos` mediante una
   migración (activándola) y mantener la prueba de paridad. Guía completa: [docs/PROYECTO_FINAL.md](../docs/PROYECTO_FINAL.md).
