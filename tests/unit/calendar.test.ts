import { describe, it, expect } from 'vitest';
import { googleCalendarUrl, icsContent } from '../../src/utils/calendar';

const session = {
  name: 'Power Spinning Extreme',
  starts_at: '2026-10-28T23:00:00Z', // 18:00 en Lima
  duration_minutes: 50,
  room: 'Sala de Ciclismo',
  instructor: 'Carlos Mendoza',
};

describe('agregar la clase al calendario', () => {
  it('Google Calendar recibe título, horas en UTC y la sede', () => {
    const url = new URL(googleCalendarUrl(session, 'TG-ABC123'));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Power Spinning Extreme · TITAN GYM');
    expect(url.searchParams.get('dates')).toBe('20261028T230000Z/20261028T235000Z');
    expect(url.searchParams.get('details')).toContain('TG-ABC123');
    expect(url.searchParams.get('location')).toContain('Carabayllo');
  });
  it('el .ics es válido, escapa comas y avisa una hora antes', () => {
    const ics = icsContent(session, 'TG-ABC123', new Date('2026-10-27T12:00:00Z'));
    const lines = ics.split('\r\n');
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('DTSTART:20261028T230000Z');
    expect(lines).toContain('DTEND:20261028T235000Z');
    expect(lines).toContain('UID:TG-ABC123@titan-gym');
    expect(lines).toContain('TRIGGER:-PT1H');
    expect(ics).toContain('LOCATION:TITAN GYM QATUNA\\, Isabel Chimpu Ocllo cdra 10\\, Carabayllo 15318');
    expect(ics).toContain('\\nSala: Sala de Ciclismo');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
