"""
Simulación del dataset de reservas de TITAN GYM con el esquema exacto de `admin_dataset()`
(MVP FitSmart Agenda, APF2). TODOS los registros generados aquí son SIMULADOS y se rotulan con
origen = "simulado".

Calibración (fuentes verificables):
  * Volumen: 300–500 reservas/mes (Contrato de Datos Preliminar, informe APF2 §4.3).
  * Escala: "cientos de socios activos" y 4–6 colaboradores (APF2 §4.1, entrevista del 12/09/2026).
  * Horario, salas, duración y aforo: agenda semanal del MVP (supabase/demo/datos_simulados_exposicion.sql).
  * Clases, disciplinas e instructores: supabase/seed.sql (instructores ficticios del MVP).
  * Ventana de reserva de 7 días: migración 20261019000000_ventana_reservas.sql.
  * Recordatorio 3 h antes y preferencia activada por defecto: migración 20261020000000_recordatorios.sql.
  * Tasa de no-show objetivo ≈ 17 %: rango de 10–25 % reportado por el sector para clases incluidas
    en la membresía (Vagaro, Glofox, Virtuagym; ver informe). Es un SUPUESTO a validar con datos reales.

El mecanismo generador (efectos en log-odds) está documentado en `PARAMETROS` y en el informe.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd

LIMA = timezone(timedelta(hours=-5))  # Lima no usa horario de verano

# Agenda semanal del MVP: (isodow, hora, minuto, clase, disciplina, instructor, duración, aforo, popularidad)
# La popularidad (0–1) es la ocupación media esperada antes de la estacionalidad.
AGENDA = [
    (1, 7, 0, "Entrenamiento Funcional Élite", "Funcional", "David Ruiz", 60, 18, 0.30),
    (1, 18, 0, "Power Spinning Extreme", "Spinning", "Carlos Mendoza", 50, 25, 0.40),
    (1, 19, 30, "HIIT Titan Burn", "HIIT", "Sofía Herrera", 45, 20, 0.33),
    (2, 8, 30, "Zumba Energy Party", "Zumba", "Camila Ortiz", 60, 30, 0.22),
    (2, 17, 30, "Power Yoga & Recovery", "Yoga", "Mateo Silva", 60, 15, 0.30),
    (2, 19, 0, "Titan Cross Training", "Cross Training", "Lucas Prado", 60, 16, 0.38),
    (3, 7, 0, "Entrenamiento Funcional Élite", "Funcional", "David Ruiz", 60, 18, 0.28),
    (3, 18, 0, "Power Spinning Extreme", "Spinning", "Carlos Mendoza", 50, 25, 0.42),
    (3, 19, 30, "HIIT Titan Burn", "HIIT", "Sofía Herrera", 45, 20, 0.33),
    (4, 8, 30, "Zumba Energy Party", "Zumba", "Camila Ortiz", 60, 30, 0.22),
    (4, 17, 30, "Power Yoga & Recovery", "Yoga", "Mateo Silva", 60, 15, 0.30),
    (4, 19, 0, "Titan Cross Training", "Cross Training", "Lucas Prado", 60, 16, 0.38),
    (5, 7, 0, "Entrenamiento Funcional Élite", "Funcional", "David Ruiz", 60, 18, 0.25),
    (5, 18, 0, "Power Spinning Extreme", "Spinning", "Carlos Mendoza", 50, 25, 0.30),
    (6, 9, 0, "Zumba Energy Party", "Zumba", "Camila Ortiz", 60, 30, 0.33),
    (6, 10, 30, "Titan Cross Training", "Cross Training", "Lucas Prado", 60, 16, 0.42),
]

PARAMETROS = {
    "semilla": 2026,
    "escala_demanda": 0.90,  # ajuste para que el promedio mensual quede en el rango de APF2
    "inicio": date(2025, 11, 3),  # lunes
    "fin": date(2026, 10, 31),
    "socios_iniciales": 230,
    "altas_en_el_anio": 170,  # socios nuevos repartidos en el año (verano concentra altas)
    "permanencia_media_meses": 7.0,  # duración media como socio activo de clases
    # Estacionalidad de la demanda (Perú): verano enero–marzo alto; julio y diciembre bajos.
    "estacionalidad": {1: 1.25, 2: 1.25, 3: 1.15, 4: 1.0, 5: 0.95, 6: 0.9,
                       7: 0.85, 8: 0.95, 9: 1.0, 10: 1.0, 11: 1.0, 12: 0.8},
    "prob_cancelar_base": 0.05,
    "prob_recordatorio_activado": 0.82,  # preferencia por defecto = activado
    "cobertura_asistencia": 0.965,  # % de reservas con asistencia registrada por el staff
    "prob_duplicado_export": 0.006,  # filas repetidas por unir exportaciones solapadas
    # Efectos en log-odds sobre la probabilidad de no-show
    "intercepto": -2.45,
    "sd_habito_socio": 0.85,  # heterogeneidad latente entre socios (no observable directamente)
    "efecto_anticipacion": 0.32,  # por cada log2(1 + h/12)
    "efecto_temprano": 0.45,  # clase antes de las 8:00
    "efecto_noche": 0.12,  # clase desde las 19:00
    "efecto_lunes": 0.18,
    "efecto_viernes_tarde": 0.25,
    "efecto_sabado": -0.10,
    "efecto_ocupacion": -0.9,  # por unidad de ocupación (0–1), centrado en 0.35
    "efecto_recordatorio": -0.45,
    "efecto_primera_reserva": 0.40,
    "efecto_socio_nuevo": 0.25,  # primeras 4 semanas como socio
    "efecto_temporada": {12: 0.35, 7: 0.20, 1: -0.20, 2: -0.20, 3: -0.10},
    "efecto_disciplina": {"Yoga": -0.20, "HIIT": 0.10, "Zumba": 0.05},
    "efecto_temprano_x_anticipacion": 0.30,  # interacción: temprano y reservada con > 3 días
}


def _uuid(rng: np.random.Generator) -> str:
    return str(uuid.UUID(bytes=rng.bytes(16), version=4))


def _socio_ref(user_id: str) -> str:
    # Igual que admin_dataset(): SHA-256 del UUID del socio, truncado a 16 hex.
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:16]


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def generar_dataset(p: dict = PARAMETROS) -> pd.DataFrame:
    rng = np.random.default_rng(p["semilla"])
    dias = (p["fin"] - p["inicio"]).days + 1
    disciplinas = sorted({a[4] for a in AGENDA})

    # ---------- Socios: hábito latente, frecuencia, franja y disciplinas preferidas ----------
    n_ini, n_alt = p["socios_iniciales"], p["altas_en_el_anio"]
    n = n_ini + n_alt
    peso_alta = np.array([p["estacionalidad"][(p["inicio"] + timedelta(days=int(d))).month] ** 3
                          for d in range(dias)])
    alta = np.concatenate([
        -rng.integers(30, 720, n_ini),  # ya eran socios antes del periodo
        rng.choice(dias, n_alt, p=peso_alta / peso_alta.sum()),
    ])
    permanencia = rng.exponential(p["permanencia_media_meses"] * 30.4, n) + 45
    baja = alta + permanencia
    socios = pd.DataFrame({
        "user_id": [_uuid(rng) for _ in range(n)],
        "habito": rng.normal(0, p["sd_habito_socio"], n),
        "frecuencia": rng.gamma(2.0, 0.5, n),  # peso relativo de reserva
        "madrugador": rng.random(n) < 0.35,
        "planificador": rng.beta(2, 3, n),  # tendencia a reservar con anticipación
        "recordatorio": rng.random(n) < p["prob_recordatorio_activado"],
        "alta": alta,
        "baja": baja,
    })
    prefs = np.zeros((n, len(disciplinas)))
    for i in range(n):
        fav = rng.choice(len(disciplinas), size=rng.integers(1, 4), replace=False)
        prefs[i, :] = 0.25
        prefs[i, fav] = 1.0
    socios["habito_deriva"] = rng.normal(0, 0.25, n)  # cambia lentamente a lo largo del año

    filas = []
    for d in range(dias):
        dia = p["inicio"] + timedelta(days=d)
        iso = dia.isoweekday()
        mes = dia.month
        activos = np.where((socios["alta"].to_numpy() <= d) & (socios["baja"].to_numpy() > d))[0]
        for (dow, h, m, clase, disc, instr, dur, cap, pop) in AGENDA:
            if dow != iso:
                continue
            inicio = datetime(dia.year, dia.month, dia.day, h, m, tzinfo=LIMA)
            sesion_id = _uuid(rng)
            esperado = cap * pop * p["estacionalidad"][mes] * p["escala_demanda"]
            demanda = int(min(cap, rng.poisson(esperado)))
            if demanda < 2 or len(activos) == 0:
                demanda = max(demanda, 2)
            j = disciplinas.index(disc)
            temprano = h < 8
            w = (socios["frecuencia"].to_numpy()[activos] * prefs[activos, j]
                 * np.where(socios["madrugador"].to_numpy()[activos] == temprano, 1.6, 0.6))
            elegidos = rng.choice(activos, size=min(demanda, len(activos)), replace=False, p=w / w.sum())

            reservas = []
            for i in elegidos:
                plan = socios.at[i, "planificador"]
                # Anticipación: mezcla lognormal truncada a la ventana de 7 días del MVP.
                horas = float(np.exp(rng.normal(np.log(8 + 90 * plan), 0.9)))
                horas = float(np.clip(horas, 0.5, 167.5))
                reserva = inicio - timedelta(hours=horas)
                p_cancel = p["prob_cancelar_base"] + 0.06 * (horas > 72)
                cancelada = rng.random() < p_cancel
                cancelada_en = reserva + (inicio - reserva) * rng.uniform(0.1, 0.98) if cancelada else None
                reservas.append(dict(i=int(i), reserva=reserva, horas=horas, cancelada=cancelada,
                                     cancelada_en=cancelada_en))
            activas = sum(not r["cancelada"] for r in reservas)
            ocup = activas / cap
            for r in reservas:
                i = r["i"]
                semanas_socio = (d - socios.at[i, "alta"]) / 7
                recordatorio = bool(socios.at[i, "recordatorio"] and r["horas"] > 3 and not r["cancelada"])
                filas.append(dict(
                    reserva_id=_uuid(rng), user_id=socios.at[i, "user_id"], sesion_id=sesion_id,
                    clase=clase, disciplina=disc, instructor=instr, inicio=inicio,
                    dia_semana=iso, hora_inicio=h, duracion_min=dur, capacidad=cap,
                    reservas_activas=activas, fecha=r["reserva"], horas=r["horas"],
                    recordatorio_enviado=recordatorio, cancelada=r["cancelada"],
                    cancelada_en=r["cancelada_en"], _i=i, _ocup=ocup, _semanas=semanas_socio,
                    _d=d, _mes=mes, _temprano=temprano,
                ))

    df = pd.DataFrame(filas).sort_values(["inicio", "fecha"]).reset_index(drop=True)

    # ---------- Resultado (asistió / no-show) con historial en orden temporal ----------
    prev_res: dict[str, int] = {}
    prev_abs: dict[str, int] = {}
    asistencia = []
    rp, ip = [], []
    for inicio, grupo in df.groupby("inicio", sort=True):
        # El historial cuenta solo sesiones que empezaron antes (igual que admin_dataset()).
        for idx in grupo.index:
            u = df.at[idx, "user_id"]
            rp.append((idx, prev_res.get(u, 0)))
            ip.append((idx, prev_abs.get(u, 0)))
        resultados = {}
        for idx in grupo.index:
            row = df.loc[idx]
            if row["cancelada"]:
                resultados[idx] = None
                continue
            i = row["_i"]
            p_mes = p["efecto_temporada"].get(row["_mes"], 0.0)
            deriva = socios.at[i, "habito_deriva"] * row["_d"] / dias
            logit = (p["intercepto"] + socios.at[i, "habito"] + deriva
                     + p["efecto_anticipacion"] * np.log2(1 + row["horas"] / 12)
                     + p["efecto_temprano"] * row["_temprano"]
                     + p["efecto_noche"] * (row["hora_inicio"] >= 19)
                     + p["efecto_lunes"] * (row["dia_semana"] == 1)
                     + p["efecto_viernes_tarde"] * (row["dia_semana"] == 5 and row["hora_inicio"] >= 17)
                     + p["efecto_sabado"] * (row["dia_semana"] == 6)
                     + p["efecto_ocupacion"] * (row["_ocup"] - 0.35)
                     + p["efecto_recordatorio"] * row["recordatorio_enviado"]
                     + p["efecto_primera_reserva"] * (prev_res.get(row["user_id"], 0) == 0)
                     + p["efecto_socio_nuevo"] * (0 <= row["_semanas"] < 4)
                     + p_mes
                     + p["efecto_disciplina"].get(row["disciplina"], 0.0)
                     + p["efecto_temprano_x_anticipacion"] * (row["_temprano"] and row["horas"] > 72))
            prob = 1 / (1 + np.exp(-logit))
            no_show = rng.random() < prob
            registrada = rng.random() < p["cobertura_asistencia"]
            resultados[idx] = ("absent" if no_show else "present") if registrada else "pending"
        for idx, res in resultados.items():
            u = df.at[idx, "user_id"]
            prev_res[u] = prev_res.get(u, 0) + 1
            if res == "absent":
                prev_abs[u] = prev_abs.get(u, 0) + 1
            asistencia.append((idx, res))

    df["reservas_previas"] = pd.Series(dict(rp))
    df["inasistencias_previas"] = pd.Series(dict(ip))
    df["asistencia"] = pd.Series(dict(asistencia))

    out = pd.DataFrame({
        "reserva_id": df["reserva_id"],
        "socio_ref": df["user_id"].map(_socio_ref),
        "sesion_id": df["sesion_id"],
        "clase": df["clase"],
        "disciplina": df["disciplina"],
        "instructor": df["instructor"],
        "inicio_sesion": df["inicio"].map(_iso),
        "dia_semana": df["dia_semana"],
        "hora_inicio": df["hora_inicio"],
        "duracion_min": df["duracion_min"],
        "capacidad": df["capacidad"],
        "reservas_activas": df["reservas_activas"],
        "fecha_reserva": df["fecha"].map(_iso),
        "anticipacion_horas": ((df["inicio"] - df["fecha"]).dt.total_seconds() / 3600).round(1),
        "reservas_previas": df["reservas_previas"].astype(int),
        "inasistencias_previas": df["inasistencias_previas"].astype(int),
        "recordatorio_enviado": df["recordatorio_enviado"],
        "estado": np.where(df["cancelada"], "cancelled", "confirmed"),
        "cancelada_en": df["cancelada_en"].map(lambda x: _iso(x) if x is not None and not pd.isna(x) else None),
        "asistencia": df["asistencia"],
        "asistio": df["asistencia"].map({"present": True, "absent": False}),
        "origen": "simulado",
    })
    out.loc[out["estado"] == "cancelled", "asistio"] = None

    # Imperfección realista: exportaciones CSV solapadas producen filas repetidas.
    dup = out.sample(frac=p["prob_duplicado_export"], random_state=p["semilla"])
    out = pd.concat([out, dup]).sort_values(["inicio_sesion", "fecha_reserva"]).reset_index(drop=True)
    return out


if __name__ == "__main__":
    ds = generar_dataset()
    print(ds.shape)
    print(ds.head())
