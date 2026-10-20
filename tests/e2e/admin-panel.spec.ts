import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const api = 'http://127.0.0.1:54331/rest/v1';
function identity(index: number) {
  const user = {
    id: `70000000-0000-4000-8000-00000000000${index}`,
    aud: 'authenticated',
    role: 'authenticated',
    email: `test${index}@example.com`,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
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
const auth = (index: number) => ({ Authorization: `Bearer ${identity(index).access_token}` });
async function signIn(page: Page, index = 3) {
  await page.addInitScript(
    (s) => localStorage.setItem('fitsmart-agenda-auth', JSON.stringify(s)),
    identity(index),
  );
}
/** Sesión creada por el administrador de pruebas (usuario 3) a `days` días. */
async function createSession(
  request: APIRequestContext,
  room: string,
  days: number,
  capacity = 10,
) {
  const response = await request.post(`${api}/rpc/admin_save_session`, {
    headers: auth(3),
    data: {
      p_data: {
        class_id: '40000000-0000-4000-8000-000000000002',
        instructor_id: '30000000-0000-4000-8000-000000000002',
        location_id: '20000000-0000-4000-8000-000000000001',
        room,
        starts_at: new Date(Date.now() + days * 86400000).toISOString(),
        capacity,
        duration_minutes: 45,
        published: true,
      },
      p_id: null,
    },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as string;
}
test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:54331/__test/reset');
});

test('panel en pestañas: Hoy por defecto, la URL recuerda la pestaña y las flechas navegan', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/admin');
  await expect(page.getByRole('tab', { name: 'Hoy' })).toHaveAttribute('aria-selected', 'true');
  for (const metric of [
    'Clases hoy',
    'Llegadas registradas hoy',
    'No-shows · últimos 30 días',
    'Ocupación de las próximas clases',
  ])
    await expect(page.getByText(metric, { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Registrar llegada' })).toBeVisible();
  await page.getByRole('tab', { name: 'Agenda' }).click();
  await expect(page).toHaveURL(/\/admin\?vista=agenda$/);
  await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible(); // un encabezado por día
  await page.getByRole('tab', { name: 'Agenda' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Catálogo' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Catálogo' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Instructores ·/ })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test('cancelar una sesión exige motivo, avisa en el panel y el socio la ve cancelada por el gimnasio', async ({
  page,
  browser,
  request,
}, testInfo) => {
  const sessionId = await createSession(request, 'Sala por cancelar', 3);
  const reserved = await request.post(`${api}/rpc/reserve_session`, {
    headers: auth(1),
    data: { p_session_id: sessionId, p_member_name: 'Ana López', p_email: 'test1@example.com' },
  });
  expect(reserved.ok()).toBe(true);
  await signIn(page);
  await page.goto('/admin?vista=agenda');
  const row = page.locator('.admin-session').filter({ hasText: 'Sala por cancelar' });
  await row.getByRole('button', { name: 'Cancelar sesión' }).click();
  const form = row.getByRole('form', { name: /Cancelar/ });
  await expect(form).toContainText('Se cancelarán 1 reservas');
  await form.getByRole('button', { name: 'Confirmar cancelación' }).click();
  await expect(form.getByRole('alert')).toContainText('Escribe el motivo');
  await form.getByLabel('Motivo de la cancelación').fill('El instructor está enfermo');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath('cancelar-sesion.png'), fullPage: true });
  await form.getByRole('button', { name: 'Confirmar cancelación' }).click();
  await expect(row).toContainText('Cancelada');
  await expect(row).toContainText('Motivo: El instructor está enfermo');
  await expect(row.getByRole('button', { name: 'Editar sesión' })).toBeDisabled();

  const member = await browser.newPage();
  await signIn(member, 1);
  await member.goto('/mis-reservas');
  await member.getByRole('button', { name: /Historial/ }).click();
  const card = member.locator('.reservation-card').filter({ hasText: 'Sala por cancelar' });
  await expect(card).toContainText('Cancelada por el gimnasio');
  await expect(card).toContainText('Motivo: El instructor está enfermo');
  await member.goto(`/clases/${sessionId}`);
  await expect(member.getByRole('button', { name: 'Clase cancelada' })).toBeDisabled();
  await member.close();
});

test('nueva sesión semanal: se crean todas las semanas hasta la fecha indicada', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/admin?vista=agenda');
  await page.getByRole('button', { name: 'Nueva sesión', exact: true }).click();
  const editor = page.getByRole('region', { name: 'Editor de sesión' });
  await editor.getByLabel('Clase', { exact: false }).selectOption({ index: 1 });
  await editor.getByLabel('Instructor').selectOption({ index: 1 });
  await editor.getByLabel('Sala', { exact: true }).fill('Sala semanal');
  const start = new Date(Date.now() + 2 * 86400000 - 5 * 3600000); // hora de Lima
  await editor
    .getByLabel('Fecha y hora · Lima', { exact: true })
    .fill(start.toISOString().slice(0, 11) + '19:00');
  await editor.getByLabel('Repetir cada semana, mismo día y hora').check();
  await editor.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(editor.getByRole('alert')).toContainText('Indica hasta qué fecha');
  const until = new Date(start.getTime() + 21 * 86400000).toISOString().slice(0, 10);
  await editor.getByLabel('Repetir hasta (máximo 6 meses)').fill(until);
  await editor.getByRole('button', { name: 'Guardar sesión' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'sesiones semanales' })).toContainText(
    'Se crearon 4 sesiones semanales',
  );
  await page.getByRole('button', { name: 'Todas', exact: true }).click();
  await expect(page.locator('.admin-session').filter({ hasText: 'Sala semanal' })).toHaveCount(4);
});

test('catálogo: alta y edición de instructores', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin?vista=catalogo');
  await page.getByRole('button', { name: 'Nuevo instructor' }).click();
  const editor = page.getByRole('region', { name: 'Editor de instructor' });
  await editor.getByRole('button', { name: 'Guardar instructor' }).click();
  await expect(editor.getByRole('alert')).toContainText('nombre y apellido');
  await editor.getByLabel('Nombre del instructor').fill('Rosa Paredes');
  await editor.getByLabel('Especialidad o presentación').fill('Pilates y movilidad.');
  await editor.getByRole('button', { name: 'Guardar instructor' }).click();
  const card = page.locator('.admin-catalog-item').filter({ hasText: 'Rosa Paredes' });
  await expect(card).toContainText('Pilates y movilidad.');
  await card.getByRole('button', { name: 'Editar instructor' }).click();
  await page.getByLabel('Nombre del instructor').fill('Rosa Paredes Díaz');
  await page.getByRole('button', { name: 'Guardar instructor' }).click();
  await expect(
    page.locator('.admin-catalog-item').filter({ hasText: 'Rosa Paredes Díaz' }),
  ).toHaveCount(1);
});

test('la lista de espera es visible para el administrador en la agenda y en los inscritos', async ({
  page,
  request,
}) => {
  const sessionId = await createSession(request, 'Sala con fila', 2, 1);
  expect(
    (
      await request.post(`${api}/rpc/reserve_session`, {
        headers: auth(1),
        data: { p_session_id: sessionId, p_member_name: 'Ana López', p_email: 'test1@example.com' },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post(`${api}/rpc/join_waitlist`, {
        headers: auth(2),
        data: { p_session_id: sessionId, p_member_name: 'Beto Ruiz', p_email: 'test2@example.com' },
      })
    ).ok(),
  ).toBe(true);
  await signIn(page);
  await page.goto('/admin?vista=agenda');
  const row = page.locator('.admin-session').filter({ hasText: 'Sala con fila' });
  await expect(row).toContainText('Llena');
  await expect(row).toContainText('1 en espera');
  await row.getByRole('button', { name: 'Ver inscritos' }).click();
  const waitlist = page.getByRole('region', { name: 'Lista de espera' });
  await expect(
    waitlist.getByRole('heading', { name: 'Lista de espera · 1 esperando' }),
  ).toBeVisible();
  await expect(waitlist).toContainText('Beto Ruiz');
  await expect(waitlist).toContainText('test2@example.com');
});
