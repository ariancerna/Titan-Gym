import { test, expect } from '@playwright/test';
test('navegación, identidad visual TITAN y responsive sin desbordamiento', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SUPERA TUS LÍMITES' })).toBeVisible();
  await expect(page.locator('.brand img')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explorar clases', exact: true })).toBeVisible();
  await expect(page.locator('.class-card')).toHaveCount(3);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {}))); });
  await expect(page.locator('.hero-photo')).toHaveAttribute('src', '/assets/generated/hero.jpg');
  await expect.poll(() => page.locator('.hero-photo').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThanOrEqual(1600);
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
test('nuevo logo, favicon y seis fotografías de disciplinas cargan correctamente', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('.brand img')).toHaveAttribute('src', '/assets/brands/titan-mark.png');
  await expect.poll(() => page.locator('.brand img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(128);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.png');
  const icon = await request.get('/favicon.png');
  expect(icon.status()).toBe(200); expect(icon.headers()['content-type']).toContain('image/png');
  const dimensions = await page.evaluate(async () => { const i = new Image(); i.src = '/favicon.png'; await i.decode(); return [i.naturalWidth, i.naturalHeight]; });
  expect(dimensions).toEqual([48, 48]);
  const alpha = await page.evaluate(async () => {
    const results: number[] = [];
    for (const src of ['/favicon.png', '/assets/brands/titan-mark.png']) {
      const img = new Image(); img.src = src; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d')!; context.drawImage(img, 0, 0);
      results.push(context.getImageData(0, 0, 1, 1).data[3]);
    }
    return results;
  });
  expect(alpha).toEqual([0, 0]);
  for (let n = 1; n <= 6; n++) {
    await page.goto(`/clases/50000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
    await expect(page.locator('.detail-image img')).toHaveAttribute('src', /^\/assets\/generated\/.+\.jpg$/);
    await expect.poll(() => page.locator('.detail-image img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThanOrEqual(1600);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
test('sede única Qatuna incluso sin sesiones y sin avisos de IA en la interfaz', async ({ page }) => {
  await page.route('**/rest/v1/rpc/list_sessions', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Nuestra sede', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText('Isabel Chimpu Ocllo cdra 10, Carabayllo 15318', { exact: false })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('Isabel Chimpu Ocllo cdra 10, Carabayllo 15318');
  await expect(page.getByText('Sede Norte', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Sede Financiera', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Imágenes de entrenamiento ilustrativas.', { exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/inteligencia artificial|generad[oa]s? (con|por) IA/i);
  await page.unroute('**/rest/v1/rpc/list_sessions');
  await page.goto('/clases');
  await expect(page.getByText('Sede activa')).toHaveCount(0);
  await expect(page.locator('.class-card')).toHaveCount(8);
  // Con una sola sede, la tarjeta muestra la sala; la sede está en la portada y el pie de página.
  for (const card of await page.locator('.class-card').all()) await expect(card).toContainText(/Sala /);
  await expect(page.getByRole('contentinfo')).toContainText('TITAN GYM QATUNA');
});
test('una confirmación exige identidad, nunca muestra éxito falso', async ({ page }) => {
  await page.goto('/reserva-confirmada/00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('heading', { name: 'Accede a tu cuenta' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '¡Reserva confirmada!' })).toHaveCount(0);
});
