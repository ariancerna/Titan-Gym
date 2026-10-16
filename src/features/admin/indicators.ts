import type { DatasetRow } from './api';

export interface ClassIndicator {
  clase: string;
  registradas: number;
  ausentes: number;
  tasaNoShow: number | null;
}

export interface AttendanceSummary {
  reservas: number;
  canceladas: number;
  presentes: number;
  ausentes: number;
  sinRegistrar: number;
  /** Ausentes sin cancelar / asistencias registradas. Indicador principal del proyecto. */
  tasaNoShow: number | null;
  /** Reservas no canceladas con asistencia registrada. Mide la calidad del dataset. */
  cobertura: number | null;
  porClase: ClassIndicator[];
  /** Tasa de no-shows de las reservas que recibieron recordatorio y de las que no (HU07). */
  conRecordatorio: number | null;
  sinRecordatorio: number | null;
}

const ratio = (part: number, total: number) => (total > 0 ? part / total : null);

export function summarizeAttendance(rows: DatasetRow[]): AttendanceSummary {
  const active = rows.filter((r) => r.estado !== 'cancelled');
  const presentes = active.filter((r) => r.asistio === true).length;
  const ausentes = active.filter((r) => r.asistio === false).length;
  const byClass = new Map<string, { registradas: number; ausentes: number }>();
  for (const row of active) {
    if (row.asistio === null) continue;
    const entry = byClass.get(row.clase) ?? { registradas: 0, ausentes: 0 };
    entry.registradas += 1;
    if (!row.asistio) entry.ausentes += 1;
    byClass.set(row.clase, entry);
  }
  const noShowRate = (subset: DatasetRow[]) => {
    const registered = subset.filter((r) => r.asistio !== null);
    return ratio(registered.filter((r) => r.asistio === false).length, registered.length);
  };
  return {
    conRecordatorio: noShowRate(active.filter((r) => r.recordatorio_enviado)),
    sinRecordatorio: noShowRate(active.filter((r) => !r.recordatorio_enviado)),
    reservas: rows.length,
    canceladas: rows.length - active.length,
    presentes,
    ausentes,
    sinRegistrar: active.length - presentes - ausentes,
    tasaNoShow: ratio(ausentes, presentes + ausentes),
    cobertura: ratio(presentes + ausentes, active.length),
    porClase: [...byClass.entries()]
      .map(([clase, v]) => ({ clase, ...v, tasaNoShow: ratio(v.ausentes, v.registradas) }))
      .sort((a, b) => (b.tasaNoShow ?? 0) - (a.tasaNoShow ?? 0) || a.clase.localeCompare(b.clase)),
  };
}

export const formatPercent = (value: number | null) =>
  value === null ? '—' : `${Math.round(value * 100)}%`;

const columns: (keyof DatasetRow)[] = [
  'reserva_id',
  'socio_ref',
  'sesion_id',
  'clase',
  'disciplina',
  'instructor',
  'inicio_sesion',
  'dia_semana',
  'hora_inicio',
  'duracion_min',
  'capacidad',
  'reservas_activas',
  'fecha_reserva',
  'anticipacion_horas',
  'reservas_previas',
  'inasistencias_previas',
  'recordatorio_enviado',
  'estado',
  'cancelada_en',
  'asistencia',
  'asistio',
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Evita que Excel interprete nombres de clase como fórmulas (CSV injection).
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function datasetToCsv(rows: DatasetRow[]): string {
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(',')),
  ];
  return lines.join('\r\n');
}
