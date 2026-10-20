// HU07 · Envía el recordatorio por correo 3 horas antes de cada clase reservada.
// US08 · Avisa por correo a quien recibió un cupo desde la lista de espera.
// Panel · Avisa por correo a los inscritos de una sesión cancelada por el gimnasio.
// Lo ejecuta GitHub Actions cada 15 minutos (.github/workflows/recordatorios.yml).
//
// Variables de entorno (secretos del repositorio):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  acceso del servidor; nunca van en la web
//   SMTP_USER, SMTP_PASS                     cuenta de Gmail y su contraseña de aplicación
//   SMTP_HOST, SMTP_PORT                     opcionales (por defecto smtp.gmail.com:465)
//   SITE_URL, REMINDER_HOURS                 opcionales
// Con --dry-run solo cuenta los recordatorios pendientes: no envía ni los marca.
//
// El repositorio es público y los registros de GitHub Actions también: aquí nunca se imprimen
// nombres, correos ni códigos de reserva, solo cantidades.
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { buildCancellationEmail, buildPromotionEmail, buildReminderEmail } from './reminder-email.mjs';

const env = process.env;
const dryRun = process.argv.includes('--dry-run');
const hours = Number(env.REMINDER_HOURS || 3);
const siteUrl = (env.SITE_URL || 'https://titan-gym-tau.vercel.app').replace(/\/$/, '');

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', ...(dryRun ? [] : ['SMTP_USER', 'SMTP_PASS'])];
const missing = required.filter((name) => !env[name]);
if (missing.length) {
  // Sin configurar no es un error: evita una alerta de fallo cada 15 minutos.
  console.log(`::warning::Recordatorios sin configurar. Faltan los secretos: ${missing.join(', ')}`);
  process.exit(0);
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const port = Number(env.SMTP_PORT || 465);
const transport = dryRun
  ? null
  : nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });

/** Envía cada correo con el QR en línea; si falla, `release` lo deja pendiente para reintentar. */
async function sendAll(items, build, release) {
  let sent = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const { subject, html, text } = build(item, { siteUrl });
      // El QR solo se adjunta si el correo lo muestra (el de cancelación no lo lleva).
      const qr = html.includes('cid:qr-reserva')
        ? await QRCode.toBuffer(item.code, {
            width: 336,
            margin: 2,
            color: { dark: '#101114', light: '#ffffff' },
          })
        : null;
      await transport.sendMail({
        from: { name: 'TITAN GYM', address: env.SMTP_USER },
        to: item.member_email,
        subject,
        html,
        text,
        attachments: qr ? [{ filename: 'qr-reserva.png', content: qr, cid: 'qr-reserva' }] : [],
      });
      sent += 1;
    } catch (sendError) {
      failed += 1;
      await release(item);
      console.error('Falló un envío:', sendError instanceof Error ? sendError.message : sendError);
    }
  }
  return { sent, failed };
}

// HU07 · Recordatorios 3 horas antes.
const { data: due, error } = await supabase.rpc('claim_reminders', {
  p_hours: hours,
  p_preview: dryRun,
});
if (error) {
  console.error('No se pudieron obtener los recordatorios:', error.message);
  process.exit(1);
}
let reminders = { sent: 0, failed: 0 };
if (dryRun) {
  console.log(`Prueba en seco: ${due.length} recordatorio(s) pendiente(s) en las próximas ${hours} horas.`);
} else if (!due.length) {
  console.log('No hay recordatorios pendientes.');
} else {
  // La reserva vuelve a quedar pendiente y se reintenta en la siguiente ejecución.
  reminders = await sendAll(due, buildReminderEmail, (r) =>
    supabase.rpc('release_reminder', { p_reservation_id: r.reservation_id }),
  );
  console.log(`Recordatorios enviados: ${reminders.sent}. Fallidos (se reintentarán): ${reminders.failed}.`);
}

// US08 · Aviso a quien recibió un cupo desde la lista de espera.
let notices = { sent: 0, failed: 0 };
const { data: promoted, error: waitlistError } = await supabase.rpc('claim_waitlist_notices', {
  p_preview: dryRun,
});
if (waitlistError?.code === 'PGRST202') {
  // La migración de la lista de espera aún no se aplicó: no es un fallo de la tarea.
  console.log('::warning::Lista de espera sin migrar: se omiten sus avisos.');
} else if (waitlistError) {
  console.error('No se pudieron obtener los avisos de lista de espera:', waitlistError.message);
} else if (dryRun) {
  console.log(`Prueba en seco: ${promoted.length} aviso(s) de lista de espera pendiente(s).`);
} else if (promoted.length) {
  notices = await sendAll(promoted, buildPromotionEmail, (n) =>
    supabase.rpc('release_waitlist_notice', { p_entry_id: n.entry_id }),
  );
  console.log(`Avisos de lista de espera enviados: ${notices.sent}. Fallidos (se reintentarán): ${notices.failed}.`);
}

// Panel · Aviso de sesión cancelada por el gimnasio.
let cancellations = { sent: 0, failed: 0 };
const { data: cancelled, error: cancelError } = await supabase.rpc('claim_cancellation_notices', {
  p_preview: dryRun,
});
if (cancelError?.code === 'PGRST202') {
  console.log('::warning::Cancelación de sesiones sin migrar: se omiten sus avisos.');
} else if (cancelError) {
  console.error('No se pudieron obtener los avisos de cancelación:', cancelError.message);
} else if (dryRun) {
  console.log(`Prueba en seco: ${cancelled.length} aviso(s) de cancelación pendiente(s).`);
} else if (cancelled.length) {
  cancellations = await sendAll(cancelled, buildCancellationEmail, (c) =>
    supabase.rpc('release_cancellation_notice', { p_reservation_id: c.reservation_id }),
  );
  console.log(`Avisos de cancelación enviados: ${cancellations.sent}. Fallidos (se reintentarán): ${cancellations.failed}.`);
}

const sent = reminders.sent + notices.sent + cancellations.sent;
const failed = reminders.failed + notices.failed + cancellations.failed;
// Una consulta fallida de la lista de espera sí es un fallo; la migración pendiente, no.
const waitlistFailed = Boolean(waitlistError) && waitlistError.code !== 'PGRST202';
const cancelFailed = Boolean(cancelError) && cancelError.code !== 'PGRST202';
process.exit((failed && !sent) || waitlistFailed || cancelFailed ? 1 : 0);
