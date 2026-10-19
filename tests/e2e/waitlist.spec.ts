import { test, expect, type Page } from '@playwright/test';

// Sesión llena del seed (18/18), a dos días: siempre fuera de la última hora.
const full = '50000000-0000-4000-8000-000000000003';

function identity() {
  const user = { id: '70000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test1@example.com', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.fixture`;
  return { access_token, refresh_token: 'fixture', expires_in: 3600, expires_at: exp, token_type: 'bearer', user };
}
async function signedIn(page: Page) {
  await page.addInitScript(session => localStorage.setItem('fitsmart-agenda-auth', JSON.stringify(session)), identity());
}
test.beforeEach(async ({ request }) => { await request.post('http://127.0.0.1:54331/__test/reset'); });

test('US08: en una clase llena el socio se une a la lista de espera, ve su posición y puede salir', async ({ page }, testInfo) => {
  await signedIn(page);
  await page.goto(`/clases/${full}`);
  await expect(page.getByRole('button', { name: 'Clase completa' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Unirme a la lista de espera' }).click();
  await expect(page).toHaveURL(new RegExp(`/reservar/${full}$`));
  await expect(page.getByRole('heading', { name: 'Únete a la lista de espera' })).toBeVisible();
  await page.getByRole('button', { name: 'Unirme a la lista de espera' }).click();
  await expect(page.getByText('Ingresa tu nombre completo')).toBeVisible();
  await page.getByLabel('Nombre completo del socio').fill('Ana López');
  await page.getByRole('checkbox', { name: /Si me asignan un cupo/ }).check();
  await page.getByRole('button', { name: 'Unirme a la lista de espera' }).click();
  await expect(page).toHaveURL(/\/mis-reservas/);
  const section = page.getByRole('region', { name: 'Lista de espera' });
  await expect(section).toContainText('Entrenamiento Funcional Élite');
  await expect(section).toContainText('Posición 1');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('lista-espera.png'), fullPage: true });
  // Volver a la clase muestra la posición en lugar de un segundo formulario.
  await page.goto(`/reservar/${full}`);
  await expect(page.getByRole('heading', { name: 'Ya estás en la lista de espera' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unirme a la lista de espera' })).toHaveCount(0);
  await page.goto('/mis-reservas');
  await section.getByRole('button', { name: 'Salir de la lista' }).click();
  await section.getByRole('button', { name: 'Seguir en la lista' }).click();
  await expect(section).toContainText('Posición 1');
  await section.getByRole('button', { name: 'Salir de la lista' }).click();
  await section.getByRole('button', { name: 'Sí, salir' }).click();
  await expect(page.getByRole('region', { name: 'Lista de espera' })).toHaveCount(0);
});

test('US08: un visitante ve la lista de espera en la clase llena y se le pide ingresar', async ({ page }) => {
  await page.goto(`/clases/${full}`);
  await page.getByRole('link', { name: 'Unirme a la lista de espera' }).click();
  await expect(page.getByRole('heading', { name: 'Lista de espera' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accede a tu cuenta' })).toBeVisible();
});
