import { describe, expect, it } from 'vitest';
import { classSchema, sessionSchema, limaInputDate } from '../../src/schemas/admin';
import { safeReturnPath } from '../../src/lib/supabase/magic-link';
import { errorMessage } from '../../src/lib/errors';
const uuid = '10000000-0000-4000-8000-000000000001';
describe('Administración', () => {
  it('valida clase y rechaza nombre o disciplina inválidos', () => {
    const valid = { name: 'Clase nueva', description: 'Entrenamiento de prueba', discipline_id: uuid, image_url: '/assets/1-758/asset-0.png' };
    expect(classSchema.safeParse(valid).success).toBe(true);
    expect(classSchema.safeParse({ ...valid, name: 'A', discipline_id: '' }).success).toBe(false);
  });
  it('convierte fecha UTC a la entrada de Lima', () => { expect(limaInputDate('2030-02-03T18:45:00Z')).toBe('2030-02-03T13:45'); });
  it('rechaza sesiones pasadas y capacidad inválida', () => {
    const valid = { class_id: uuid, instructor_id: uuid, location_id: uuid, room: 'Sala A', starts_at: '2099-01-01T18:00', duration_minutes: 45, capacity: 20, published: true };
    expect(sessionSchema.safeParse(valid).success).toBe(true);
    expect(sessionSchema.safeParse({ ...valid, capacity: 0 }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...valid, starts_at: '2000-01-01T18:00' }).success).toBe(false);
  });
  it('solo permite retorno administrativo exacto', () => { expect(safeReturnPath('/admin')).toBe('/admin'); expect(safeReturnPath('/admin?next=//evil.invalid')).toBe('/mis-reservas'); });
  it('explica denegación y aforo sin exponer SQL', () => { expect(errorMessage(new Error('ADMIN_REQUIRED'))).toContain('permisos'); expect(errorMessage(new Error('CAPACITY_BELOW_RESERVATIONS'))).toContain('reservas activas'); });
});
