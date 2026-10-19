import { test, expect, type Page } from '@playwright/test';

function identity(user_metadata: Record<string, unknown> = {}) {
  const user = { id: '70000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test1@example.com', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'google', providers: ['google'] }, user_metadata, created_at: new Date().toISOString() };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.fixture`;
  return { access_token, refresh_token: 'fixture', expires_in: 3600, expires_at: exp, token_type: 'bearer', user };
}
/** El puente de pruebas no guarda metadatos: GET /user devuelve los de la sesión indicada. */
async function signedIn(page: Page, session = identity()) {
  await page.addInitScript(s => localStorage.setItem('fitsmart-agenda-auth', JSON.stringify(s)), session);
  await page.route('**/auth/v1/user', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) })
    : route.fallback());
}
test.beforeEach(async ({ request }) => { await request.post('http://127.0.0.1:54331/__test/reset'); });

test('Mis reservas solo muestra reservas; cuenta, contraseña y recordatorios están en Mi perfil', async ({ page }, testInfo) => {
  await signedIn(page);
  await page.goto('/mis-reservas');
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Seguridad de tu cuenta' })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Recibir recordatorios por correo' })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Mi perfil' }).or(page.locator('.nav-actions').getByRole('link', { name: 'Mi perfil' })).first().click();
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.getByRole('heading', { name: 'Mi perfil' })).toBeVisible();
  await expect(page.getByText('test1@example.com')).toBeVisible();
  await expect(page.getByText('Google', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear contraseña', exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Recibir recordatorios por correo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar nombre' })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mi-perfil.png'), fullPage: true });
});

test('una cuenta con contraseña ve «Cambiar contraseña» en lugar de «Crear contraseña»', async ({ page }) => {
  await signedIn(page, identity({ has_password: true }));
  await page.goto('/perfil');
  const security = page.getByRole('region', { name: 'Seguridad de tu cuenta' });
  await expect(security.getByRole('heading', { name: 'Contraseña', exact: true })).toBeVisible();
  await expect(security.getByRole('button', { name: 'Cambiar contraseña' })).toBeVisible();
  await expect(security.getByRole('button', { name: 'Crear contraseña' })).toHaveCount(0);
  await expect(page.getByText('Google · Correo y contraseña')).toBeVisible();
});

test('el nombre guardado en el perfil completa la siguiente reserva', async ({ page }) => {
  const session = identity();
  await signedIn(page, session);
  let saved: { data?: unknown } | null = null;
  await page.route('**/auth/v1/user', async route => {
    if (route.request().method() !== 'PUT') { await route.fallback(); return; }
    saved = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...session.user, user_metadata: { full_name: 'Ana López' } }) });
  });
  await page.goto('/perfil');
  const name = page.getByLabel('Nombre completo');
  await name.fill('Ana');
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(page.getByRole('alert')).toContainText('nombre y apellido');
  expect(saved).toBeNull();
  await name.fill('  Ana López ');
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(page.getByRole('status')).toContainText('Nombre guardado');
  // Solo se envía el nombre: ni correo, ni contraseña, ni otros metadatos.
  expect(saved?.data).toEqual({ full_name: 'Ana López' });
  expect(Object.keys(saved ?? {}).every(key => ['data', 'code_challenge', 'code_challenge_method'].includes(key))).toBe(true);
  // Navegación dentro de la app: conserva el usuario actualizado por Supabase.
  await page.evaluate(() => { history.pushState({}, '', '/reservar/50000000-0000-4000-8000-000000000007'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByRole('textbox', { name: 'Nombre completo del socio' })).toHaveValue('Ana López');
});
