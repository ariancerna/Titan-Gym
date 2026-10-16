const returnKey = 'fitsmart-agenda-auth-return';
export const resetPasswordPath = '/restablecer-contrasena';

export function safeReturnPath(path: string | null): string {
  return path &&
    (path === '/admin' ||
      path === resetPasswordPath ||
      /^\/reservar\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path))
    ? path
    : '/mis-reservas';
}

export function rememberReturnPath(path: string): void {
  localStorage.setItem(returnKey, safeReturnPath(path));
}

export function consumeReturnPath(): string {
  const path = safeReturnPath(localStorage.getItem(returnKey));
  localStorage.removeItem(returnKey);
  return path;
}

export function magicLinkRedirect(): string {
  return `${window.location.origin}/auth/confirm`;
}
