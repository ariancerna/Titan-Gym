import { describe, it, expect } from 'vitest';
import { filterSessions, occupancy, dayLabel, timeRange, isBookable } from '../../src/utils/sessions';
import { reservationSchema } from '../../src/schemas/reservation';
import { errorMessage } from '../../src/lib/errors';
import type { ClassSession } from '../../src/types/domain';
const session: ClassSession = { id: '1', class_id: '1', name: 'HIIT Titan', description: 'Descripción', discipline: 'HIIT', instructor: 'Sofía Herrera', instructor_bio: '', instructor_image: null, image_url: null, location: 'Central', address: '', room: 'Sala', starts_at: '2030-06-15T23:00:00Z', duration_minutes: 45, capacity: 20, reserved: 19, available: 1 };
describe('PF-01 / PF-02 · horarios y cupos', () => {
  it('filtra por instructor sin depender de acentos y combina filtros', () => expect(filterSessions([session], 'sofia', 'HIIT', '2030-06-15', 'available')).toHaveLength(1));
  it('separa las clases completas', () => expect(filterSessions([session, { ...session, available: 0 }], '', '', '', 'full')).toHaveLength(1));
  it('calcula ocupación y muestra el último cupo', () => { expect(occupancy(session)).toBe(95); const tomorrow = { ...session, starts_at: new Date(Date.now() + 86400000).toISOString() }; expect(isBookable(tomorrow)).toBe(true); expect(isBookable({ ...tomorrow, available: 0 })).toBe(false); expect(isBookable(session)).toBe(false); });
  it('calcula Hoy/Mañana según Lima incluyendo cambio de mes', () => { expect(dayLabel('2030-07-01T02:00:00Z', new Date('2030-06-30T12:00:00Z'))).toBe('Hoy'); expect(dayLabel('2030-07-01T20:00:00Z', new Date('2030-06-30T12:00:00Z'))).toBe('Mañana'); });
  it('formatea rango horario en Perú', () => expect(timeRange(session)).toBe('18:00 – 18:45'));
});
describe('validación y errores', () => {
  it('valida nombre completo, correo y consentimiento', () => { expect(reservationSchema.safeParse({ name: 'Ana López', email: 'ANA@EXAMPLE.COM', accepted: true }).success).toBe(true); for (const values of [{ name: 'Ana', email: 'ana@example.com', accepted: true }, { name: 'Ana López', email: 'no', accepted: true }, { name: 'Ana López', email: 'ana@example.com', accepted: false }]) expect(reservationSchema.safeParse(values).success).toBe(false); });
  it('traduce aforo, duplicados y conexión sin revelar errores internos', () => { expect(errorMessage({ message: 'SESSION_FULL' })).toContain('No se registró'); expect(errorMessage({ message: 'DUPLICATE_RESERVATION' })).toContain('Ya tienes'); expect(errorMessage(new Error('Failed to fetch'))).toContain('conexión'); });
});

describe('ventana de reservas de 7 días', async () => {
  const { bookingState, bookingOpensAt } = await import('../../src/utils/sessions');
  const now = new Date('2026-10-16T12:00:00Z').getTime();
  const at = (days: number, available = 5) =>
    ({ starts_at: new Date(now + days * 86400000).toISOString(), available, capacity: 10, reserved: 10 - available }) as never;
  it('abre la reserva solo dentro de los 7 días previos', () => {
    expect(bookingState(at(3), now)).toBe('open');
    expect(bookingState(at(10), now)).toBe('not-open');
    expect(bookingState(at(3, 0), now)).toBe('full');
    expect(bookingState(at(-1), now)).toBe('started');
  });
  it('calcula la fecha de apertura', () => {
    expect(bookingOpensAt(at(10)).getTime()).toBe(now + 3 * 86400000);
  });
});
