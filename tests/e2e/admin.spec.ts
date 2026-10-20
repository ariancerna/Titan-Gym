import { test, expect, type Page } from '@playwright/test';
function identity(index: number) {
  const user = {
    id: `70000000-0000-4000-8000-00000000000${index}`,
    aud: 'authenticated',
    role: 'authenticated',
    email: `test${index}@example.com`,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: { role: 'admin' },
    created_at: new Date().toISOString(),
  };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp, role: 'authenticated' })}.fixture`,
    refresh_token: 'fixture',
    expires_in: 3600,
    expires_at: exp,
    token_type: 'bearer',
    user,
  };
}
async function signIn(page: Page, index = 3) {
  await page.addInitScript(
    (s) => localStorage.setItem('fitsmart-agenda-auth', JSON.stringify(s)),
    identity(index),
  );
}
test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:54331/__test/reset');
});

test('acceso administrativo solicita correo y contraseña sin conceder rol', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Acceso de administradores' })).toBeVisible();
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva clase', exact: true })).toHaveCount(0);
});

test('socio con metadata admin no puede ver panel ni inscritos', async ({ page }) => {
  await signIn(page, 1);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva clase', exact: true })).toHaveCount(0);
  await expect(page.getByText('socio-demo-1@titan.invalid', { exact: true })).toHaveCount(0);
});

test('contraseña administrativa verifica rol y cerrar sesión oculta datos privados', async ({
  page,
}) => {
  await page.route('**/auth/v1/token*', async (route) => {
    expect(new URL(route.request().url()).searchParams.get('grant_type')).toBe('password');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(identity(3)),
    });
  });
  await page.goto('/admin');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('test3@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-administrativa-fixture');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Hoy' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Agenda' }).click();
  await page.getByRole('button', { name: 'Pasadas', exact: true }).click();
  await page
    .locator('.admin-session')
    .filter({ hasText: 'Sala asistencia de pruebas' })
    .getByRole('button', { name: 'Ver inscritos' })
    .click();
  await expect(page.getByText('socio-demo-1@titan.invalid', { exact: true })).toBeVisible();
  // Cerrar sesión está en el menú de la cuenta (escritorio) o en el menú desplegable (tablet y móvil).
  const account = page.getByRole('button', { name: /^Cuenta de / });
  if (await account.isVisible()) await account.click();
  else await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acceso de administradores' })).toBeVisible();
  await expect(page.getByText('socio-demo-1@titan.invalid', { exact: true })).toHaveCount(0);
});

test('administrador crea clase y sesión, publica y conserva al recargar', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin?vista=catalogo');
  await page.getByRole('button', { name: 'Nueva clase', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Editor de clase' });
  await editor
    .getByLabel('Nombre de la clase', { exact: true })
    .fill('Entrenamiento administrativo');
  await editor.getByLabel('Disciplina').selectOption({ label: 'Spinning' });
  await editor
    .getByLabel('Descripción', { exact: true })
    .fill('Clase creada desde el panel administrativo y guardada en PostgreSQL.');
  await editor.getByLabel('Fotografía de la clase').selectOption({ index: 1 });
  await editor.getByRole('button', { name: 'Guardar clase' }).click();
  await expect(page.getByRole('status')).toContainText('Cambios guardados');
  await page.getByRole('tab', { name: 'Agenda' }).click();
  await page.getByRole('button', { name: 'Nueva sesión', exact: true }).click();
  const session = page.getByRole('region', { name: 'Editor de sesión' });
  await session
    .getByLabel('Clase', { exact: false })
    .selectOption({ label: 'Entrenamiento administrativo' });
  await session.getByLabel('Instructor').selectOption({ index: 1 });
  await expect(session.getByLabel('Sede')).toHaveCount(0); // una sola sede: se asigna sola
  await session.getByLabel('Sala', { exact: true }).fill('Sala nueva');
  const future = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16);
  await session.getByLabel('Fecha y hora · Lima', { exact: true }).fill(future);
  await session.getByLabel('Capacidad máxima', { exact: true }).fill('12');
  await session.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(page.getByRole('status')).toContainText('Cambios guardados');
  await page.reload();
  await expect(
    page.locator('.admin-session').filter({ hasText: 'Entrenamiento administrativo' }),
  ).toHaveCount(1);
  await page.goto('/clases');
  await expect(page.getByRole('heading', { name: 'Entrenamiento administrativo' })).toBeVisible();
});

test('inscritos y asistencia se guardan con historial en tres tamaños', async ({
  page,
}, testInfo) => {
  await signIn(page);
  await page.goto('/admin?vista=agenda');
  await expect(page.getByRole('button', { name: 'Nueva sesión', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pasadas', exact: true }).click();
  const past = page.locator('.admin-session').filter({ hasText: 'Sala asistencia de pruebas' });
  await past.getByRole('button', { name: 'Ver inscritos' }).click();
  const roster = page.getByRole('region', { name: 'Inscritos y asistencia' });
  await expect(roster.getByRole('heading', { name: 'Alumno de asistencia' })).toBeVisible();
  await roster.getByLabel('Asistencia de Alumno de asistencia').selectOption('present');
  await expect(roster.getByRole('status')).toContainText('Asistencia guardada');
  await expect(roster.getByText('Presente', { exact: true }).first()).toBeVisible();
  await expect(roster.getByText('Historial de asistencia (1)', { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('admin-asistencia.png'), fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: 'Pasadas', exact: true }).click();
  await past.getByRole('button', { name: 'Ver inscritos' }).click();
  await expect(roster.getByLabel('Asistencia de Alumno de asistencia')).toHaveValue('present');
  await roster.getByLabel('Asistencia de Alumno de asistencia').selectOption('absent');
  await expect(roster.getByText('Historial de asistencia (2)', { exact: true })).toBeVisible();
});

test('HU09: indicador de no-shows y exportación del dataset seudonimizado', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin?vista=indicadores');
  const indicators = page.getByRole('region', { name: 'Asistencia e inasistencias' });
  await expect(indicators.getByText('Tasa de no-shows')).toBeVisible();
  await expect(indicators.getByText('1 reservas sin registrar')).toBeVisible();
  await page.getByRole('tab', { name: 'Agenda' }).click();
  await page.getByRole('button', { name: 'Pasadas', exact: true }).click();
  const past = page.locator('.admin-session').filter({ hasText: 'Sala asistencia de pruebas' });
  await past.getByRole('button', { name: 'Ver inscritos' }).click();
  await page.getByLabel('Asistencia de Alumno de asistencia').selectOption('absent');
  await expect(page.getByRole('status').filter({ hasText: 'Asistencia guardada' })).toBeVisible();
  await page.getByRole('tab', { name: 'Indicadores' }).click();
  await expect(indicators.locator('.indicator-main dd')).toHaveText('100%');
  await expect(indicators.getByText('1 de 1 asistencias registradas')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    indicators.getByRole('button', { name: 'Exportar dataset CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^fitsmart-dataset-\d{4}-\d{2}-\d{2}\.csv$/);
  const content = await (await download.createReadStream())
    .toArray()
    .then((chunks) => Buffer.concat(chunks).toString('utf8'));
  expect(content).toContain('reserva_id,socio_ref,sesion_id');
  expect(content).toContain(',absent,false');
  expect(content).not.toContain('Alumno de asistencia');
  expect(content).not.toContain('@titan.invalid');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test('error de conexión no muestra un panel ni éxito ficticios', async ({ page }) => {
  await signIn(page);
  await page.route('**/rest/v1/rpc/admin_snapshot', (route) => route.abort('failed'));
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Agenda no disponible' })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText('Cambios guardados en la base de datos.')).toHaveCount(0);
});

test('asistencia futura deshabilitada y sesión reservada protegida', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin?vista=agenda');
  const future = page
    .locator('.admin-session')
    .filter({ hasText: 'Sala de Ciclismo' })
    .filter({ hasText: '21/25' });
  await future.getByRole('button', { name: 'Ver inscritos' }).click();
  const roster = page.getByRole('region', { name: 'Inscritos y asistencia' });
  await expect(roster.getByRole('combobox').first()).toBeDisabled();
  await future.getByRole('button', { name: 'Editar sesión' }).click();
  await expect(page.getByLabel('Sala', { exact: true })).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('Capacidad máxima', { exact: true })).toHaveAttribute('min', '21');
  // Q5: los campos bloqueados están deshabilitados de verdad y no cambian al hacer clic.
  const editor = page.getByRole('region', { name: 'Editor de sesión' });
  await expect(editor.getByLabel('Instructor')).toBeDisabled();
  const publish = editor.getByLabel('Publicar en el catálogo');
  await expect(publish).toBeDisabled();
  await publish.click({ force: true });
  await expect(publish).toBeChecked();
  await editor.getByLabel('Capacidad máxima', { exact: true }).fill('26');
  await editor.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(page.getByText('Cambios guardados en la base de datos.')).toBeVisible();
  await expect(
    page
      .locator('.admin-session')
      .filter({ hasText: 'Sala de Ciclismo' })
      .filter({ hasText: '21/26' }),
  ).toHaveCount(1);
});

test('la agenda se muestra por tandas de 7 días', async ({ page, request }) => {
  const headers = { Authorization: `Bearer ${identity(3).access_token}` };
  for (let day = 2; day <= 10; day++) {
    const response = await request.post('http://127.0.0.1:54331/rest/v1/rpc/admin_save_session', {
      headers,
      data: {
        p_data: {
          class_id: '40000000-0000-4000-8000-000000000002',
          instructor_id: '30000000-0000-4000-8000-000000000002',
          location_id: '20000000-0000-4000-8000-000000000001',
          room: 'Sala por tandas',
          starts_at: new Date(Date.now() + day * 86400000).toISOString(),
          capacity: 10,
          duration_minutes: 45,
          published: true,
        },
        p_id: null,
      },
    });
    expect(response.ok()).toBe(true);
  }
  await signIn(page);
  await page.goto('/admin?vista=agenda');
  await expect(page.locator('.admin-day')).toHaveCount(7);
  await page.getByRole('button', { name: 'Mostrar 7 días más' }).click();
  await expect(page.locator('.admin-day').nth(7)).toBeVisible();
  await expect(page.locator('.admin-session').filter({ hasText: 'Sala por tandas' })).toHaveCount(
    9,
  );
  await page.getByRole('button', { name: 'Pasadas', exact: true }).click();
  await expect(page.getByText(/últimos 90 días/)).toBeVisible();
});

test('acceso administrativo ofrece Google y regresa a /admin sin conceder el rol', async ({
  page,
}) => {
  await page.route('**/auth/v1/settings', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"external":{"google":true,"email":true}}',
    }),
  );
  await page.route('**/auth/v1/authorize*', async (route) => {
    expect(new URL(route.request().url()).searchParams.get('provider')).toBe('google');
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<h1>Proveedor Google de prueba</h1>',
    });
  });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Acceso de administradores' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar con Google' }).click();
  await expect(page.getByRole('heading', { name: 'Proveedor Google de prueba' })).toBeVisible();
  await page.goto('/admin');
  expect(await page.evaluate(() => localStorage.getItem('fitsmart-agenda-auth-return'))).toBe(
    '/admin',
  );
  await expect(page.getByRole('button', { name: 'Nueva clase', exact: true })).toHaveCount(0);
});

test('recepción registra la llegada con el código del QR, una sola vez', async ({
  page,
  request,
}) => {
  const api = 'http://127.0.0.1:54331/rest/v1';
  const admin = { Authorization: `Bearer ${identity(3).access_token}` };
  const member = { Authorization: `Bearer ${identity(1).access_token}` };
  const sessionId = await (
    await request.post(`${api}/rpc/admin_save_session`, {
      headers: admin,
      data: {
        p_data: {
          class_id: '40000000-0000-4000-8000-000000000001',
          instructor_id: '30000000-0000-4000-8000-000000000001',
          location_id: '20000000-0000-4000-8000-000000000001',
          room: 'Sala QR de pruebas',
          starts_at: new Date(Date.now() + 20 * 60000).toISOString(),
          capacity: 10,
          duration_minutes: 45,
          published: true,
        },
        p_id: null,
      },
    })
  ).json();
  const reservationId = await (
    await request.post(`${api}/rpc/reserve_session`, {
      headers: member,
      data: { p_session_id: sessionId, p_member_name: 'Ana López', p_email: 'test1@example.com' },
    })
  ).json();
  const [{ code }] = await (
    await request.get(`${api}/reservations?id=eq.${reservationId}`, { headers: member })
  ).json();
  expect(code).toMatch(/^TG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

  await signIn(page);
  await page.goto('/admin');
  const panel = page.getByRole('region', { name: 'Registrar llegada' });
  await expect(panel.getByRole('button', { name: 'Escanear QR' })).toBeVisible();
  const input = panel.getByLabel('Código de reserva');
  await input.fill('ABC');
  await panel.getByRole('button', { name: 'Registrar llegada' }).click();
  await expect(panel.getByRole('alert')).toContainText('TG- seguido de 6 caracteres');
  await input.fill('TG-ZZZZZZ');
  await panel.getByRole('button', { name: 'Registrar llegada' }).click();
  await expect(panel.getByRole('alert')).toContainText('No existe una reserva con ese código');
  await input.fill(code.toLowerCase());
  await panel.getByRole('button', { name: 'Registrar llegada' }).click();
  await expect(panel.getByRole('status')).toContainText('Llegada registrada: Ana López');
  await panel.getByRole('button', { name: 'Registrar llegada' }).click();
  await expect(panel.getByRole('status')).toContainText('Ya estaba registrado: Ana López');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
