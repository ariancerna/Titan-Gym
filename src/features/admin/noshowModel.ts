import modelo from './noshow-model.json';
import type { DatasetRow } from './api';
import type { RiskLevel } from './risk';

/**
 * Modelo de Machine Learning de no-show (APF3): regresión logística entrenada en
 * ml/APF3_TD_Grupo6_ML_Innovacion.ipynb y exportada a noshow-model.json. Aquí se reproduce el mismo
 * pipeline de scikit-learn (variables derivadas → imputación → escalado / one-hot → sigmoide) para
 * calcular la probabilidad en el navegador del administrador, sin servidor ni costo adicional.
 * tests/unit/noshow-model.test.ts comprueba que el resultado coincide con scikit-learn.
 */

/** Campos que el MVP ya captura por reserva (mismos nombres que admin_dataset()). */
export interface NoShowInput {
  disciplina: string;
  inicio_sesion: string;
  dia_semana: number;
  hora_inicio: number;
  duracion_min: number;
  capacidad: number;
  reservas_activas: number;
  anticipacion_horas: number;
  reservas_previas: number;
  inasistencias_previas: number;
  /** null cuando no se sabe (p. ej. falta aplicar la migración): se imputa como en el entrenamiento. */
  recordatorio_enviado: boolean | null;
}

export interface NoShowPrediction {
  probability: number;
  level: RiskLevel;
}

export const noShowModelInfo = {
  version: modelo.version,
  name: modelo.modelo,
  contactThreshold: modelo.umbral_contacto,
  highThreshold: modelo.umbral_alto,
  data: modelo.datos,
};

// Lima está en UTC−5 todo el año (sin horario de verano).
const inLima = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3600000);
const limaMonth = (iso: string) => inLima(iso).getUTCMonth() + 1;
/** Día ISO en Lima: 1 = lunes … 7 = domingo (igual que dia_semana de admin_dataset()). */
export const limaWeekday = (iso: string) => ((inLima(iso).getUTCDay() + 6) % 7) + 1;

function timeBand(hour: number) {
  // Mismos cortes que pd.cut(bins=[-1, 7, 11, 17, 23]) en titan_noshow.py.
  if (hour <= 7) return 'temprano';
  if (hour <= 11) return 'manana';
  if (hour <= 17) return 'tarde';
  return 'noche';
}

function season(month: number) {
  if (month >= 1 && month <= 3) return 'verano';
  if (month === 7 || month === 12) return 'fiestas';
  return 'regular';
}

/** Variables derivadas, igual que CaracteristicasNoShow en ml/titan_noshow.py. */
export function noShowFeatures(x: NoShowInput) {
  const hours = x.anticipacion_horas;
  const prior = x.reservas_previas;
  const absences = x.inasistencias_previas;
  const numeric: Record<string, number> = {
    log_anticipacion: Math.log1p(Math.max(hours, 0)),
    reserva_mismo_dia: hours <= 12 ? 1 : 0,
    ocupacion: x.reservas_activas / x.capacidad,
    tasa_inasistencia_suavizada:
      (absences + modelo.prior_no_show * modelo.k_suavizado) / (prior + modelo.k_suavizado),
    inasistencias_previas: absences,
    log_reservas_previas: Math.log1p(prior),
    es_primera_reserva: prior === 0 ? 1 : 0,
    recordatorio_enviado:
      x.recordatorio_enviado === null ? Number.NaN : x.recordatorio_enviado ? 1 : 0,
    duracion_min: x.duracion_min,
    capacidad: x.capacidad,
  };
  const categorical: Record<string, string> = {
    disciplina: x.disciplina,
    franja_horaria: timeBand(x.hora_inicio),
    dia_semana: String(x.dia_semana),
    temporada: season(limaMonth(x.inicio_sesion)),
  };
  return { numeric, categorical };
}

export function noShowLevel(probability: number): RiskLevel {
  if (probability >= modelo.umbral_alto) return 'alto';
  if (probability >= modelo.umbral_contacto) return 'medio';
  return 'bajo';
}

export function predictNoShow(x: NoShowInput): NoShowPrediction {
  const { numeric, categorical } = noShowFeatures(x);
  const values: number[] = [];
  for (const n of modelo.numericas) {
    const raw = numeric[n.nombre];
    const value = Number.isFinite(raw) ? raw : n.imputacion; // SimpleImputer(median)
    values.push((value - n.media) / n.escala); // StandardScaler
  }
  for (const c of modelo.categoricas) {
    const value = categorical[c.nombre] ?? c.imputacion;
    // OneHotEncoder(handle_unknown="ignore"): una categoría desconocida deja todo en 0.
    for (const category of c.categorias) values.push(category === value ? 1 : 0);
  }
  const z = values.reduce((sum, v, i) => sum + v * modelo.coeficientes[i], modelo.intercepto);
  const probability = 1 / (1 + Math.exp(-z));
  return { probability, level: noShowLevel(probability) };
}

export const predictFromDatasetRow = (row: DatasetRow) =>
  predictNoShow({
    disciplina: row.disciplina,
    inicio_sesion: row.inicio_sesion,
    dia_semana: row.dia_semana,
    hora_inicio: row.hora_inicio,
    duracion_min: row.duracion_min,
    capacidad: row.capacidad,
    reservas_activas: row.reservas_activas,
    anticipacion_horas: row.anticipacion_horas,
    reservas_previas: row.reservas_previas,
    inasistencias_previas: row.inasistencias_previas,
    recordatorio_enviado: row.recordatorio_enviado ?? null,
  });

/** Recordatorio por correo: enviado, o programado si el socio lo tiene activo y aún faltan > 3 h. */
export function reminderStatus(
  member: { reminder_sent_at?: string | null; email_reminders?: boolean },
  startsAt: string,
  bookedAt: string,
  now = Date.now(),
): boolean | null {
  if (member.reminder_sent_at) return true;
  if (member.email_reminders === undefined) return null; // migración 20261113 sin aplicar
  const start = new Date(startsAt).getTime();
  const bookedAhead = (start - new Date(bookedAt).getTime()) / 3600000 > 3;
  const stillScheduled = start - now > 3 * 3600000;
  return member.email_reminders && bookedAhead && stillScheduled;
}
