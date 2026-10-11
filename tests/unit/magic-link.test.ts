import { describe, it, expect, beforeEach } from 'vitest';
import { safeReturnPath, rememberReturnPath, consumeReturnPath } from '../../src/lib/supabase/magic-link';
import { errorMessage } from '../../src/lib/errors';

describe('retorno seguro del enlace mágico', () => {
  beforeEach(() => localStorage.clear());
  it('continúa la sesión seleccionada', () => {
    const path = '/reservar/50000000-0000-4000-8000-000000000007';
    rememberReturnPath(path);
    expect(consumeReturnPath()).toBe(path);
    expect(consumeReturnPath()).toBe('/mis-reservas');
  });
  it.each(['https://evil.invalid', '//evil.invalid', '/\\evil.invalid', '/auth/confirm', '/reservar/x', '/mis-reservas?next=https://evil.invalid'])('rechaza redirección arbitraria: %s', path => {
    expect(safeReturnPath(path)).toBe('/mis-reservas');
  });
  it('explica la restricción de destinatarios del plan gratuito', () => {
    expect(errorMessage(new Error('Email address not authorized'))).toContain('no está autorizado');
  });
});
