import { z } from 'zod';
export const classSchema = z.object({
  name: z.string().trim().min(3, 'Ingresa al menos 3 caracteres.').max(100),
  description: z.string().trim().min(10, 'Describe la clase con al menos 10 caracteres.').max(3000),
  discipline_id: z.string().uuid('Selecciona una disciplina.'),
  image_url: z.string().regex(/^\/assets\/[a-zA-Z0-9/_ .-]+\.(png|jpg|jpeg|webp)$/, 'Selecciona una fotografía de TITAN GYM.'),
});
export const sessionSchema = z.object({
  class_id: z.string().uuid('Selecciona una clase.'), instructor_id: z.string().uuid('Selecciona un instructor.'),
  location_id: z.string().uuid('Selecciona una sede.'), room: z.string().trim().min(2, 'Indica la sala.').max(80),
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Ingresa fecha y hora.').refine(v => new Date(`${v}:00-05:00`).getTime() > Date.now(), 'Selecciona una fecha futura.'),
  capacity: z.coerce.number().int().min(1, 'Debe haber al menos un cupo.').max(500, 'Máximo 500 cupos.'),
  duration_minutes: z.coerce.number().int().min(10, 'Mínimo 10 minutos.').max(240, 'Máximo 240 minutos.'),
  published: z.boolean(),
});
export const limaInputDate = (date: string) => {
  const d = new Date(new Date(date).getTime() - 5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
};
