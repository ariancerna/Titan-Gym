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

## Resultados (prueba cronológica: 18/08–31/10/2026, 897 reservas) · versión apf3-1.1 (APF3 corregido)

| Modelo | PR-AUC | ROC-AUC | Recall | Precisión | F2 | % marcadas |
| --- | --- | --- | --- | --- | --- | --- |
| Dummy "todos asisten" (situación actual) | 0.147 | 0.500 | 0.000 | 0.000 | 0.000 | 0 % |
| Regla del MVP (medio o alto) | 0.230 | 0.647 | 0.561 | 0.228 | 0.434 | 36 % |
| **Regresión logística · contacto (medio o alto)** | **0.319** | **0.721** | **0.614** | **0.271** | **0.490** | 33 % |
| **Regresión logística · solo riesgo alto (acción por defecto)** | 0.319 | 0.721 | 0.341 | 0.354 | 0.344 | 14 % |
| KNN (k = 201) | 0.295 | 0.720 | 0.652 | 0.249 | 0.492 | 39 % |
| Gradient Boosting | 0.310 | 0.710 | 0.515 | 0.297 | 0.449 | 26 % |
| Árbol de decisión | 0.238 | 0.669 | 0.439 | 0.251 | 0.382 | 26 % |

El modelo se eligió por PR-AUC en validación cruzada temporal (0.315, frente a ≤ 0.275 de los demás), **no** por la
prueba. Los umbrales se fijan fuera de pliegue exigiendo cada cupo **en todos los pliegues temporales**: contacto ≤ 40 %
(umbral 0.2224) y riesgo alto ≤ 20 % (umbral 0.2924). Ambos cupos se cumplen en la prueba (33 % y 14 %).

**APF3 entregado → corregido** (`modelo/comparacion_apf3_corregido.csv`): en apf3-1.0 el contacto marcaba 42,1 % (tope de
40 % excedido) con recall 0.697; en apf3-1.1 marca 33,3 % con recall 0.614. La meta de recall 0.65 deja de cumplirse: se
prioriza la capacidad real de recepción y recuperar recall dentro del cupo queda para el ciclo de mejora del PROY.
Detalle de cada corrección: [docs/CORRECCIONES_APF3.md](../docs/CORRECCIONES_APF3.md).

## Integración con el MVP

1. **En el panel publicado (implementado y desplegado en Vercel; el docente lo verificó en el bundle de producción):** el notebook exporta la regresión logística a
   `src/features/admin/noshow-model.json`; `src/features/admin/noshowModel.ts` la evalúa en *Ver inscritos* (nivel +
   probabilidad) y en *Indicadores → ¿Acierta el riesgo de no-show?* (modelo contra regla en clases ya dictadas).
   `tests/unit/noshow-model.test.ts` verifica que TypeScript reproduce scikit-learn en 200 reservas (diferencia < 1e-9).
2. **Endpoint HTTP (implementado y probado en local):** `integracion/api.py` responde con el mismo contrato para un
   backend futuro o para modelos no lineales.
3. **Validación con datos reales:** los registros exportados a `data/export_mvp_real.csv` (con `origen = real`) no
   entrenan el modelo: la sección 4.4 del notebook los predice y los revisa caso por caso.
4. **Pendiente para PROY:** confirmar en Supabase la migración `20261113000000_modelo_noshow_roster.sql` (estado del
   recordatorio en *Ver inscritos*; sin ella el modelo imputa ese dato), servir el modelo desde el backend con registro de
   cada predicción, registrar asistencia real y reentrenar.
