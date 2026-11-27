import { formatDate, formatTime } from '../../utils/sessions';

/**
 * Enlace de WhatsApp con el mensaje de confirmación ya escrito (recomendación del administrador en la
 * validación del 24/11/2026). El sistema no guarda teléfonos: recepción elige el contacto en WhatsApp.
 */
export function confirmationLink(
  memberName: string,
  session: { name: string; starts_at: string },
): string {
  const firstName = memberName.trim().split(/\s+/)[0] ?? '';
  const text =
    `Hola ${firstName}, te escribimos de TITAN GYM para confirmar tu reserva en ${session.name} ` +
    `el ${formatDate(session.starts_at)} a las ${formatTime(session.starts_at)}. ¿Nos confirmas ` +
    'si vienes? Si no puedes asistir, avísanos para darle tu cupo a otro socio. ¡Gracias!';
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
