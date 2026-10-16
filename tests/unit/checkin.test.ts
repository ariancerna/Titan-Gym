import { describe, expect, it } from 'vitest';
import { classifyScannedCode, reservationCodePattern } from '../../src/features/admin/checkin';

describe('registro de llegada por QR', () => {
  it('acepta el código corto aunque llegue con espacios o en minúsculas', () => {
    expect(classifyScannedCode('  tg-7k4m2q ')).toEqual({ kind: 'code', code: 'TG-7K4M2Q' });
    expect(reservationCodePattern.test('TG-7K4M2Q')).toBe(true);
  });
  it('reconoce los comprobantes con el código largo anterior', () => {
    expect(classifyScannedCode('TG-DDE533FE5BB34ED28C4AED212A90C240').kind).toBe('legacy');
  });
  it('descarta QR que no son comprobantes', () => {
    expect(classifyScannedCode('https://example.com').kind).toBe('foreign');
  });
  it('el código corto no admite caracteres ambiguos', () => {
    expect(reservationCodePattern.test('TG-0OI1AB')).toBe(false);
  });
});
