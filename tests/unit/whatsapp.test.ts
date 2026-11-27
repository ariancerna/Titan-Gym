import { describe, expect, it } from 'vitest';
import { confirmationLink } from '../../src/features/admin/whatsapp';

describe('confirmationLink', () => {
  const session = { name: 'Funcional', starts_at: '2026-12-01T12:00:00Z' };

  it('abre WhatsApp con el mensaje de confirmación ya escrito', () => {
    const link = confirmationLink('  Ana   López ', session);
    expect(link.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(link.slice('https://wa.me/?text='.length));
    expect(text).toMatch(/^Hola Ana, te escribimos de TITAN GYM/);
    expect(text).toContain('Funcional');
    expect(text).toContain('7:00');
    expect(text).toContain('darle tu cupo a otro socio');
  });

  it('no incluye el correo ni datos del socio aparte de su nombre', () => {
    const text = decodeURIComponent(confirmationLink('Ana López', session));
    expect(text).not.toContain('@');
    expect(text).not.toContain('López');
  });
});
