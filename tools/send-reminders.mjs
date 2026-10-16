// HU07 · Envía el recordatorio por correo 3 horas antes de cada clase reservada.
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
import { buildReminderEmail } from './reminder-email.mjs';

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

const { data: due, error } = await supabase.rpc('claim_reminders', {
  p_hours: hours,
  p_preview: dryRun,
});
if (error) {
  console.error('No se pudieron obtener los recordatorios:', error.message);
  process.exit(1);
}
if (dryRun) {
  console.log(`Prueba en seco: ${due.length} recordatorio(s) pendiente(s) en las próximas ${hours} horas.`);
  process.exit(0);
}
if (!due.length) {
  console.log('No hay recordatorios pendientes.');
  process.exit(0);
}

const port = Number(env.SMTP_PORT || 465);
const transport = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.gmail.com',
  port,
  secure: port === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

let sent = 0;
let failed = 0;
for (const reservation of due) {
  try {
    const { subject, html, text } = buildReminderEmail(reservation, { siteUrl });
    const qr = await QRCode.toBuffer(reservation.code, {
      width: 336,
      margin: 2,
      color: { dark: '#101114', light: '#ffffff' },
    });
    await transport.sendMail({
      from: { name: 'TITAN GYM', address: env.SMTP_USER },
      to: reservation.member_email,
      subject,
      html,
      text,
      attachments: [{ filename: 'qr-reserva.png', content: qr, cid: 'qr-reserva' }],
    });
    sent += 1;
  } catch (sendError) {
    failed += 1;
    // La reserva vuelve a quedar pendiente y se reintenta en la siguiente ejecución.
    await supabase.rpc('release_reminder', { p_reservation_id: reservation.reservation_id });
    console.error('Falló un envío:', sendError instanceof Error ? sendError.message : sendError);
  }
}

console.log(`Recordatorios enviados: ${sent}. Fallidos (se reintentarán): ${failed}.`);
process.exit(failed && !sent ? 1 : 0);
