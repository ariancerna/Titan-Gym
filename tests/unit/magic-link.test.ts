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
  it('permite volver a la página de nueva contraseña tras el enlace de recuperación', () => {
    expect(safeReturnPath('/restablecer-contrasena')).toBe('/restablecer-contrasena');
    expect(safeReturnPath('/restablecer-contrasena?next=//evil.invalid')).toBe('/mis-reservas');
  });
  it('distingue un fallo de envío de correo de un problema de conexión', () => {
    expect(errorMessage({ message: 'Error sending confirmation email', code: 'unexpected_failure' })).toContain('No pudimos enviar el correo');
    expect(errorMessage({ message: 'email rate limit exceeded', code: 'over_email_send_rate_limit' })).toContain('Espera unos minutos');
    expect(errorMessage({ message: 'User already registered', code: 'user_already_exists' })).toContain('Ya existe una cuenta');
    expect(errorMessage(new Error('Invalid login credentials'))).toContain('No pudimos iniciar sesión');
  });
});
