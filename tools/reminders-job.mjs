// HU07 · Recordatorio por correo 3 horas antes de cada clase reservada.
// US08 · Aviso a quien recibió un cupo desde la lista de espera.
// Panel · Aviso a los inscritos de una sesión cancelada por el gimnasio.
//
// Lo usan la función de Vercel /api/recordatorios (disparada por Supabase cada 10 minutos) y,
// como respaldo, GitHub Actions (tools/send-reminders.mjs). Cada reserva se marca en la base de
// datos al reclamarla, así que dos ejecuciones simultáneas nunca envían el mismo correo.
//
// Variables de entorno:
//   SUPABASE_URL (o VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY   acceso del servidor
//   SMTP_USER, SMTP_PASS     cuenta de Gmail y su contraseña de aplicación
//   SMTP_HOST, SMTP_PORT     opcionales (por defecto smtp.gmail.com:465)
//   SITE_URL, REMINDER_HOURS opcionales
//
// Los registros pueden ser públicos: aquí nunca se escriben nombres, correos ni códigos de
// reserva, solo cantidades.
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { buildCancellationEmail, buildPromotionEmail, buildReminderEmail } from './reminder-email.mjs';

/** Variables que faltan para ejecutar (en prueba en seco no hace falta el SMTP). */
export function missingConfig(env, dryRun = false) {
  const has = {
    SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    SMTP_USER: env.SMTP_USER,
    SMTP_PASS: env.SMTP_PASS,
  };
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', ...(dryRun ? [] : ['SMTP_USER', 'SMTP_PASS'])];
  return required.filter((name) => !has[name]);
}

/**
 * Reclama y envía los correos pendientes. Devuelve solo cantidades y si hubo un fallo que deba
 * marcar la ejecución como fallida.
 */
export async function runReminders({ env, dryRun = false, log = console }) {
  const hours = Number(env.REMINDER_HOURS || 3);
  const siteUrl = (env.SITE_URL || 'https://titan-gym-tau.vercel.app').replace(/\/$/, '');
  const supabase = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
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
        log.error('Falló un envío:', sendError instanceof Error ? sendError.message : sendError);
      }
    }
    return { sent, failed };
  }

  const summary = {
    dryRun,
    reminders: { pending: 0, sent: 0, failed: 0 },
    waitlist: { pending: 0, sent: 0, failed: 0 },
    cancellations: { pending: 0, sent: 0, failed: 0 },
  };

  // HU07 · Recordatorios 3 horas antes.
  const { data: due, error } = await supabase.rpc('claim_reminders', { p_hours: hours, p_preview: dryRun });
  if (error) {
    log.error('No se pudieron obtener los recordatorios:', error.message);
    return { ok: false, summary };
  }
  summary.reminders.pending = due.length;
  if (dryRun) {
    log.log(`Prueba en seco: ${due.length} recordatorio(s) pendiente(s) en las próximas ${hours} horas.`);
  } else if (!due.length) {
    log.log('No hay recordatorios pendientes.');
  } else {
    // La reserva vuelve a quedar pendiente y se reintenta en la siguiente ejecución.
    Object.assign(
      summary.reminders,
      await sendAll(due, buildReminderEmail, (r) =>
        supabase.rpc('release_reminder', { p_reservation_id: r.reservation_id }),
      ),
    );
    log.log(`Recordatorios enviados: ${summary.reminders.sent}. Fallidos (se reintentarán): ${summary.reminders.failed}.`);
  }

  // US08 · Aviso a quien recibió un cupo desde la lista de espera.
  const { data: promoted, error: waitlistError } = await supabase.rpc('claim_waitlist_notices', {
    p_preview: dryRun,
  });
  if (waitlistError?.code === 'PGRST202') {
    // La migración de la lista de espera aún no se aplicó: no es un fallo de la tarea.
    log.log('Lista de espera sin migrar: se omiten sus avisos.');
  } else if (waitlistError) {
    log.error('No se pudieron obtener los avisos de lista de espera:', waitlistError.message);
  } else {
    summary.waitlist.pending = promoted.length;
    if (dryRun) {
      log.log(`Prueba en seco: ${promoted.length} aviso(s) de lista de espera pendiente(s).`);
    } else if (promoted.length) {
      Object.assign(
        summary.waitlist,
        await sendAll(promoted, buildPromotionEmail, (n) =>
          supabase.rpc('release_waitlist_notice', { p_entry_id: n.entry_id }),
        ),
      );
      log.log(`Avisos de lista de espera enviados: ${summary.waitlist.sent}. Fallidos (se reintentarán): ${summary.waitlist.failed}.`);
    }
  }

  // Panel · Aviso de sesión cancelada por el gimnasio.
  const { data: cancelled, error: cancelError } = await supabase.rpc('claim_cancellation_notices', {
    p_preview: dryRun,
  });
  if (cancelError?.code === 'PGRST202') {
    log.log('Cancelación de sesiones sin migrar: se omiten sus avisos.');
  } else if (cancelError) {
    log.error('No se pudieron obtener los avisos de cancelación:', cancelError.message);
  } else {
    summary.cancellations.pending = cancelled.length;
    if (dryRun) {
      log.log(`Prueba en seco: ${cancelled.length} aviso(s) de cancelación pendiente(s).`);
    } else if (cancelled.length) {
      Object.assign(
        summary.cancellations,
        await sendAll(cancelled, buildCancellationEmail, (c) =>
          supabase.rpc('release_cancellation_notice', { p_reservation_id: c.reservation_id }),
        ),
      );
      log.log(`Avisos de cancelación enviados: ${summary.cancellations.sent}. Fallidos (se reintentarán): ${summary.cancellations.failed}.`);
    }
  }

  const parts = [summary.reminders, summary.waitlist, summary.cancellations];
  const sent = parts.reduce((n, p) => n + p.sent, 0);
  const failed = parts.reduce((n, p) => n + p.failed, 0);
  // Una consulta fallida sí es un fallo; una migración pendiente, no.
  const queryFailed = [waitlistError, cancelError].some((e) => e && e.code !== 'PGRST202');
  return { ok: !((failed && !sent) || queryFailed), summary };
}
