import { gym } from './gym';

// Versión vigente de la política. Si cambia el texto de forma relevante, actualiza esta fecha
// y la de private.current_privacy_version() en una migración: los socios deberán aceptarla de nuevo.
export const privacyPolicyVersion = '2026-10-16';

// Correo para ejercer los derechos ARCO. Si queda vacío, la política indica solo la recepción.
export const privacyContactEmail = '';

export const gymOwner = {
  name: gym.name,
  ruc: gym.ruc,
  address: `${gym.branch} · ${gym.address}`,
};

export interface PrivacySection {
  title: string;
  /** Texto que va antes de la lista. */
  intro?: string;
  paragraphs?: string[];
  items?: string[];
}

export const privacySections: PrivacySection[] = [
  {
    title: '1. Quién es responsable de tus datos',
    paragraphs: [
      `${gymOwner.name} (RUC ${gymOwner.ruc}), con sede en ${gymOwner.address}, es el titular del banco de datos de FitSmart Agenda.`,
      'FitSmart Agenda fue desarrollada como proyecto académico del curso Innovación y Transformación Digital de la Universidad Tecnológica del Perú.',
    ],
  },
  {
    title: '2. Qué datos guardamos',
    items: [
      'Tu correo electrónico, para identificar tu cuenta y enviarte enlaces de acceso.',
      'Tu contraseña, administrada por el servicio de autenticación. Se guarda cifrada y nadie del gimnasio puede verla.',
      'El nombre que escribes al reservar, para reconocerte en recepción.',
      'Tus reservas: clase, fecha, código, estado y, si cancelas, la hora de la cancelación.',
      'Tu asistencia a cada clase, registrada por el personal del gimnasio.',
      'Si entras con Google: el nombre y el correo de esa cuenta.',
      'La fecha en que aceptaste esta política.',
    ],
    paragraphs: ['No pedimos DNI, datos de pago, datos de salud ni tu ubicación.'],
  },
  {
    title: '3. Para qué los usamos',
    items: [
      'Gestionar tus reservas y controlar el aforo de cada clase.',
      'Enviarte un recordatorio por correo 3 horas antes de cada clase reservada. Puedes desactivarlo en Mis reservas.',
      'Registrar la asistencia y calcular la tasa de inasistencias de cada clase.',
      'Analizar las inasistencias con un modelo predictivo. Para eso se usan datos seudonimizados: sin tu nombre ni tu correo.',
    ],
    paragraphs: ['No usamos tus datos para publicidad ni los vendemos.'],
  },
  {
    title: '4. Por qué podemos usarlos',
    paragraphs: [
      'Por tu consentimiento, que nos das al marcar la casilla de aceptación, conforme a la Ley N.° 29733, Ley de Protección de Datos Personales, y su reglamento. Sin ese consentimiento no podemos registrar reservas a tu nombre.',
    ],
  },
  {
    title: '5. Con quién se comparten',
    intro: 'Solo con los proveedores que hacen funcionar la plataforma:',
    items: [
      'Supabase: base de datos y autenticación. Sus servidores están en São Paulo, Brasil, por lo que existe una transferencia internacional de datos.',
      'Vercel: alojamiento de la página web.',
      'Google: solo si eliges iniciar sesión con Google.',
      'El proveedor de correo que envía los enlaces de acceso.',
    ],
  },
  {
    title: '6. Cuánto tiempo los conservamos',
    paragraphs: [
      'Tu cuenta, mientras la mantengas activa. Las reservas y la asistencia, hasta dos años después de cada clase para el análisis de inasistencias; luego se eliminan o se anonimizan. Si pides la cancelación de tus datos, quitamos tu nombre y tu correo de tus reservas.',
    ],
  },
  {
    title: '7. Tus derechos',
    paragraphs: [
      'Puedes pedir el acceso, la rectificación, la cancelación de tus datos o oponerte a su uso (derechos ARCO), y retirar tu consentimiento en cualquier momento. Responderemos dentro de los plazos de la Ley N.° 29733 y su reglamento.',
      'Si consideras que no atendimos tu solicitud, puedes presentar un reclamo ante la Autoridad Nacional de Protección de Datos Personales.',
    ],
  },
  {
    title: '8. Cómo protegemos tus datos',
    items: [
      'Conexión cifrada (HTTPS) en toda la plataforma.',
      'Cada socio solo puede ver sus propias reservas; la base de datos lo verifica en cada consulta.',
      'Solo el personal autorizado ve los inscritos de cada clase.',
      'Las contraseñas nunca se guardan en texto legible.',
    ],
  },
];
