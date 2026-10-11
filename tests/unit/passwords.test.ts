import { describe, expect, it } from 'vitest';
import { createPasswordSchema, passwordLoginSchema } from '../../src/schemas/auth';
import { errorMessage } from '../../src/lib/errors';

describe('contraseñas y validación', () => {
  it('valida longitud y repetición para crear una contraseña', () => {
    expect(createPasswordSchema.safeParse({ password: 'corta', confirmation: 'corta' }).success).toBe(false);
    expect(createPasswordSchema.safeParse({ password: 'frase de prueba larga', confirmation: 'otra frase' }).success).toBe(false);
    expect(createPasswordSchema.safeParse({ password: 'frase de prueba larga', confirmation: 'frase de prueba larga' }).success).toBe(true);
    expect(createPasswordSchema.safeParse({ password: 'a'.repeat(129), confirmation: 'a'.repeat(129) }).success).toBe(false);
  });
  it('no recorta contraseñas ni aplica requisitos nuevos al inicio existente', () => {
    const result = passwordLoginSchema.parse({ email: ' test@example.com ', password: ' abc ' });
    expect(result.password).toBe(' abc ');
    expect(result.email).toBe('test@example.com');
  });
  it('rechaza campos vacíos y correo inválido', () => {
    expect(passwordLoginSchema.safeParse({ email: 'x', password: '' }).success).toBe(false);
  });
  it('no revela si un correo existe al rechazar credenciales', () => {
    expect(errorMessage(new Error('Invalid login credentials'))).toContain('No pudimos iniciar sesión');
    expect(errorMessage(new Error('Email not confirmed'))).toContain('No pudimos iniciar sesión');
  });
});
