// Correo de recordatorio (HU07). Módulo puro: recibe los datos de la reserva y devuelve el
// asunto, el HTML y el texto plano. El QR se adjunta en línea con el identificador `qr-reserva`
// porque Gmail bloquea las imágenes incrustadas como data: URI.

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

export function buildReminderEmail(reservation, { siteUrl }) {
  const start = new Date(reservation.starts_at);
  const end = new Date(start.getTime() + reservation.duration_minutes * 60000);
  const time = `${timeFormat.format(start)} – ${timeFormat.format(end)}`;
  const day = dayFormat.format(start);
  const firstName = reservation.member_name.trim().split(/\s+/)[0];
  const receiptUrl = `${siteUrl}/reserva-confirmada/${reservation.reservation_id}`;
  const settingsUrl = `${siteUrl}/mis-reservas`;
  const subject = `Hoy a las ${timeFormat.format(start)}: ${reservation.class_name} en TITAN GYM`;

  const e = {
    name: escapeHtml(firstName),
    className: escapeHtml(reservation.class_name),
    room: escapeHtml(reservation.room),
    address: escapeHtml(reservation.address),
    code: escapeHtml(reservation.code),
  };

  const html = `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
  <body style="margin:0;padding:0;background:#101114;">
    <div style="display:none;max-height:0;overflow:hidden;">${e.className} · ${time}. Muestra tu QR en recepción.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#101114;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr><td style="padding:0 0 20px;">
            <img src="${siteUrl}/assets/brands/titan-mark.png" width="40" height="40" alt="" style="vertical-align:middle;border:0;" />
            <span style="font:bold 20px Arial,Helvetica,sans-serif;letter-spacing:2px;color:#ffffff;vertical-align:middle;padding-left:8px;">TITAN <span style="color:#a78bfa;">GYM</span></span>
          </td></tr>
          <tr><td style="background:#1b1b1f;border:1px solid #2a2b31;border-top:4px solid #7c3aed;border-radius:8px;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#d4d4d8;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#a78bfa;">Recordatorio de clase</p>
            <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;text-transform:uppercase;color:#ffffff;">${e.name}, te esperamos hoy</h1>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;font-size:15px;line-height:1.7;">
              <tr><td style="color:#a1a1aa;padding-right:16px;vertical-align:top;">Clase</td><td style="color:#ffffff;font-weight:bold;">${e.className}</td></tr>
              <tr><td style="color:#a1a1aa;padding-right:16px;vertical-align:top;">Horario</td><td style="color:#ffffff;">${escapeHtml(day)} · ${time}</td></tr>
              <tr><td style="color:#a1a1aa;padding-right:16px;vertical-align:top;">Sala</td><td style="color:#ffffff;">${e.room}</td></tr>
              <tr><td style="color:#a1a1aa;padding-right:16px;vertical-align:top;">Sede</td><td style="color:#ffffff;">${e.address}</td></tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
              <tr><td align="center" style="background:#ffffff;border-radius:10px;padding:8px;">
                <img src="cid:qr-reserva" width="168" height="168" alt="Código QR de la reserva ${e.code}" style="display:block;border:0;" />
              </td></tr>
            </table>
            <p style="margin:0 0 24px;text-align:center;font-size:13px;color:#c7c6cc;">Muestra este QR en recepción · <strong style="color:#ffffff;letter-spacing:2px;">${e.code}</strong></p>
            <p style="margin:0;padding:14px 16px;background:#1f1a2e;border:1px solid #3b2f63;border-radius:6px;font-size:13px;line-height:1.5;">
              ¿No podrás venir? Cancela antes de la hora de inicio para liberar tu cupo:
              <a href="${receiptUrl}" style="color:#a78bfa;">ver mi reserva</a>.
            </p>
          </td></tr>
          <tr><td style="padding:20px 8px 0;font:12px/1.6 Arial,Helvetica,sans-serif;color:#71717a;">
            Recibes este recordatorio porque reservaste esta clase. Puedes desactivarlos en
            <a href="${settingsUrl}" style="color:#a1a1aa;">Mis reservas</a>.<br />
            FitSmart Agenda · proyecto académico UTP
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    `${firstName}, te esperamos hoy en TITAN GYM.`,
    '',
    `Clase: ${reservation.class_name}`,
    `Horario: ${day} · ${time}`,
    `Sala: ${reservation.room}`,
    `Sede: ${reservation.address}`,
    `Código de reserva: ${reservation.code}`,
    '',
    `¿No podrás venir? Cancela antes de la hora de inicio: ${receiptUrl}`,
    `Desactiva los recordatorios en Mis reservas: ${settingsUrl}`,
  ].join('\n');

  return { subject, html, text };
}
