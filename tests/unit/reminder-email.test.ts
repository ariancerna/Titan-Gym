import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo JavaScript de tools/ sin tipos
import { buildPromotionEmail, buildReminderEmail } from '../../tools/reminder-email.mjs';

const reservation = {
  reservation_id: '11111111-1111-4111-8111-111111111111',
  code: 'TG-7K4M2Q',
  member_name: 'María Fernanda Quispe',
  member_email: 'maria@example.com',
  class_name: 'Power Spinning Extreme',
  starts_at: '2026-10-16T23:00:00Z', // 18:00 en Lima
  duration_minutes: 50,
  room: 'Sala de Ciclismo',
  address: 'Isabel Chimpu Ocllo cdra 10, Carabayllo 15318',
};

describe('correo de recordatorio (HU07)', () => {
  it('incluye clase, horario de Lima, sala, código y QR en línea', () => {
    const email = buildReminderEmail(reservation, { siteUrl: 'https://titan-gym-tau.vercel.app' });
    expect(email.subject).toBe('Hoy a las 18:00: Power Spinning Extreme en TITAN GYM');
    expect(email.html).toContain('María, te esperamos hoy');
    expect(email.html).toContain('18:00 – 18:50');
    expect(email.html).toContain('Sala de Ciclismo');
    expect(email.html).toContain('TG-7K4M2Q');
    expect(email.html).toContain('src="cid:qr-reserva"');
    expect(email.html).toContain('/reserva-confirmada/11111111-1111-4111-8111-111111111111');
    expect(email.text).toContain('Cancela antes de la hora de inicio');
  });

  it('escapa el HTML de los datos del socio y de la clase', () => {
    const email = buildReminderEmail(
      { ...reservation, member_name: '<script>alert(1)</script> Pérez', class_name: 'Yoga & <b>Relax</b>' },
      { siteUrl: 'https://titan-gym-tau.vercel.app' },
    );
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('Yoga &amp; &lt;b&gt;Relax&lt;/b&gt;');
  });
});

describe('correo de cupo asignado desde la lista de espera (US08)', () => {
  it('confirma la reserva con día, horario de Lima, código, QR y enlace para cancelar', () => {
    const email = buildPromotionEmail(reservation, { siteUrl: 'https://titan-gym-tau.vercel.app' });
    expect(email.subject).toBe('Se liberó un cupo: ya tienes tu reserva para Power Spinning Extreme');
    expect(email.html).toContain('María, ya tienes tu cupo');
    expect(email.html).toContain('Lista de espera');
    expect(email.html).toContain('viernes, 16 de octubre');
    expect(email.html).toContain('18:00 – 18:50');
    expect(email.html).toContain('TG-7K4M2Q');
    expect(email.html).toContain('src="cid:qr-reserva"');
    expect(email.html).toContain('/reserva-confirmada/11111111-1111-4111-8111-111111111111');
    expect(email.html).not.toContain('te esperamos hoy');
    expect(email.text).toContain('pase al siguiente');
  });

  it('escapa los datos del socio', () => {
    const email = buildPromotionEmail(
      { ...reservation, member_name: '<img src=x onerror=alert(1)> Pérez' },
      { siteUrl: 'https://titan-gym-tau.vercel.app' },
    );
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain('&lt;img');
  });
});
