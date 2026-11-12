"""
Punto de integración del modelo de no-show con el MVP FitSmart Agenda.

Uso como función (backend):
    from integracion.predict import predecir
    predecir({"disciplina": "Funcional", "inicio_sesion": "2026-11-16T12:00:00Z", ...})

Uso por línea de comandos (evidencia de llamada real):
    python integracion/predict.py integracion/ejemplo_entrada.json

La entrada es un JSON con los campos que el MVP ya captura (ver CAMPOS_ENTRADA y el contrato en
integracion/contrato.md); puede ser un objeto o una lista de objetos.
"""
from __future__ import annotations

import json
import sys
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

from titan_noshow import CAMPOS_ENTRADA, DISCIPLINAS, VENTANA_RESERVA_HORAS  # noqa: E402

RUTA_MODELO = RAIZ / "modelo" / "modelo_noshow_titan.joblib"
RUTA_METADATA = RAIZ / "modelo" / "metadata.json"

ACCIONES = {
    "alto": "Confirmar asistencia por WhatsApp antes de la clase; si no confirma, liberar el cupo a la lista de espera.",
    "medio": "Enviar un recordatorio adicional (WhatsApp o correo) el día de la clase.",
    "bajo": "Sin acción.",
}


@lru_cache(maxsize=1)
def _cargar():
    modelo = joblib.load(RUTA_MODELO)
    metadata = json.loads(RUTA_METADATA.read_text(encoding="utf-8"))
    return modelo, metadata


def validar(registro: dict) -> None:
    """Rechaza registros que no cumplen el contrato antes de llegar al modelo."""
    faltan = [c for c in CAMPOS_ENTRADA if c not in registro]
    if faltan:
        raise ValueError(f"Faltan campos del contrato: {faltan}")
    if registro["disciplina"] not in DISCIPLINAS:
        raise ValueError(f"disciplina desconocida: {registro['disciplina']}")
    if not 1 <= int(registro["dia_semana"]) <= 7 or not 0 <= int(registro["hora_inicio"]) <= 23:
        raise ValueError("dia_semana debe estar en 1–7 y hora_inicio en 0–23")
    if not 0 < float(registro["anticipacion_horas"]) <= VENTANA_RESERVA_HORAS:
        raise ValueError("anticipacion_horas debe estar en (0, 168]")
    if not 0 <= int(registro["reservas_activas"]) <= int(registro["capacidad"]):
        raise ValueError("reservas_activas debe estar entre 0 y la capacidad")
    if not 0 <= int(registro["inasistencias_previas"]) <= int(registro["reservas_previas"]):
        raise ValueError("inasistencias_previas debe estar entre 0 y reservas_previas")


def predecir(registro: dict) -> dict:
    """Devuelve la probabilidad de no-show, el nivel de riesgo y la acción sugerida para una reserva."""
    validar(registro)
    modelo, meta = _cargar()
    prob = float(modelo.predict_proba(pd.DataFrame([registro])[CAMPOS_ENTRADA])[0, 1])
    riesgo = "alto" if prob >= meta["umbral_alto"] else "medio" if prob >= meta["umbral_contacto"] else "bajo"
    return {
        "probabilidad_no_show": round(prob, 4),
        "riesgo": riesgo,
        "umbral_contacto": meta["umbral_contacto"],
        "umbral_alto": meta["umbral_alto"],
        "accion_sugerida": ACCIONES[riesgo],
        "modelo_version": meta["version"],
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Uso: python integracion/predict.py <entrada.json>")
    datos = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    salida = [predecir(r) for r in datos] if isinstance(datos, list) else predecir(datos)
    print(json.dumps(salida, indent=2, ensure_ascii=False))
