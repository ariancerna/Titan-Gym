/** Formato del código corto de reserva (sin 0/O ni 1/I). */
export const reservationCodePattern = /^TG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export type ScannedCode =
  | { kind: 'code'; code: string }
  | { kind: 'legacy'; code: string }
  | { kind: 'foreign'; code: string };

/**
 * Clasifica el texto leído por la cámara. Solo descarta lo que con seguridad no es un comprobante;
 * el resto lo valida el servidor (CODE_NOT_FOUND).
 */
export function classifyScannedCode(text: string): ScannedCode {
  const code = text.trim().toUpperCase();
  if (!code.startsWith('TG-')) return { kind: 'foreign', code };
  if (/^TG-[A-F0-9]{32}$/.test(code)) return { kind: 'legacy', code };
  return { kind: 'code', code };
}
