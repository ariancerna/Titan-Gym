export function errorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : '';
  // Supabase Auth informa la causa también en `code` (p. ej. over_email_send_rate_limit).
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const raw = `${message} ${code}`;
  // En desarrollo se registra el error original para diagnosticar; al usuario nunca se le muestra.
  if (import.meta.env.DEV && error) console.error(error);
  if (/error sending|smtp|unexpected_failure/i.test(raw))
    return 'No pudimos enviar el correo en este momento. Inténtalo de nuevo en unos minutos o ingresa con Google.';
  if (/already registered|user_already_exists|email_exists/i.test(raw))
    return 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.';
  if (/signups? not allowed|signup_disabled/i.test(raw))
    return 'El registro de cuentas nuevas no está disponible por ahora.';
  if (/email_address_invalid|invalid.*email|unable to validate email/i.test(raw))
    return 'Revisa el correo electrónico: no parece una dirección válida.';
  if (raw.includes('PRIVACY_CONSENT_REQUIRED'))
    return 'Acepta la política de privacidad para registrar la reserva.';
  if (raw.includes('PRIVACY_VERSION_OUTDATED'))
    return 'La política de privacidad se actualizó. Recarga la página y vuelve a aceptarla.';
  if (raw.includes('ADMIN_REQUIRED'))
    return 'Tu cuenta no tiene permisos de administrador. Solicita acceso al responsable del proyecto.';
  if (raw.includes('CAPACITY_BELOW_RESERVATIONS'))
    return 'La capacidad no puede ser menor que las reservas activas.';
  if (raw.includes('SESSION_HAS_RESERVATIONS'))
    return 'Esta sesión tiene reservas. Solo puede modificarse su capacidad; los datos de los comprobantes deben conservarse.';
  if (raw.includes('ATTENDANCE_TOO_EARLY'))
    return 'La asistencia puede registrarse cuando comienza la sesión.';
  if (raw.includes('BOOKING_NOT_OPEN'))
    return 'Las reservas para esta clase todavía no están abiertas: se abren 7 días antes del inicio.';
  if (raw.includes('CODE_NOT_FOUND'))
    return 'No existe una reserva con ese código. Revisa que esté bien escrito.';
  if (raw.includes('CHECKIN_TOO_EARLY'))
    return 'Todavía es pronto: la llegada se registra desde 1 hora antes del inicio de la clase.';
  if (raw.includes('CHECKIN_CLOSED'))
    return 'La clase ya terminó. Corrige la asistencia desde «Ver inscritos».';
  if (raw.includes('CANCEL_TOO_LATE'))
    return 'La clase ya comenzó. Solo puedes cancelar antes de la hora de inicio.';
  if (raw.includes('RESERVATION_NOT_FOUND'))
    return 'No encontramos esa reserva en tu cuenta. Actualiza la página e inténtalo de nuevo.';
  if (raw.includes('RESERVATION_CANCELLED'))
    return 'No puedes registrar asistencia para una reserva cancelada.';
  if (/INVALID_CLASS|INVALID_IMAGE|INVALID_SESSION|INVALID_ATTENDANCE/.test(raw))
    return 'Revisa los campos. Usa una fecha futura y una fotografía del catálogo.';
  if (/duplicate key|23505/.test(raw))
    return 'Ya existe una clase con ese nombre o una sesión en esa sala y horario.';
  if (raw.includes('SESSION_FULL'))
    return 'La clase se llenó mientras completabas tus datos. No se registró la reserva. Elige otra sesión.';
  if (raw.includes('SESSION_HAS_SEATS'))
    return 'Se liberó un cupo en esta clase: ya puedes reservarla directamente.';
  if (raw.includes('ALREADY_WAITING'))
    return 'Ya estás en la lista de espera de esta clase. Consulta tu posición en Mis reservas.';
  if (raw.includes('WAITLIST_CLOSED'))
    return 'Falta menos de 1 hora para la clase: la lista de espera ya está cerrada.';
  if (raw.includes('WAITLIST_NOT_FOUND'))
    return 'No encontramos esa lista de espera en tu cuenta. Actualiza la página.';
  if (raw.includes('PGRST202')) return 'La lista de espera todavía no está disponible.';
  if (raw.includes('DUPLICATE_RESERVATION'))
    return 'Ya tienes una reserva activa para esta sesión. Consúltala en Mis reservas.';
  if (raw.includes('AUTH_REQUIRED')) return 'Verifica tu correo para reservar de forma segura.';
  if (raw.includes('EMAIL_MISMATCH'))
    return 'El correo debe coincidir con el de tu cuenta verificada.';
  if (raw.includes('SESSION_CLOSED'))
    return 'Esta sesión ya comenzó o no está disponible para reservas.';
  if (raw.includes('INVALID_MEMBER')) return 'Revisa tu nombre y correo electrónico.';
  if (raw.includes('SESSION_NOT_FOUND')) return 'La sesión seleccionada ya no existe.';
  if (raw.includes('agenda aún')) return raw;
  if (
    /invalid login credentials|invalid_credentials|email not confirmed|email_not_confirmed/i.test(
      raw,
    )
  )
    return 'No pudimos iniciar sesión. Revisa tus datos y confirma que tu cuenta esté verificada; también puedes usar Google o el enlace de acceso.';
  if (
    /weak password|weak_password|password.*(short|least|strength|contain|long|most)|new password.*different|same_password/i.test(
      raw,
    )
  )
    return 'La contraseña no cumple los requisitos del servicio o coincide con la anterior. Elige una contraseña larga y diferente.';
  if (/reauthentication|reauthenticate|nonce|session.*expired|current_password/i.test(raw))
    return 'Para cambiar la contraseña vuelve a iniciar sesión con Google o con tu enlace. Si el servicio exige un código de reautenticación, necesita correo configurado para tu dirección.';
  if (/email.*(not authorized|not allowed)|email_address_not_authorized/i.test(raw))
    return 'Este correo no está autorizado para recibir enlaces de acceso por ahora. Ingresa con tu contraseña o con Google.';
  if (/expired|invalid.*token/i.test(raw))
    return 'El enlace no es válido o ha vencido. Solicita uno nuevo.';
  if (/rate limit|too many/i.test(raw))
    return 'Pediste varios correos seguidos. Espera unos minutos antes de intentarlo otra vez.';
  // Error del servidor no previsto: se muestra su código técnico (p. ej. 42P01 o PGRST202) para
  // poder diagnosticarlo. El código no revela datos; el mensaje interno nunca se muestra.
  if (/^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(code))
    return `No pudimos completar la operación por un error del servidor (código ${code}). Inténtalo de nuevo o avisa a recepción.`;
  return 'No pudimos conectar con la agenda. Comprueba tu conexión e inténtalo de nuevo.';
}
