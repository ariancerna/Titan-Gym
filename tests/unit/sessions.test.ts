import { describe, it, expect } from 'vitest';
import { filterSessions, occupancy, dayLabel, timeRange, isBookable } from '../../src/utils/sessions';
import { reservationSchema } from '../../src/schemas/reservation';
import { errorMessage } from '../../src/lib/errors';
import type { ClassSession } from '../../src/types/domain';
const session: ClassSession = { id: '1', class_id: '1', name: 'HIIT Titan', description: 'Descripción', discipline: 'HIIT', instructor: 'Sofía Herrera', instructor_bio: '', instructor_image: null, image_url: null, location: 'Central', address: '', room: 'Sala', starts_at: '2030-06-15T23:00:00Z', duration_minutes: 45, capacity: 20, reserved: 19, available: 1 };
describe('PF-01 / PF-02 · horarios y cupos', () => {
  it('filtra por instructor sin depender de acentos y combina filtros', () => expect(filterSessions([session], 'sofia', 'HIIT', '2030-06-15', 'available')).toHaveLength(1));
  it('separa las clases completas', () => expect(filterSessions([session, { ...session, available: 0 }], '', '', '', 'full')).toHaveLength(1));
  it('calcula ocupación y muestra el último cupo', () => { expect(occupancy(session)).toBe(95); expect(isBookable(session)).toBe(true); expect(isBookable({ ...session, available: 0 })).toBe(false); });
  it('calcula Hoy/Mañana según Lima incluyendo cambio de mes', () => { expect(dayLabel('2030-07-01T02:00:00Z', new Date('2030-06-30T12:00:00Z'))).toBe('Hoy'); expect(dayLabel('2030-07-01T20:00:00Z', new Date('2030-06-30T12:00:00Z'))).toBe('Mañana'); });
  it('formatea rango horario en Perú', () => expect(timeRange(session)).toBe('18:00 – 18:45'));
});
describe('validación y errores', () => {
  it('valida nombre completo, correo y consentimiento', () => { expect(reservationSchema.safeParse({ name: 'Ana López', email: 'ANA@EXAMPLE.COM', accepted: true }).success).toBe(true); for (const values of [{ name: 'Ana', email: 'ana@example.com', accepted: true }, { name: 'Ana López', email: 'no', accepted: true }, { name: 'Ana López', email: 'ana@example.com', accepted: false }]) expect(reservationSchema.safeParse(values).success).toBe(false); });
  it('traduce aforo, duplicados y conexión sin revelar errores internos', () => { expect(errorMessage({ message: 'SESSION_FULL' })).toContain('No se registró'); expect(errorMessage({ message: 'DUPLICATE_RESERVATION' })).toContain('Ya tienes'); expect(errorMessage(new Error('Failed to fetch'))).toContain('conexión'); });
});
