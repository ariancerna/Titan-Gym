import type { ClassSession } from '../types/domain';
export const timezone = 'America/Lima';
export function dateKey(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export function dayLabel(value: string, now = new Date()): string {
  if (dateKey(value) === dateKey(now)) return 'Hoy';
  if (dateKey(value) === dateKey(new Date(now.getTime() + 86400000))) return 'Mañana';
  return new Intl.DateTimeFormat('es-PE', { timeZone: timezone, weekday: 'long' }).format(new Date(value));
}
export const formatDate = (value: string) => new Intl.DateTimeFormat('es-PE', { timeZone: timezone, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
export const formatTime = (value: string) => new Intl.DateTimeFormat('es-PE', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
export const timeRange = (s: ClassSession) => `${formatTime(s.starts_at)} – ${formatTime(new Date(new Date(s.starts_at).getTime() + s.duration_minutes * 60000).toISOString())}`;
export const occupancy = (s: Pick<ClassSession, 'capacity' | 'reserved'>) => Math.min(100, Math.max(0, Math.round(s.reserved / s.capacity * 100)));
export const isBookable = (s: ClassSession) => s.available > 0 && new Date(s.starts_at).getTime() > Date.now();
export const disciplines = ['Spinning', 'HIIT', 'Funcional', 'Zumba', 'Yoga', 'Cross Training'];
export function filterSessions(sessions: ClassSession[], search: string, discipline: string, date: string, availability: string) {
  const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return sessions.filter(s => normalize(`${s.name} ${s.instructor} ${s.discipline}`).includes(normalize(search)) && (!discipline || s.discipline === discipline) && (!date || dateKey(s.starts_at) === date) && (!availability || (availability === 'available' ? s.available > 0 : s.available === 0)));
}
