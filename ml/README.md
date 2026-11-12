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

| Modelo | PR-AUC | ROC-AUC | Recall | Precisión | F2 | % contactadas |
| --- | --- | --- | --- | --- | --- | --- |
| Dummy "todos asisten" (situación actual) | 0.147 | 0.500 | 0.000 | 0.000 | 0.000 | 0 % |
| Regla del MVP (medio o alto) | 0.230 | 0.647 | 0.561 | 0.228 | 0.434 | 36 % |
| **Regresión logística (seleccionada, C = 0.03)** | **0.319** | **0.721** | **0.697** | **0.243** | **0.508** | 42 % |
| Gradient Boosting | 0.310 | 0.710 | 0.629 | 0.255 | 0.487 | 36 % |
| KNN (k = 201) | 0.295 | 0.720 | 0.720 | 0.245 | 0.519 | 43 % |
| Árbol de decisión | 0.238 | 0.669 | 0.621 | 0.206 | 0.442 | 45 % |

El modelo se eligió por PR-AUC en validación cruzada temporal (0.315, frente a ≤ 0.275 de los demás), **no** por la
prueba. Meta de recall (≥ 0.65): cumplida. Tope operativo (≤ 40 % contactadas): excedido por 2 puntos en la prueba.

## Integración con el MVP

1. **En el navegador (implementado):** el notebook exporta la regresión logística a
   `src/features/admin/noshow-model.json`; `src/features/admin/noshowModel.ts` la evalúa en *Ver inscritos* (nivel +
   probabilidad) y en *Indicadores → ¿Acierta el riesgo de no-show?* (modelo contra regla en clases ya dictadas).
   `tests/unit/noshow-model.test.ts` verifica que TypeScript reproduce scikit-learn en 200 reservas (diferencia < 1e-9).
2. **Endpoint HTTP (implementado y probado en local):** `integracion/api.py` responde con el mismo contrato para un
   backend futuro o para modelos no lineales.
3. **Pendiente para PROY:** aplicar en Supabase la migración `20261113000000_modelo_noshow_roster.sql` (agrega el estado
   del recordatorio a *Ver inscritos*; sin ella el modelo imputa ese dato), registrar asistencia real, exportarla a
   `data/export_mvp_real.csv` y reentrenar.
