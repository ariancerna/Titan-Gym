import { test, expect, type Page } from '@playwright/test';
function identity(index: number) {
  const user = { id: `70000000-0000-4000-8000-00000000000${index}`, aud: 'authenticated', role: 'authenticated', email: `test${index}@example.com`, email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: { role: 'admin' }, created_at: new Date().toISOString() };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.fixture`, refresh_token: 'fixture', expires_in: 3600, expires_at: exp, token_type: 'bearer', user };
}
async function signIn(page: Page, index = 3) { await page.addInitScript(s => localStorage.setItem('fitsmart-agenda-auth', JSON.stringify(s)), identity(index)); }
test.beforeEach(async ({ request }) => { await request.post('http://127.0.0.1:54331/__test/reset'); });

test('acceso administrativo solicita correo y contraseña sin conceder rol', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Acceso de administradores' })).toBeVisible();
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva clase', exact: true })).toHaveCount(0);
});

test('socio con metadata admin no puede ver panel ni inscritos', async ({ page }) => {
  await signIn(page, 1); await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva clase', exact: true })).toHaveCount(0);
  await expect(page.getByText('socio-demo-1@titan.invalid', { exact: true })).toHaveCount(0);
});

test('contraseña administrativa verifica rol y cerrar sesión oculta datos privados', async ({ page }) => {
  await page.route('**/auth/v1/token*', async route => {
    expect(new URL(route.request().url()).searchParams.get('grant_type')).toBe('password');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(identity(3)) });
  });
  await page.goto('/admin');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('test3@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-administrativa-fixture');
  await page.getByRole('button', { name: 'Iniciar sesión con contraseña' }).click();
  await expect(page.getByRole('button', { name: 'Nueva clase', exact: true })).toBeVisible();
  await page.locator('.admin-session').filter({ hasText: 'Sala asistencia de pruebas' }).getByRole('button', { name: 'Ver inscritos' }).click();
  await expect(page.getByText('socio-demo-1@titan.invalid', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acceso de administradores' })).toBeVisible();
  await expect(page.getByText('socio-demo-1@titan.invalid', { exact: true })).toHaveCount(0);
});

test('administrador crea clase y sesión, publica y conserva al recargar', async ({ page }) => {
  await signIn(page); await page.goto('/admin');
  await page.getByRole('button', { name: 'Nueva clase', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Editor de clase' });
  await editor.getByLabel('Nombre de la clase', { exact: true }).fill('Entrenamiento administrativo');
  await editor.getByLabel('Disciplina').selectOption({ label: 'Spinning' });
  await editor.getByLabel('Descripción', { exact: true }).fill('Clase creada desde el panel administrativo y guardada en PostgreSQL.');
  await editor.getByLabel('Fotografía de la clase').selectOption({ index: 1 });
  await editor.getByRole('button', { name: 'Guardar clase' }).click();
  await expect(page.getByRole('status')).toContainText('Cambios guardados');
  await page.getByRole('button', { name: 'Nueva sesión', exact: true }).click();
  const session = page.getByRole('region', { name: 'Editor de sesión' });
  await session.getByLabel('Clase', { exact: false }).selectOption({ label: 'Entrenamiento administrativo' });
  await session.getByLabel('Instructor').selectOption({ index: 1 });
  await session.getByLabel('Sede').selectOption({ index: 1 });
  await session.getByLabel('Sala', { exact: true }).fill('Sala nueva');
  const future = new Date(Date.now() + 86400000 * 12).toISOString().slice(0, 16);
  await session.getByLabel('Fecha y hora · Lima', { exact: true }).fill(future);
  await session.getByLabel('Capacidad máxima', { exact: true }).fill('12');
  await session.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(page.getByRole('status')).toContainText('Cambios guardados');
  await page.reload();
  await expect(page.locator('.admin-session').filter({ hasText: 'Entrenamiento administrativo' })).toHaveCount(1);
  await page.goto('/clases');
  await expect(page.getByRole('heading', { name: 'Entrenamiento administrativo' })).toBeVisible();
});

test('inscritos y asistencia se guardan con historial en tres tamaños', async ({ page }, testInfo) => {
  await signIn(page); await page.goto('/admin');
  await expect(page.getByRole('button', { name: 'Nueva clase', exact: true })).toBeVisible();
  const past = page.locator('.admin-session').filter({ hasText: 'Sala asistencia de pruebas' });
  await past.getByRole('button', { name: 'Ver inscritos' }).click();
  const roster = page.getByRole('region', { name: 'Inscritos y asistencia' });
  await expect(roster.getByRole('heading', { name: 'Alumno de asistencia' })).toBeVisible();
  await roster.getByLabel('Asistencia de Alumno de asistencia').selectOption('present');
  await expect(roster.getByRole('status')).toContainText('Asistencia guardada');
  await expect(roster.getByText('Presente', { exact: true }).first()).toBeVisible();
  await expect(roster.getByText('Historial de asistencia (1)', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('admin-asistencia.png'), fullPage: true });
  await page.reload(); await past.getByRole('button', { name: 'Ver inscritos' }).click();
  await expect(roster.getByLabel('Asistencia de Alumno de asistencia')).toHaveValue('present');
  await roster.getByLabel('Asistencia de Alumno de asistencia').selectOption('absent');
  await expect(roster.getByText('Historial de asistencia (2)', { exact: true })).toBeVisible();
});

test('error de conexión no muestra un panel ni éxito ficticios', async ({ page }) => {
  await signIn(page);
  await page.route('**/rest/v1/rpc/admin_snapshot', route => route.abort('failed'));
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Agenda no disponible' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Cambios guardados en la base de datos.')).toHaveCount(0);
});

test('asistencia futura deshabilitada y sesión reservada protegida', async ({ page }) => {
  await signIn(page); await page.goto('/admin');
  const future = page.locator('.admin-session').filter({ hasText: 'Sala de Ciclismo' }).filter({ hasText: '21/25' });
  await future.getByRole('button', { name: 'Ver inscritos' }).click();
  const roster = page.getByRole('region', { name: 'Inscritos y asistencia' });
  await expect(roster.getByRole('combobox').first()).toBeDisabled();
  await future.getByRole('button', { name: 'Editar sesión' }).click();
  await expect(page.getByLabel('Sala', { exact: true })).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('Capacidad máxima', { exact: true })).toHaveAttribute('min', '21');
});
