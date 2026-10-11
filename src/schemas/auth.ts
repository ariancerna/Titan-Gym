import { z } from 'zod';

export const passwordLoginSchema = z.object({
  email: z.string().trim().email('Ingresa un correo válido.').max(254),
  // No impone las reglas de alta a una contraseña existente.
  password: z.string().min(1, 'Ingresa tu contraseña.').max(1024, 'La contraseña es demasiado larga.'),
});
export const createPasswordSchema = z.object({
  password: z.string().min(12, 'Usa al menos 12 caracteres.').max(128, 'Usa como máximo 128 caracteres.'),
  confirmation: z.string(),
}).refine(values => values.password === values.confirmation, { path: ['confirmation'], message: 'Las contraseñas no coinciden.' });
