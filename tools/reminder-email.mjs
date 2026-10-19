// Correos al socio: recordatorio de clase (HU07) y cupo asignado desde la lista de espera (US08).
// Módulo puro: recibe los datos de la reserva y devuelve el asunto, el HTML y el texto plano.
// El QR se adjunta en línea con el identificador `qr-reserva` porque Gmail bloquea las imágenes
// incrustadas como data: URI.

const timezone = 'America/Lima';

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const timeFormat = new Intl.DateTimeFormat('es-PE', {
  timeZone: timezone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const dayFormat = new Intl.DateTimeFormat('es-PE', {
  timeZone: timezone,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Datos comunes de la clase, ya formateados y escapados. */
function classDetails(reservation, siteUrl) {
  const start = new Date(reservation.starts_at);
  const end = new Date(start.getTime() + reservation.duration_minutes * 60000);
  return {
    start: timeFormat.format(start),
    time: `${timeFormat.format(start)} – ${timeFormat.format(end)}`,
    day: dayFormat.format(start),
    firstName: reservation.member_name.trim().split(/\s+/)[0],
    receiptUrl: `${siteUrl}/reserva-confirmada/${reservation.reservation_id}`,
    e: {
      className: escapeHtml(reservation.class_name),
      room: escapeHtml(reservation.room),
      address: escapeHtml(reservation.address),
      code: escapeHtml(reservation.code),
    },
  };
}

/** Diseño compartido: marca, tarjeta con los datos de la clase, QR, aviso y pie. */
function layout({ siteUrl, subject, preheader, eyebrow, heading, d, note, footer }) {
  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
  <body style="margin:0;padding:0;background:#101114;">
    <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#101114;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr><td style="padding:0 0 20px;">
            <img src="${siteUrl}/assets/brands/titan-mark.png" width="40" height="40" alt="" style="vertical-align:middle;border:0;" />
            <span style="font:bold 20px Arial,Helvetica,sans-serif;letter-spacing:2px;color:#ffffff;vertical-align:middle;padding-left:8px;">TITAN <span style="color:#a78bfa;">GYM</span></span>
          </td></tr>
          <tr><td style="background:#1b1b1f;border:1px solid #2a2b31;border-top:4px solid #7c3aed;border-radius:8px;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#d4d4d8;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#a78bfa;">${eyebrow}</p>
            <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;text-transform:uppercase;color:#ffffff;">${heading}</h1>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;font-size:15px;line-height:1.7;">
              <tr><td style="color:#a1a1aa;padding-right:16px;vertical-align:top;">Clase</td><td style="color:#ffffff;font-weight:bold;">${d.e.className}</td></tr>
              <tr><td style="color:#a1a1aa;padding-right:16px;vertical-align:top;">Horario</td><td style="color:#ffffff;">${escapeHtml(d.day)} · ${d.time}</td></tr>
              <tr><td style="color:#a1a1aa;padding-right:16px;vertical-align:top;">Sala</td><td style="color:#ffffff;">${d.e.room}</td></tr>
              <tr><td style="color:#a1a1aa;padding-right:16px;vertical-align:top;">Sede</td><td style="color:#ffffff;">${d.e.address}</td></tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
              <tr><td align="center" style="background:#ffffff;border-radius:10px;padding:8px;">
                <img src="cid:qr-reserva" width="168" height="168" alt="Código QR de la reserva ${d.e.code}" style="display:block;border:0;" />
              </td></tr>
            </table>
            <p style="margin:0 0 24px;text-align:center;font-size:13px;color:#c7c6cc;">Muestra este QR en recepción · <strong style="color:#ffffff;letter-spacing:2px;">${d.e.code}</strong></p>
            <p style="margin:0;padding:14px 16px;background:#1f1a2e;border:1px solid #3b2f63;border-radius:6px;font-size:13px;line-height:1.5;">
              ${note}
            </p>
          </td></tr>
          <tr><td style="padding:20px 8px 0;font:12px/1.6 Arial,Helvetica,sans-serif;color:#71717a;">
            ${footer}<br />
            FitSmart Agenda · proyecto académico UTP
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function buildReminderEmail(reservation, { siteUrl }) {
  const d = classDetails(reservation, siteUrl);
  const settingsUrl = `${siteUrl}/perfil#recordatorios`;
  const subject = `Hoy a las ${d.start}: ${reservation.class_name} en TITAN GYM`;
  const html = layout({
    siteUrl,
    subject,
    preheader: `${d.e.className} · ${d.time}. Muestra tu QR en recepción.`,
    eyebrow: 'Recordatorio de clase',
    heading: `${escapeHtml(d.firstName)}, te esperamos hoy`,
    d,
    note: `¿No podrás venir? Cancela antes de la hora de inicio para liberar tu cupo:
              <a href="${d.receiptUrl}" style="color:#a78bfa;">ver mi reserva</a>.`,
    footer: `Recibes este recordatorio porque reservaste esta clase. Puedes desactivarlos en
            <a href="${settingsUrl}" style="color:#a1a1aa;">Mi perfil</a>.`,
  });
  const text = [
    `${d.firstName}, te esperamos hoy en TITAN GYM.`,
    '',
    `Clase: ${reservation.class_name}`,
    `Horario: ${d.day} · ${d.time}`,
    `Sala: ${reservation.room}`,
    `Sede: ${reservation.address}`,
    `Código de reserva: ${reservation.code}`,
    '',
    `¿No podrás venir? Cancela antes de la hora de inicio: ${d.receiptUrl}`,
    `Desactiva los recordatorios en Mi perfil: ${settingsUrl}`,
  ].join('\n');
  return { subject, html, text };
}

/** US08: se liberó un cupo y la reserva ya está hecha a nombre del socio que esperaba. */
export function buildPromotionEmail(reservation, { siteUrl }) {
  const d = classDetails(reservation, siteUrl);
  const subject = `Se liberó un cupo: ya tienes tu reserva para ${reservation.class_name}`;
  const html = layout({
    siteUrl,
    subject,
    preheader: `${d.e.className} · ${escapeHtml(d.day)} · ${d.time}. Tu reserva está confirmada.`,
    eyebrow: 'Lista de espera',
    heading: `${escapeHtml(d.firstName)}, ya tienes tu cupo`,
    d,
    note: `Alguien canceló y el cupo era tuyo por orden de llegada. ¿Ya no puedes ir? Cancela para
              que pase al siguiente de la lista: <a href="${d.receiptUrl}" style="color:#a78bfa;">ver mi reserva</a>.`,
    footer: 'Recibes este correo porque te uniste a la lista de espera de esta clase.',
  });
  const text = [
    `${d.firstName}, se liberó un cupo y ya tienes tu reserva en TITAN GYM.`,
    '',
    `Clase: ${reservation.class_name}`,
    `Horario: ${d.day} · ${d.time}`,
    `Sala: ${reservation.room}`,
    `Sede: ${reservation.address}`,
    `Código de reserva: ${reservation.code}`,
    '',
    `¿Ya no puedes ir? Cancela para que el cupo pase al siguiente: ${d.receiptUrl}`,
  ].join('\n');
  return { subject, html, text };
}
