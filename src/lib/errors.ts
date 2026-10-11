export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  if (raw.includes('ADMIN_REQUIRED')) return 'Tu cuenta no tiene permisos de administrador. Solicita acceso al responsable del proyecto.';
  if (raw.includes('CAPACITY_BELOW_RESERVATIONS')) return 'La capacidad no puede ser menor que las reservas activas.';
  if (raw.includes('SESSION_HAS_RESERVATIONS')) return 'Esta sesión tiene reservas. Solo puede modificarse su capacidad; los datos de los comprobantes deben conservarse.';
  if (raw.includes('ATTENDANCE_TOO_EARLY')) return 'La asistencia puede registrarse cuando comienza la sesión.';
  if (raw.includes('RESERVATION_CANCELLED')) return 'No puedes registrar asistencia para una reserva cancelada.';
  if (/INVALID_CLASS|INVALID_IMAGE|INVALID_SESSION|INVALID_ATTENDANCE/.test(raw)) return 'Revisa los campos. Usa una fecha futura y una fotografía del catálogo.';
  if (/duplicate key|23505/.test(raw)) return 'Ya existe una clase con ese nombre o una sesión en esa sala y horario.';
  if (raw.includes('SESSION_FULL')) return 'La clase se llenó mientras completabas tus datos. No se registró la reserva. Elige otra sesión.';
  if (raw.includes('DUPLICATE_RESERVATION')) return 'Ya tienes una reserva activa para esta sesión. Consúltala en Mis reservas.';
  if (raw.includes('AUTH_REQUIRED')) return 'Verifica tu correo para reservar de forma segura.';
  if (raw.includes('EMAIL_MISMATCH')) return 'El correo debe coincidir con el de tu cuenta verificada.';
  if (raw.includes('SESSION_CLOSED')) return 'Esta sesión ya comenzó o no está disponible para reservas.';
  if (raw.includes('INVALID_MEMBER')) return 'Revisa tu nombre y correo electrónico.';
  if (raw.includes('SESSION_NOT_FOUND')) return 'La sesión seleccionada ya no existe.';
  if (raw.includes('agenda aún')) return raw;
  if (/invalid login credentials|invalid_credentials|email not confirmed|email_not_confirmed/i.test(raw)) return 'No pudimos iniciar sesión. Revisa tus datos y confirma que tu cuenta esté verificada; también puedes usar Google o el enlace de acceso.';
  if (/weak password|weak_password|password.*(short|least|strength|contain|long|most)|new password.*different|same_password/i.test(raw)) return 'La contraseña no cumple los requisitos del servicio o coincide con la anterior. Elige una contraseña larga y diferente.';
  if (/reauthentication|reauthenticate|nonce|session.*expired|current_password/i.test(raw)) return 'Para cambiar la contraseña vuelve a iniciar sesión con Google o con tu enlace. Si el servicio exige un código de reautenticación, necesita correo configurado para tu dirección.';
  if (/email.*(not authorized|not allowed)|email_address_not_authorized/i.test(raw)) return 'Este correo no está autorizado para el envío de la demostración gratuita. Usa el correo de tu cuenta del equipo de Supabase. Para socios externos se necesita configurar un proveedor de correo.';
  if (/expired|invalid.*token/i.test(raw)) return 'El enlace no es válido o ha vencido. Solicita uno nuevo.';
  if (/rate limit|too many/i.test(raw)) return 'Espera un momento antes de solicitar otro enlace.';
  return 'No pudimos conectar con la agenda. Comprueba tu conexión e inténtalo de nuevo.';
}
