import { test, expect } from '@playwright/test';
test('navegación, identidad visual original y responsive sin desbordamiento', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SUPERA TUS LÍMITES' })).toBeVisible();
  await expect(page.locator('.brand img')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explorar clases', exact: true })).toBeVisible();
  await expect(page.locator('.class-card')).toHaveCount(3);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {}))); });
  await expect.poll(() => page.locator('.hero-photo').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('inicio.png'), fullPage: true });
  await page.getByRole('link', { name: 'Explorar clases', exact: true }).click();
  await expect(page).toHaveURL(/\/clases$/);
  await expect(page.getByRole('heading', { name: 'Horarios y clases disponibles' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar clases' }).fill('Spinning');
  await page.getByRole('button', { name: 'Yoga', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Yoga', exact: true })).toHaveAttribute('aria-pressed','true');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/mis-reservas');
  await expect(page.getByRole('heading', { name: 'Accede a tu cuenta' })).toBeVisible();
  await page.goto('/ruta-inexistente');
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
});
test('una confirmación exige identidad, nunca muestra éxito falso', async ({ page }) => {
  await page.goto('/reserva-confirmada/00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('heading', { name: 'Accede a tu cuenta' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '¡Reserva confirmada!' })).toHaveCount(0);
});
