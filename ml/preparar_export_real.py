"""
Prepara la exportación REAL del panel para el notebook (condición 5 del Proyecto Final).

    python preparar_export_real.py ruta/al/fitsmart-dataset-AAAA-MM-DD.csv --desde 2026-11-27

1. Lee el CSV que descarga el panel /admin → Indicadores → «Exportar dataset CSV».
2. Quita lo que NO es real: las sesiones del script de demostración (id «de000000-…») y las reservas de
   los socios de demostración del seed (sus `socio_ref` se reconocen recalculando el hash). Con
   `--desde` se conservan solo las clases desde la fecha en que el gimnasio empezó a usar el sistema.
3. Anonimiza el nombre del instructor (Instructor 1, 2, …): el modelo no lo usa y es dato del personal.
4. Rotula todo con `origen = real` y lo guarda en data/export_mvp_real.csv, que el notebook carga
   automáticamente para validar el modelo caso por caso (sección 4.4). No se usa para entrenar.

El archivo resultante está excluido de git (.gitignore): no se publica en el repositorio.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parent
DESTINO = BASE / "data" / "export_mvp_real.csv"
COLUMNAS = [
    "reserva_id", "socio_ref", "sesion_id", "clase", "disciplina", "instructor", "inicio_sesion", "dia_semana",
    "hora_inicio", "duracion_min", "capacidad", "reservas_activas", "fecha_reserva", "anticipacion_horas",
    "reservas_previas", "inasistencias_previas", "recordatorio_enviado", "estado", "cancelada_en", "asistencia",
    "asistio",
]
# Socios de demostración del seed: 60000000-0000-4000-8000-000000000001 … (se cubren de sobra 1–999).
SOCIOS_DEMO = {
    hashlib.sha256(f"60000000-0000-4000-8000-{n:012d}".encode()).hexdigest()[:16] for n in range(1, 1000)
}
MINIMO_REALES = 30


def preparar(origen: Path, desde: str | None) -> pd.DataFrame:
    df = pd.read_csv(origen, dtype={"reserva_id": str, "socio_ref": str, "sesion_id": str})
    faltan = [c for c in COLUMNAS if c not in df.columns]
    if faltan:
        sys.exit(f"El archivo no parece una exportación del panel: faltan las columnas {faltan}")
    n0 = len(df)
    simuladas = df["sesion_id"].str.startswith("de000000-")
    demo = df["socio_ref"].isin(SOCIOS_DEMO)
    df = df[~simuladas & ~demo].copy()
    if desde:
        inicio = pd.to_datetime(df["inicio_sesion"], utc=True, format="ISO8601")
        df = df[inicio >= pd.Timestamp(desde, tz="America/Lima")]
    instructores = {n: f"Instructor {i}" for i, n in enumerate(sorted(df["instructor"].dropna().unique()), start=1)}
    df["instructor"] = df["instructor"].map(instructores)
    df["origen"] = "real"
    registradas = df["asistencia"].isin(["present", "absent"]) & df["estado"].ne("cancelled")
    print(f"Filas exportadas: {n0}")
    print(f"  quitadas por ser sesiones simuladas: {int(simuladas.sum())}")
    print(f"  quitadas por ser socios de demostración: {int((demo & ~simuladas).sum())}")
    if desde:
        print(f"  conservadas desde {desde}: {len(df)}")
    print(f"Filas reales: {len(df)} · con asistencia registrada: {int(registradas.sum())} · "
          f"no-shows: {int((df['asistencia'] == 'absent').sum())} · pendientes de registrar: {int((df['asistencia'] == 'pending').sum())}")
    if registradas.sum() < MINIMO_REALES:
        print(f"AVISO: hay menos de {MINIMO_REALES} reservas reales con asistencia registrada. "
              "Registra la asistencia de más clases antes de la entrega (o decláralo en la tabla de trazabilidad).")
    return df[COLUMNAS + ["origen"]]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv", type=Path, help="CSV descargado desde el panel (Indicadores → Exportar dataset CSV)")
    parser.add_argument("--desde", help="Conservar solo clases desde esta fecha (AAAA-MM-DD, hora de Lima)")
    args = parser.parse_args()
    resultado = preparar(args.csv, args.desde)
    DESTINO.parent.mkdir(exist_ok=True)
    resultado.to_csv(DESTINO, index=False)
    print(f"Guardado en {DESTINO.relative_to(BASE)}. Ahora vuelve a ejecutar el notebook completo.")
