import type { ClassSession } from '../types/domain';
import { gym } from '../content/gym';

type CalendarSession = Pick<
  ClassSession,
  'name' | 'starts_at' | 'duration_minutes' | 'room' | 'instructor'
>;

/** 2026-10-28T23:30:00.000Z → 20261028T233000Z (formato de calendarios). */
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

function range(s: CalendarSession) {
  const start = new Date(s.starts_at);
  const end = new Date(start.getTime() + s.duration_minutes * 60000);
  return { start, end };
}

const title = (s: CalendarSession) => `${s.name} · ${gym.name}`;
const details = (s: CalendarSession, code: string) =>
  `Instructor: ${s.instructor}\nSala: ${s.room}\nCódigo de reserva: ${code}\nLlega 10 minutos antes y muestra tu QR en recepción.`;
const location = `${gym.branch}, ${gym.address}`;

/** Enlace que abre Google Calendar con el evento ya completado. */
export function googleCalendarUrl(s: CalendarSession, code: string) {
  const { start, end } = range(s);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title(s),
    dates: `${stamp(start)}/${stamp(end)}`,
    details: details(s, code),
    location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Escapa texto para iCalendar (RFC 5545). */
const escapeIcs = (v: string) =>
  v
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');

/** Archivo .ics para Apple Calendar, Outlook y otros. Incluye un aviso 1 hora antes. */
export function icsContent(s: CalendarSession, code: string, now = new Date()) {
  const { start, end } = range(s);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TITAN GYM//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${code}@titan-gym`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeIcs(title(s))}`,
    `DESCRIPTION:${escapeIcs(details(s, code))}`,
    `LOCATION:${escapeIcs(location)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(title(s))}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
