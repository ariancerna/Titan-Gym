import { z } from 'zod';
export const memberName = z
  .string()
  .trim()
  .min(3, 'Ingresa tu nombre completo (mínimo 3 caracteres).')
  .max(100, 'El nombre es demasiado largo.')
  .refine((v) => v.split(/\s+/).length >= 2, 'Ingresa nombre y apellido.');
export const profileSchema = z.object({ name: memberName });
export const reservationSchema = z.object({
  name: memberName,
  email: z
    .string()
    .trim()
    .email('Ingresa un correo electrónico válido.')
    .max(254)
    .transform((v) => v.toLowerCase()),
  accepted: z.literal(true, {
    errorMap: () => ({ message: 'Confirma tu asistencia para continuar.' }),
  }),
});
export type ReservationValues = z.infer<typeof reservationSchema>;
