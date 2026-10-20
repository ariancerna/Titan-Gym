import type { DatasetRow, ManagedSession } from './api';
import { dateKey } from '../../utils/sessions';

const dayMs = 86400000;

export interface WeekPoint {
  /** Lunes de la semana (YYYY-MM-DD, hora de Lima). */
  week: string;
  registered: number;
  absent: number;
  rate: number | null;
}

/** Lunes (en Lima) de la semana de una fecha. */
export function weekStart(iso: string): string {
  const key = dateKey(iso); // fecha en Lima
  const date = new Date(`${key}T12:00:00Z`);
  const weekday = (date.getUTCDay() + 6) % 7; // 0 = lunes
  return new Date(date.getTime() - weekday * dayMs).toISOString().slice(0, 10);
}

/** Tasa de no-shows por semana, solo con asistencias registradas y sin cancelaciones. */
export function weeklyNoShows(rows: DatasetRow[]): WeekPoint[] {
  const weeks = new Map<string, { registered: number; absent: number }>();
  for (const row of rows) {
    if (row.estado === 'cancelled' || row.asistio === null) continue;
    const week = weekStart(row.inicio_sesion);
    const entry = weeks.get(week) ?? { registered: 0, absent: 0 };
    entry.registered += 1;
    if (row.asistio === false) entry.absent += 1;
    weeks.set(week, entry);
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({ week, ...v, rate: v.registered ? v.absent / v.registered : null }));
}

export interface TodaySummary {
  sessions: number;
  reserved: number;
  present: number;
  waiting: number;
}

/** Sesiones de hoy (en Lima) no canceladas, con sus reservas, llegadas y lista de espera. */
export function todaySummary(sessions: ManagedSession[], now = new Date()): TodaySummary {
  const today = dateKey(now);
  const list = sessions.filter((s) => !s.cancelled_at && dateKey(s.starts_at) === today);
  return {
    sessions: list.length,
    reserved: list.reduce((n, s) => n + s.reserved, 0),
    present: list.reduce((n, s) => n + s.present, 0),
    waiting: list.reduce((n, s) => n + s.waiting, 0),
  };
}

/** Tasa de no-shows de los últimos 30 días. */
export function recentNoShowRate(rows: DatasetRow[], now = Date.now()): number | null {
  const recent = rows.filter(
    (r) =>
      r.estado !== 'cancelled' &&
      r.asistio !== null &&
      now - new Date(r.inicio_sesion).getTime() <= 30 * dayMs,
  );
  return recent.length ? recent.filter((r) => r.asistio === false).length / recent.length : null;
}

/** Ocupación promedio de las próximas sesiones no canceladas. */
export function upcomingOccupancy(sessions: ManagedSession[], now = Date.now()): number | null {
  const next = sessions.filter((s) => !s.cancelled_at && new Date(s.starts_at).getTime() > now);
  const capacity = next.reduce((n, s) => n + s.capacity, 0);
  return capacity ? next.reduce((n, s) => n + s.reserved, 0) / capacity : null;
}

/** Agrupa sesiones por día (en Lima) conservando el orden recibido. */
export function groupByDay<T extends { starts_at: string }>(sessions: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const s of sessions) {
    const key = dateKey(s.starts_at);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.entries()];
}
