import type { ClassSession } from '../types/domain';
export const timezone = 'America/Lima';
export function dateKey(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function dayLabel(value: string, now = new Date()): string {
  if (dateKey(value) === dateKey(now)) return 'Hoy';
  if (dateKey(value) === dateKey(new Date(now.getTime() + 86400000))) return 'Mañana';
  return new Intl.DateTimeFormat('es-PE', { timeZone: timezone, weekday: 'long' }).format(
    new Date(value),
  );
}
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: timezone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
export const formatShortDate = (value: string) =>
  new Intl.DateTimeFormat('es-PE', { timeZone: timezone, day: 'numeric', month: 'short' })
    .format(new Date(value))
    .replace('.', '');
export const formatTime = (value: string) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
export const timeRange = (s: Pick<ClassSession, 'starts_at' | 'duration_minutes'>) =>
  `${formatTime(s.starts_at)} – ${formatTime(new Date(new Date(s.starts_at).getTime() + s.duration_minutes * 60000).toISOString())}`;
export const occupancy = (s: Pick<ClassSession, 'capacity' | 'reserved'>) =>
  Math.min(100, Math.max(0, Math.round((s.reserved / s.capacity) * 100)));
/** Las reservas se abren 7 días antes de la clase. Debe coincidir con private.booking_window(). */
export const bookingWindowDays = 7;
const dayMs = 86400000;
export const bookingOpensAt = (s: Pick<ClassSession, 'starts_at'>) =>
  new Date(new Date(s.starts_at).getTime() - bookingWindowDays * dayMs);

export type BookingState = 'open' | 'full' | 'started' | 'not-open' | 'cancelled';
export function bookingState(s: ClassSession, now = Date.now()): BookingState {
  if (s.cancelled) return 'cancelled';
  if (new Date(s.starts_at).getTime() <= now) return 'started';
  if (bookingOpensAt(s).getTime() > now) return 'not-open';
  return s.available > 0 ? 'open' : 'full';
}
export const isBookable = (s: ClassSession) => bookingState(s) === 'open';
/** En la última hora no se usa la lista de espera. Debe coincidir con private.waitlist_cutoff(). */
export const waitlistCutoffMs = 3600000;
/** Clase llena a la que todavía se puede uno apuntar en la lista de espera. */
export const waitlistOpen = (s: ClassSession, now = Date.now()) =>
  bookingState(s, now) === 'full' && new Date(s.starts_at).getTime() - now > waitlistCutoffMs;
export function filterSessions(
  sessions: ClassSession[],
  search: string,
  discipline: string,
  date: string,
  availability: string,
) {
  const normalize = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  return sessions.filter(
    (s) =>
      normalize(`${s.name} ${s.instructor} ${s.discipline}`).includes(normalize(search)) &&
      (!discipline || s.discipline === discipline) &&
      (!date || dateKey(s.starts_at) === date) &&
      (!availability || (availability === 'available' ? s.available > 0 : s.available === 0)),
  );
}

/** Sesiones futuras ordenadas por hora de inicio. */
export const upcomingSessions = (sessions: ClassSession[], now = Date.now()) =>
  sessions
    .filter((s) => new Date(s.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
/** La próxima sesión de cada clase, en orden de inicio. */
export function nextSessionPerClass(sessions: ClassSession[], now = Date.now()) {
  const seen = new Set<string>();
  return upcomingSessions(sessions, now).filter(
    (s) => !seen.has(s.class_id) && seen.add(s.class_id),
  );
}

const shortWhen = new Intl.DateTimeFormat('es-PE', {
  timeZone: timezone,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
/** «lun 20 oct · 20:00–20:50», el formato compacto del panel de administración. */
export function formatSessionWhen(startsAt: string, durationMinutes: number): string {
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const day = shortWhen.format(start).replace(/\./g, '').replace(',', '');
  return `${day} · ${formatTime(start.toISOString())}–${formatTime(end.toISOString())}`;
}
