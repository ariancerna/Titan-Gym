"""
Piezas compartidas del modelo de no-show de TITAN GYM (APF3):

  * CAMPOS_ENTRADA: esquema que el MVP (FitSmart Agenda) entrega por cada reserva.
  * CaracteristicasNoShow: ingeniería de características SIN estado (no aprende nada de los datos),
    por lo que no puede filtrar información del conjunto de prueba.
  * construir_pipeline(): características + imputación + escalado/one-hot + modelo, en un solo
    objeto de scikit-learn que se exporta con joblib y se usa igual en el notebook y en la API.
  * regla_mvp(): la regla de riesgo que el MVP ya usa (src/features/admin/risk.ts), portada a
    Python para compararla como línea base.

Este archivo lo importan el notebook, integracion/predict.py e integracion/api.py; por eso vive
fuera del notebook (joblib necesita poder importar la clase al cargar el modelo).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Prior de no-show para suavizar la tasa individual de socios con poco historial.
# Es el punto medio del rango sectorial (10–25 %), NO un dato de TITAN GYM: no se estima con los
# datos para no introducir fuga de información desde el conjunto de prueba.
PRIOR_NO_SHOW = 0.17
K_SUAVIZADO = 2.0  # equivale a "2 reservas imaginarias" con la tasa prior
VENTANA_RESERVA_HORAS = 168  # el MVP abre las reservas 7 días antes (migración ventana_reservas)

# Campos que el MVP ya captura y entrega por reserva (subconjunto de admin_dataset()).
CAMPOS_ENTRADA = [
    "disciplina",
    "inicio_sesion",
    "dia_semana",
    "hora_inicio",
    "duracion_min",
    "capacidad",
    "reservas_activas",
    "anticipacion_horas",
    "reservas_previas",
    "inasistencias_previas",
    "recordatorio_enviado",
]

DISCIPLINAS = ["Cross Training", "Funcional", "HIIT", "Spinning", "Yoga", "Zumba"]

VARIABLES_NUMERICAS = [
    "log_anticipacion",
    "reserva_mismo_dia",
    "ocupacion",
    "tasa_inasistencia_suavizada",
    "inasistencias_previas",
    "log_reservas_previas",
    "es_primera_reserva",
    "recordatorio_enviado",
    "duracion_min",
    "capacidad",
]
VARIABLES_CATEGORICAS = ["disciplina", "franja_horaria", "dia_semana", "temporada"]


def _franja(hora: pd.Series) -> pd.Series:
    return pd.cut(
        hora, bins=[-1, 7, 11, 17, 23], labels=["temprano", "manana", "tarde", "noche"]
    ).astype(str)


def _temporada(mes: pd.Series) -> pd.Series:
    # Verano (ene–mar): más motivación y altas; fiestas (jul y dic): más viajes y compromisos.
    return np.select(
        [mes.isin([1, 2, 3]), mes.isin([7, 12])], ["verano", "fiestas"], default="regular"
    )


class CaracteristicasNoShow(BaseEstimator, TransformerMixin):
    """Convierte los campos del MVP en variables explicativas. No tiene parámetros aprendidos."""

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = pd.DataFrame(X).copy()
        out = pd.DataFrame(index=X.index)
        horas = pd.to_numeric(X["anticipacion_horas"], errors="coerce")
        previas = pd.to_numeric(X["reservas_previas"], errors="coerce")
        faltas = pd.to_numeric(X["inasistencias_previas"], errors="coerce")
        capacidad = pd.to_numeric(X["capacidad"], errors="coerce")
        mes = (
            pd.to_datetime(X["inicio_sesion"], utc=True, format="ISO8601").dt.tz_convert("America/Lima").dt.month
        )
        # Anticipación en escala logarítmica: pasar de 2 h a 26 h pesa más que de 146 h a 170 h.
        out["log_anticipacion"] = np.log1p(horas.clip(lower=0))
        out["reserva_mismo_dia"] = (horas <= 12).astype(float)
        # Ocupación: proporción del aforo reservado al inicio de la clase.
        out["ocupacion"] = pd.to_numeric(X["reservas_activas"], errors="coerce") / capacidad
        # Tasa de inasistencia del socio, suavizada hacia el prior sectorial (bayesiana simple).
        out["tasa_inasistencia_suavizada"] = (faltas + PRIOR_NO_SHOW * K_SUAVIZADO) / (
            previas + K_SUAVIZADO
        )
        out["inasistencias_previas"] = faltas
        out["log_reservas_previas"] = np.log1p(previas)
        out["es_primera_reserva"] = (previas == 0).astype(float)
        out["recordatorio_enviado"] = (
            X["recordatorio_enviado"].map({True: 1.0, False: 0.0, "true": 1.0, "false": 0.0})
        ).astype(float)
        out["duracion_min"] = pd.to_numeric(X["duracion_min"], errors="coerce")
        out["capacidad"] = capacidad
        out["disciplina"] = X["disciplina"].astype(str)
        out["franja_horaria"] = _franja(pd.to_numeric(X["hora_inicio"], errors="coerce"))
        out["dia_semana"] = pd.to_numeric(X["dia_semana"], errors="coerce").astype("Int64").astype(str)
        out["temporada"] = _temporada(mes)
        return out[VARIABLES_NUMERICAS + VARIABLES_CATEGORICAS]

    def get_feature_names_out(self, input_features=None):
        return np.array(VARIABLES_NUMERICAS + VARIABLES_CATEGORICAS, dtype=object)


def construir_preprocesador() -> ColumnTransformer:
    """Imputación + escalado (numéricas) y one-hot (categóricas). Se ajusta solo con train."""
    numericas = Pipeline(
        [("imputar", SimpleImputer(strategy="median")), ("escalar", StandardScaler())]
    )
    categoricas = Pipeline(
        [
            ("imputar", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    return ColumnTransformer(
        [("num", numericas, VARIABLES_NUMERICAS), ("cat", categoricas, VARIABLES_CATEGORICAS)],
        verbose_feature_names_out=False,
    )


def construir_pipeline(modelo) -> Pipeline:
    return Pipeline(
        [
            ("caracteristicas", CaracteristicasNoShow()),
            ("preprocesamiento", construir_preprocesador()),
            ("modelo", modelo),
        ]
    )


# ----------------------------------------------------------------------------------------------
# Línea base: la regla de riesgo que hoy usa el MVP (src/features/admin/risk.ts), sin cambios.
# ----------------------------------------------------------------------------------------------
REGLA = {"faltas_habituales": 2, "tasa_habitual": 0.3, "anticipacion_larga_h": 72, "hora_temprana": 8}


def puntos_regla_mvp(df: pd.DataFrame) -> np.ndarray:
    faltas = df["inasistencias_previas"].to_numpy()
    total = df["reservas_previas"].to_numpy()
    tasa = np.divide(faltas, total, out=np.zeros(len(df)), where=total > 0)
    habitual = (faltas >= REGLA["faltas_habituales"]) & (total > 0) & (tasa >= REGLA["tasa_habitual"])
    puntos = np.where(habitual, 3, np.where(faltas >= 1, 1, 0))
    puntos = puntos + (total == 0)
    puntos = puntos + (df["anticipacion_horas"].to_numpy() > REGLA["anticipacion_larga_h"])
    puntos = puntos + (df["hora_inicio"].to_numpy() < REGLA["hora_temprana"])
    return puntos


def regla_mvp(df: pd.DataFrame) -> np.ndarray:
    """Nivel bajo / medio / alto, igual que noShowRisk() del MVP."""
    p = puntos_regla_mvp(df)
    return np.where(p >= 3, "alto", np.where(p == 2, "medio", "bajo"))
