import { test, expect } from '@playwright/test';
const target = '/reservar/50000000-0000-4000-8000-000000000007';

test('correo primero y Google debajo con logotipo oficial sin desbordamiento', async ({ page }, testInfo) => {
  await page.route('**/auth/v1/settings', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"external":{"google":true,"email":true}}' }));
  await page.goto('/mis-reservas');
  const primary = page.getByRole('button', { name: 'Iniciar sesión', exact: true });
  const google = page.getByRole('button', { name: 'Continuar con Google' });
  await expect(primary).toBeVisible();
  await expect(google).toBeEnabled();
  await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toHaveAttribute('aria-selected', 'true');
  const first = await primary.boundingBox();
  const second = await google.boundingBox();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height);
  await expect(page.locator('.google-signin img')).toHaveAttribute('src', '/assets/brands/google-g.png');
  await expect.poll(() => page.locator('.google-signin img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.auth-panel').screenshot({ path: testInfo.outputPath('acceso-google-secundario.png') });
});

test('Google disponible inicia OAuth con desafío PKCE y retorno exacto', async ({ page }) => {
  await page.route('**/auth/v1/settings', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"external":{"google":true,"email":true}}' }));
  await page.route('**/auth/v1/authorize*', async route => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('provider')).toBe('google');
    expect(url.searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/auth/confirm');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('scopes')).toBe('openid email profile');
    expect(url.searchParams.get('prompt')).toBe('select_account');
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Proveedor Google de prueba</h1>' });
  });
  await page.goto(target);
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continuar con Google' }).click();
  await expect(page.getByRole('heading', { name: 'Proveedor Google de prueba' })).toBeVisible();
  // El almacenamiento de retorno pertenece a la app, no al origen del proveedor.
  await page.goto('/mis-reservas');
  expect(await page.evaluate(() => localStorage.getItem('fitsmart-agenda-auth-return'))).toBe(target);
});

test('Google sin configurar permanece deshabilitado y no simula acceso', async ({ page }) => {
  await page.goto('/mis-reservas');
  await expect(page.getByText('El acceso con Google está pendiente de configuración por el administrador.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeDisabled();
  await page.getByRole('button', { name: 'Prefiero recibir un enlace por correo' }).click();
  await expect(page.getByRole('button', { name: 'Enviar enlace de acceso' })).toBeEnabled();
});

test('enlace mágico: solicitud PKCE, retorno y formulario privado', async ({ page }) => {
  // Solo fixtures del protocolo Auth: no se envía correo ni se simula Supabase en producción.
  await page.route('**/auth/v1/otp*', async route => {
    expect(new URL(route.request().url()).searchParams.get('redirect_to')).toBe('http://127.0.0.1:5173/auth/confirm');
    const body = route.request().postDataJSON();
    expect(body.code_challenge).toBeTruthy();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  let exchanges = 0;
  await page.route('**/auth/v1/token*', async route => {
    exchanges++;
    expect(route.request().postDataJSON().code_verifier).toBeTruthy();
    const user = { id: '70000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test1@example.com', email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.fixture`;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user }) });
  });
  await page.goto(target);
  await page.getByRole('button', { name: 'Prefiero recibir un enlace por correo' }).click();
  await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill('test1@example.com');
  await page.getByRole('button', { name: 'Enviar enlace de acceso' }).click();
  await expect(page.getByRole('status')).toContainText('Solicitud aceptada');
  await expect(page.getByText(/Abre el enlace del correo/)).toBeVisible();
  await page.goto('/auth/confirm?code=test-fixture-code');
  await expect(page).toHaveURL(new RegExp(`${target}$`));
  await expect(page.getByRole('textbox', { name: 'Nombre completo del socio' })).toBeVisible();
  expect(exchanges).toBe(1);
});

test('enlace vencido o de otro navegador no concede acceso', async ({ page }) => {
  await page.route('**/auth/v1/token*', route => route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_grant","error_description":"Invalid code verifier"}' }));
  await page.goto('/auth/confirm?code=expired-fixture');
  await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/confirm$/);
  await expect(page.getByRole('alert')).toContainText('mismo navegador');
  await page.getByRole('link', { name: 'Solicitar otro enlace' }).click();
  await page.getByRole('button', { name: 'Prefiero recibir un enlace por correo' }).click();
  await expect(page.getByRole('button', { name: 'Enviar enlace de acceso' })).toBeVisible();
});

test('retorno sin código no muestra autenticación exitosa', async ({ page }) => {
  await page.goto('/auth/confirm?error=access_denied&error_description=untrusted');
  await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/confirm$/);
  await expect(page.getByText('untrusted', { exact: true })).toHaveCount(0);
});

test('correo no autorizado muestra la limitación sin afirmar envío', async ({ page }) => {
  await page.route('**/auth/v1/otp*', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{"code":"email_address_not_authorized","msg":"Email address not authorized"}' }));
  await page.goto('/mis-reservas');
  await page.getByRole('button', { name: 'Prefiero recibir un enlace por correo' }).click();
  await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill('test@example.invalid');
  await page.getByRole('button', { name: 'Enviar enlace de acceso' }).click();
  await expect(page.getByRole('alert')).toContainText('no está autorizado');
  await expect(page.getByRole('status')).toHaveCount(0);
});
