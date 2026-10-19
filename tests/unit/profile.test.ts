import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { hasPassword } from '../../src/features/auth/password';
import { savedName, signInMethods } from '../../src/features/auth/profile';

const user = (app_metadata: Record<string, unknown>, user_metadata: Record<string, unknown> = {}) =>
  ({ id: 'u1', aud: 'authenticated', created_at: '', app_metadata, user_metadata }) as User;

describe('Mi perfil', () => {
  it('solo reconoce la marca explícita de contraseña', () => {
    expect(hasPassword(user({}, { has_password: true }))).toBe(true);
    expect(hasPassword(user({}, { has_password: 'true' }))).toBe(false);
    expect(hasPassword(user({}))).toBe(false);
    expect(hasPassword(null)).toBe(false);
  });
  it('lista las formas de entrar de la cuenta', () => {
    expect(signInMethods(user({ providers: ['google'] }), false)).toEqual(['Google']);
    expect(signInMethods(user({ providers: ['email'] }), true)).toEqual(['Correo y contraseña', 'Enlace al correo']);
    expect(signInMethods(user({ provider: 'google' }), true)).toEqual(['Google', 'Correo y contraseña']);
  });
  it('usa el nombre guardado o el que aporta Google', () => {
    expect(savedName(user({}, { full_name: 'Ana López' }))).toBe('Ana López');
    expect(savedName(user({}, { full_name: 42 }))).toBe('');
    expect(savedName(null)).toBe('');
  });
});
