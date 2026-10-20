import type { DatasetRow } from './api';

/**
 * Riesgo de no-show por reglas: cada factor suma puntos y el total da el nivel. No es un modelo
 * entrenado; es una línea base explicable que la pestaña Indicadores contrasta con lo que pasó
 * en las clases ya dictadas (ver docs/RIESGO_NOSHOW.md).
 */
export type RiskLevel = 'bajo' | 'medio' | 'alto';

export interface RiskFactors {
  /** Reservas del socio en sesiones anteriores a esta (incluye canceladas, como el dataset). */
  priorReservations: number;
  /** De esas, en cuántas quedó ausente sin cancelar. */
  priorAbsences: number;
  /** Horas entre la reserva y el inicio de la clase. */
  hoursAhead: number;
  /** Hora de inicio en Lima (0–23). */
  startHour: number;
}

export interface Risk {
  level: RiskLevel;
  points: number;
  reasons: string[];
}

export const RISK_RULES = {
  /** Faltas previas para considerarlo inasistente habitual... */
  habitualAbsences: 2,
  /** ...si además faltó a esta proporción de sus reservas anteriores. */
  habitualRate: 0.3,
  /** Reservar con más anticipación que esto se asocia a olvidar la clase. */
  longAdvanceHours: 72,
  /** Clases que empiezan antes de esta hora. */
  earlyHour: 8,
} as const;

export function noShowRisk(f: RiskFactors): Risk {
  const reasons: string[] = [];
  let points = 0;
  const { priorAbsences: absences, priorReservations: total } = f;
  if (
    absences >= RISK_RULES.habitualAbsences &&
    total > 0 &&
    absences / total >= RISK_RULES.habitualRate
  ) {
    points += 3;
    reasons.push(`Faltó sin avisar a ${absences} de sus ${total} reservas anteriores`);
  } else if (absences >= 1) {
    points += 1;
    reasons.push(
      absences === 1 ? 'Faltó sin avisar una vez' : `Faltó sin avisar ${absences} veces`,
    );
  }
  if (total === 0) {
    points += 1;
    reasons.push('Es su primera reserva');
  }
  if (f.hoursAhead > RISK_RULES.longAdvanceHours) {
    points += 1;
    reasons.push(`Reservó con ${Math.round(f.hoursAhead / 24)} días de anticipación`);
  }
  if (f.startHour < RISK_RULES.earlyHour) {
    points += 1;
    reasons.push(`Clase antes de las ${RISK_RULES.earlyHour}:00`);
  }
  const level: RiskLevel = points >= 3 ? 'alto' : points === 2 ? 'medio' : 'bajo';
  return { level, points, reasons };
}

export const limaHour = (iso: string) =>
  Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'America/Lima',
    }).format(new Date(iso)),
  );

export const riskFromDatasetRow = (row: DatasetRow) =>
  noShowRisk({
    priorReservations: row.reservas_previas,
    priorAbsences: row.inasistencias_previas,
    hoursAhead: row.anticipacion_horas,
    startHour: row.hora_inicio,
  });

export interface RiskBacktestRow {
  level: RiskLevel;
  registered: number;
  absent: number;
  rate: number | null;
}

/**
 * Aplica la regla a las reservas pasadas con asistencia registrada y compara cada nivel con lo
 * que ocurrió. La regla solo usa datos anteriores a cada clase, así que no "ve" el resultado.
 */
export function riskBacktest(rows: DatasetRow[]): RiskBacktestRow[] {
  const levels: RiskLevel[] = ['bajo', 'medio', 'alto'];
  const acc = new Map(levels.map((l) => [l, { registered: 0, absent: 0 }]));
  for (const row of rows) {
    if (row.asistio === null) continue;
    const bucket = acc.get(riskFromDatasetRow(row).level)!;
    bucket.registered++;
    if (row.asistio === false) bucket.absent++;
  }
  return levels.map((level) => {
    const { registered, absent } = acc.get(level)!;
    return { level, registered, absent, rate: registered ? absent / registered : null };
  });
}
