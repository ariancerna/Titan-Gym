import { test, expect } from '@playwright/test';
const target = '/reservar/50000000-0000-4000-8000-000000000007';

function fixtureSession() {
  const user = { id: '70000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test1@example.com', email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.fixture`;
  return { access_token, refresh_token: 'fixture', expires_in: 3600, expires_at: exp, token_type: 'bearer', user };
}

test('crear cuenta valida contraseñas y pide confirmar el correo sin revelar si ya existía', async ({ page }, testInfo) => {
  let signups = 0;
  await page.route('**/auth/v1/signup*', async route => {
    signups++;
    expect(new URL(route.request().url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/auth/confirm');
    const body = route.request().postDataJSON();
    expect(body.email).toBe('nuevo@example.com');
    expect(body.password).toBe('una frase de prueba larga');
    expect(body.code_challenge).toBeTruthy();
    expect(body.data.privacy_version).toBe('2026-10-16');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: '70000000-0000-4000-8000-000000000009', aud: 'authenticated', role: 'authenticated', email: 'nuevo@example.com', identities: [], created_at: new Date().toISOString() }) });
  });
  await page.goto(target);
  await page.getByRole('tab', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
  await page.getByLabel('Correo electrónico', { exact: true }).fill('nuevo@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('corta');
  await page.getByLabel('Repite la contraseña', { exact: true }).fill('distinta');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByText('Usa al menos 12 caracteres.')).toBeVisible();
  await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
  await expect(page.getByText('Acepta la política de privacidad para crear la cuenta.')).toBeVisible();
  expect(signups).toBe(0);
  await page.getByRole('checkbox', { name: /Política de privacidad/ }).check();
  await page.getByLabel('Contraseña', { exact: true }).fill('una frase de prueba larga');
  await page.getByLabel('Repite la contraseña', { exact: true }).fill('una frase de prueba larga');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('.auth-panel').screenshot({ path: testInfo.outputPath('crear-cuenta.png') });
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Revisa tu correo');
  expect(signups).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('fitsmart-agenda-auth-return'))).toBe(target);
});

test('olvidé mi contraseña envía el enlace de recuperación con retorno seguro', async ({ page }) => {
  await page.route('**/auth/v1/recover*', async route => {
    expect(new URL(route.request().url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/auth/confirm');
    expect(route.request().postDataJSON().email).toBe('test1@example.com');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/mis-reservas');
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await expect(page.getByRole('heading', { name: 'Recupera tu contraseña' })).toBeVisible();
  await page.getByLabel('Correo electrónico', { exact: true }).fill('test1@example.com');
  await page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click();
  await expect(page.getByRole('status')).toContainText('Si existe una cuenta');
  expect(await page.evaluate(() => localStorage.getItem('fitsmart-agenda-auth-return'))).toBe('/restablecer-contrasena');
  await page.getByRole('button', { name: 'Volver a iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Accede a tu cuenta' })).toBeVisible();
});

test('restablecer contraseña exige la sesión del enlace y guarda la nueva', async ({ page }) => {
  await page.goto('/restablecer-contrasena');
  await expect(page.getByRole('heading', { name: 'Enlace no válido o vencido' })).toBeVisible();
  const session = fixtureSession();
  await page.addInitScript(s => localStorage.setItem('fitsmart-agenda-auth', JSON.stringify(s)), session);
  let updates = 0;
  await page.route('**/auth/v1/user', async route => {
    if (route.request().method() !== 'PUT') { await route.fallback(); return; }
    updates++;
    expect(route.request().postDataJSON().password).toBe('nueva frase segura 2026');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) });
  });
  await page.goto('/restablecer-contrasena');
  await expect(page.getByRole('heading', { name: 'Elige una contraseña nueva' })).toBeVisible();
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('nueva frase segura 2026');
  await page.getByLabel('Repite la contraseña', { exact: true }).fill('nueva frase segura 2026');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('heading', { name: 'Contraseña actualizada' })).toBeVisible();
  expect(updates).toBe(1);
});

test('fallo del servicio de correo muestra un mensaje claro y no un error de conexión', async ({ page }) => {
  await page.route('**/auth/v1/otp*', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"unexpected_failure","msg":"Error sending magic link email"}' }));
  await page.goto('/mis-reservas');
  await page.getByRole('button', { name: 'Prefiero recibir un enlace por correo' }).click();
  await page.getByLabel('Correo electrónico', { exact: true }).fill('test1@example.com');
  await page.getByRole('button', { name: 'Enviar enlace de acceso' }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos enviar el correo');
  await expect(page.getByRole('alert')).not.toContainText('conexión');
});

test('enlace del correo en nuestro dominio: valida token_hash y lleva a la página correcta', async ({ page }) => {
  const session = fixtureSession();
  const verified: string[] = [];
  await page.route('**/auth/v1/verify*', async route => {
    const body = route.request().postDataJSON();
    expect(body.token_hash).toBe('hash-de-prueba');
    verified.push(body.type);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
  });
  await page.goto('/auth/confirm?token_hash=hash-de-prueba&type=recovery');
  await expect(page).toHaveURL(/\/restablecer-contrasena$/);
  await expect(page.getByRole('heading', { name: 'Elige una contraseña nueva' })).toBeVisible();
  await page.goto('/auth/confirm?token_hash=hash-de-prueba&type=email');
  await expect(page).toHaveURL(/\/mis-reservas$/);
  expect(verified).toEqual(['recovery', 'email']);
});

test('enlace con tipo desconocido o sin token no inicia sesión', async ({ page }) => {
  let calls = 0;
  await page.route('**/auth/v1/verify*', route => { calls++; return route.abort(); });
  await page.goto('/auth/confirm?token_hash=hash-de-prueba&type=invite');
  await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/confirm$/);
  expect(calls).toBe(0);
});

test('Ley 29733: quien entró con Google acepta la privacidad en su primera reserva', async ({ page, request }) => {
  await request.post('http://127.0.0.1:54331/__test/reset');
  await page.addInitScript(s => localStorage.setItem('fitsmart-agenda-auth', JSON.stringify(s)), fixtureSession());
  // Simula una cuenta sin consentimiento; la reserva real se guarda en el PostgreSQL de pruebas.
  await page.route('**/rest/v1/privacy_consents*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const accepted: string[] = [];
  await page.route('**/rest/v1/rpc/accept_privacy_policy', async route => {
    accepted.push(route.request().postDataJSON().p_version);
    await route.fulfill({ status: 204, body: '' });
  });
  await page.goto(target);
  await page.getByRole('textbox', { name: 'Nombre completo del socio' }).fill('Ana López');
  await page.getByRole('checkbox', { name: /Confirmo mi asistencia/ }).check();
  await page.getByRole('button', { name: 'Confirmar reserva', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'política de privacidad' })).toBeVisible();
  expect(accepted).toEqual([]);
  await expect(page.getByRole('main').getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute('href', '/privacidad');
  await page.getByRole('checkbox', { name: /Política de privacidad/ }).check();
  await page.getByRole('button', { name: 'Confirmar reserva', exact: true }).click();
  await expect(page.getByRole('heading', { name: '¡Reserva confirmada!' })).toBeVisible();
  expect(accepted).toEqual(['2026-10-16']);
});

test('política de privacidad accesible desde el pie de página', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacidad' }).click();
  await expect(page).toHaveURL(/\/privacidad$/);
  await expect(page.getByRole('heading', { name: 'Política de privacidad', level: 1 })).toBeVisible();
  for (const title of ['2. Qué datos guardamos', '5. Con quién se comparten', '7. Tus derechos', '9. Cómo ejercer tus derechos'])
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText(/São Paulo, Brasil/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
