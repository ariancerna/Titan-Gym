import { z } from 'zod';

const email = z.string().trim().email('Ingresa un correo válido.').max(254);

const newPassword = z
  .string()
  .min(12, 'Usa al menos 12 caracteres.')
  .max(128, 'Usa como máximo 128 caracteres.');

const passwordsMatch = (values: { password: string; confirmation: string }) =>
  values.password === values.confirmation;
const mismatch = { path: ['confirmation'], message: 'Las contraseñas no coinciden.' };

export const passwordLoginSchema = z.object({
  email,
  // No impone las reglas de alta a una contraseña existente.
  password: z
    .string()
    .min(1, 'Ingresa tu contraseña.')
    .max(1024, 'La contraseña es demasiado larga.'),
});

export const createPasswordSchema = z
  .object({ password: newPassword, confirmation: z.string() })
  .refine(passwordsMatch, mismatch);

export const signUpSchema = z
  .object({
    email,
    password: newPassword,
    confirmation: z.string(),
    privacy: z
      .boolean()
      .refine((accepted) => accepted, 'Acepta la política de privacidad para crear la cuenta.'),
  })
  .refine(passwordsMatch, mismatch);

export const emailOnlySchema = z.object({ email });
