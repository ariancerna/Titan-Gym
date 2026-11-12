"""
Endpoint HTTP del modelo de no-show (FastAPI, tecnología citada en el informe APF2).

Ejecutar en local desde la carpeta ml/:
    uvicorn integracion.api:app --port 8000
Probar:
    curl -X POST http://127.0.0.1:8000/predict -H "Content-Type: application/json" \
         -d @integracion/ejemplo_entrada.json

El esquema de entrada replica los campos de admin_dataset() que el MVP ya captura.
"""
from __future__ import annotations

from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from integracion.predict import _cargar, predecir


class ReservaMVP(BaseModel):
    disciplina: Literal["Cross Training", "Funcional", "HIIT", "Spinning", "Yoga", "Zumba"]
    inicio_sesion: str = Field(description="Inicio de la clase en ISO 8601 (UTC)", examples=["2026-11-16T12:00:00Z"])
    dia_semana: int = Field(ge=1, le=7, description="1 = lunes (hora de Lima)")
    hora_inicio: int = Field(ge=0, le=23, description="Hora de inicio en Lima")
    duracion_min: int = Field(ge=30, le=120)
    capacidad: int = Field(ge=1, le=40)
    reservas_activas: int = Field(ge=0)
    anticipacion_horas: float = Field(gt=0, le=168)
    reservas_previas: int = Field(ge=0)
    inasistencias_previas: int = Field(ge=0)
    recordatorio_enviado: bool


class Prediccion(BaseModel):
    probabilidad_no_show: float
    riesgo: Literal["bajo", "medio", "alto"]
    umbral_contacto: float
    umbral_alto: float
    accion_sugerida: str
    modelo_version: str


app = FastAPI(title="TITAN GYM · Riesgo de no-show", version="apf3-1.0")


@app.get("/salud")
def salud() -> dict:
    _, meta = _cargar()
    return {"estado": "ok", "modelo": meta["modelo"], "version": meta["version"]}


@app.post("/predict", response_model=Prediccion)
def predict(reserva: ReservaMVP) -> dict:
    try:
        return predecir(reserva.model_dump())
    except ValueError as error:  # reglas del contrato que cruzan campos
        raise HTTPException(status_code=422, detail=str(error)) from error
