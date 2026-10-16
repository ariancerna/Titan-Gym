import { test, expect, type Page } from '@playwright/test';

function identity() {
  const user = { id: '70000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test1@example.com', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'google' }, user_metadata: {}, created_at: new Date().toISOString() };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.fixture`;
  return { access_token, refresh_token: 'fixture', expires_in: 3600, expires_at: exp, token_type: 'bearer', user };
}
async function signedIn(page: Page) {
  await page.addInitScript(session => localStorage.setItem('fitsmart-agenda-auth', JSON.stringify(session)), identity());
}
test.beforeEach(async ({ request }) => { await request.post('http://127.0.0.1:54331/__test/reset'); });

test('contraseña incorrecta no concede acceso ni revela existencia de cuenta', async ({ page }) => {
  await page.route('**/auth/v1/token*', route => route.fulfill({ status: 400, contentType: 'application/json', body: '{"code":"invalid_credentials","msg":"Invalid login credentials"}' }));
  await page.goto('/mis-reservas');
  await expect(page.getByRole('button', { name: 'Crear contraseña', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Iniciar sesión' }).click();
  await page.getByLabel('Correo electrónico', { exact: true }).fill('test1@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-fixture-incorrecta');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No pudimos iniciar sesión');
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Crear contraseña', exact: true })).toHaveCount(0);
});

test('contraseña válida verifica identidad y permite continuar la reserva', async ({ page }) => {
  await page.route('**/auth/v1/token*', async route => {
    expect(new URL(route.request().url()).searchParams.get('grant_type')).toBe('password');
    expect(route.request().postDataJSON().email).toBe('test1@example.com');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(identity()) });
  });
  await page.goto('/reservar/50000000-0000-4000-8000-000000000007');
  await page.getByRole('tab', { name: 'Iniciar sesión' }).click();
  await page.getByLabel('Correo electrónico', { exact: true }).fill('test1@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-fixture-valida');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre completo del socio' })).toBeVisible();
  await expect(page.getByLabel('Correo electrónico')).toHaveValue('test1@example.com');
});

test('crear contraseña valida campos y conserva cuenta y reserva anterior', async ({ page, request }, testInfo) => {
  await signedIn(page);
  const session = identity();
  const result = await request.post('http://127.0.0.1:54331/rest/v1/rpc/reserve_session', { headers: { Authorization: `Bearer ${session.access_token}` }, data: { p_session_id: '50000000-0000-4000-8000-000000000007', p_member_name: 'Ana López', p_email: session.user.email } });
  expect(result.ok()).toBe(true);
  const reservationId = await result.json();
  let updates = 0;
  await page.route('**/auth/v1/user', async route => {
    if (route.request().method() !== 'PUT') { await route.fallback(); return; }
    updates++;
    const body = route.request().postDataJSON();
    // El cliente Supabase añade metadatos PKCE; no se envía identidad ni correo para cambiar de cuenta.
    expect(Object.keys(body).every(key => ['password', 'code_challenge', 'code_challenge_method'].includes(key))).toBe(true);
    expect(body.password).toBe('una-frase-fixture-segura');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) });
  });
  await page.goto('/mis-reservas');
  await expect(page.locator('.reservation-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Crear contraseña', exact: true }).click();
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('corta');
  await page.getByLabel('Repetir contraseña', { exact: true }).fill('corta');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('alert')).toContainText('12 caracteres');
  expect(updates).toBe(0);
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('una-frase-fixture-segura');
  await page.getByLabel('Repetir contraseña', { exact: true }).fill('otra-frase-fixture');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('alert')).toContainText('no coinciden');
  expect(updates).toBe(0);
  await page.getByLabel('Repetir contraseña', { exact: true }).fill('una-frase-fixture-segura');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('crear-contrasena.png'), fullPage: true });
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('region', { name: 'Seguridad de tu cuenta' }).getByRole('status')).toContainText('Contraseña guardada');
  expect(updates).toBe(1);
  await expect(page.getByLabel('Nueva contraseña', { exact: true })).toHaveCount(0);
  await expect(page.locator('.reservation-card')).toHaveCount(1);
  await page.getByRole('link', { name: 'Ver comprobante', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/reserva-confirmada/${reservationId}$`));
  await expect(page.getByRole('heading', { name: '¡Reserva confirmada!' })).toBeVisible();
});

test('error al guardar contraseña no presenta éxito falso', async ({ page }) => {
  await signedIn(page);
  await page.route('**/auth/v1/user', async route => {
    if (route.request().method() !== 'PUT') { await route.fallback(); return; }
    await route.fulfill({ status: 422, contentType: 'application/json', body: '{"code":"weak_password","msg":"Weak password"}' });
  });
  await page.goto('/mis-reservas');
  await page.getByRole('button', { name: 'Crear contraseña', exact: true }).click();
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('una-frase-fixture-segura');
  await page.getByLabel('Repetir contraseña', { exact: true }).fill('una-frase-fixture-segura');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('alert')).toContainText('no cumple los requisitos');
  await expect(page.getByText('Contraseña guardada.', { exact: false })).toHaveCount(0);
  await expect(page.getByLabel('Nueva contraseña', { exact: true })).toHaveValue('');
});
