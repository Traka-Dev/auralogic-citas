import { expect, test, type Page } from '@playwright/test';
import { DateTime } from 'luxon';

async function register(page: Page, suffix: string) {
  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill('Persona de prueba');
  await page.getByLabel('Nombre del negocio').fill(`Estudio ${suffix}`);
  await page
    .getByLabel('Correo electrónico')
    .fill(`${suffix}-${Date.now()}@example.test`);
  await page.getByLabel('Contraseña').fill('Contraseña-prueba-123');
  await page.getByRole('button', { name: 'Crear mi espacio' }).click();
  await expect(
    page.getByRole('heading', { name: 'Hola, Persona.' }),
  ).toBeVisible();
}
test('reservation workflow, overlapping rejection, cancellation and customer history', async ({
  page,
}) => {
  await register(page, 'agenda');
  await page.goto('/servicios');
  await page.getByLabel('Nombre', { exact: true }).fill('Corte de prueba');
  await page.getByLabel('Precio').fill('350');
  await page.getByRole('button', { name: 'Guardar servicio' }).click();
  await expect(
    page.getByRole('cell', { name: 'Corte de prueba', exact: true }),
  ).toBeVisible();
  await page.goto('/equipo');
  await page.getByLabel('Nombre', { exact: true }).fill('María');
  await page.getByRole('button', { name: 'Guardar prestador' }).click();
  let day = DateTime.now().setZone('America/Mexico_City').plus({ days: 1 });
  if (day.weekday === 7) day = day.plus({ days: 1 });
  await page
    .getByRole('combobox', { name: 'Día', exact: true })
    .selectOption(String(day.weekday));
  await page.getByRole('button', { name: 'Guardar horario' }).click();
  await page.goto('/clientes');
  await page.getByLabel('Nombre', { exact: true }).fill('Valeria');
  await page
    .getByLabel('Teléfono con prefijo internacional')
    .fill('+525555010100');
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(
    page.getByRole('heading', { name: 'Valeria', exact: true }),
  ).toBeVisible();
  const customerUrl = page.url();
  await page.getByLabel('Añadir nota').fill('Prefiere atención por la mañana.');
  await page.getByRole('button', { name: 'Guardar nota' }).click();
  await expect(
    page.getByText('Prefiere atención por la mañana.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Agendar cita' }).click();
  await page.getByLabel('Fecha y hora').fill(`${day.toISODate()}T10:00`);
  await page.getByRole('button', { name: 'Reservar cita' }).click();
  await expect(
    page.getByRole('heading', { name: 'Todo para esta visita' }),
  ).toBeVisible();
  const appointmentUrl = page.url().split('?')[0]!;
  await page.getByRole('button', { name: 'Confirmar cita' }).click();
  await expect(page.locator('.status-confirmed')).toBeVisible();
  await page.goto('/agenda');
  await page.screenshot({
    path: 'test-results/agenda-desktop.png',
    fullPage: true,
  });
  await page.goto('/citas/nueva');
  await page.getByLabel('Fecha y hora').fill(`${day.toISODate()}T10:00`);
  await page.getByRole('button', { name: 'Reservar cita' }).click();
  await expect(page.getByRole('alert')).toContainText('ocupado');
  await page.goto(appointmentUrl);
  await page.getByRole('button', { name: 'Cancelar cita' }).click();
  await expect(page.locator('.status-cancelled')).toBeVisible();
  await page.goto(customerUrl);
  await expect(page.getByText('Cancelada', { exact: true })).toBeVisible();
});
test('persists clients after reload and isolates businesses', async ({
  page,
  browser,
}) => {
  await register(page, 'primero');
  await page.goto('/clientes');
  await page.getByLabel('Nombre', { exact: true }).fill('Cliente privado');
  await page
    .getByLabel('Teléfono con prefijo internacional')
    .fill('+525555010101');
  await page.getByRole('button', { name: 'Guardar cliente' }).click();
  const privateUrl = page.url();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Cliente privado' }),
  ).toBeVisible();
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await register(other, 'segundo');
  await other.goto(privateUrl);
  await expect(other.getByRole('alert')).toContainText('no disponible');
  await expect(
    other.getByRole('heading', { name: 'Cliente privado' }),
  ).toHaveCount(0);
  await otherContext.close();
});
test('requires login and rejects cross-origin requests', async ({ page }) => {
  await page.goto('/agenda');
  await expect(page).toHaveURL(/\/login$/);
  const response = await page.request.post('/api/auth', {
    headers: { origin: 'https://external.example' },
    form: { action: 'register' },
  });
  expect(response.status()).toBe(403);
});
test('renders every module without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await register(page, 'pantallas');
  for (const route of [
    '/agenda',
    '/clientes',
    '/servicios',
    '/equipo',
    '/tareas',
    '/reportes',
    '/whatsapp',
    '/citas/nueva',
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('accepts invitations and enforces agent permissions on the server', async ({
  page,
  browser,
}) => {
  await register(page, 'invitaciones');
  await page.goto('/equipo');
  await page.getByLabel('Correo de la persona').fill('agente@example.test');
  await page
    .getByRole('button', { name: 'Crear enlace de invitación' })
    .click();
  const invite = await page.getByLabel('Enlace de invitación').inputValue();
  const context = await browser.newContext();
  const agent = await context.newPage();
  await agent.goto(invite);
  await agent.getByLabel('Nombre', { exact: true }).fill('Agente');
  await agent.getByLabel('Contraseña').fill('Contraseña-agente-123');
  await agent.getByRole('button', { name: 'Aceptar invitación' }).click();
  await expect(
    agent.getByRole('heading', { name: 'Hola, Agente.' }),
  ).toBeVisible();
  await agent.goto('/servicios');
  await expect(
    agent.getByRole('button', { name: 'Guardar servicio' }),
  ).toHaveCount(0);
  const csrf = (await context.cookies()).find(
    (c) => c.name === 'auralogic_csrf',
  )!.value;
  await agent.request.post('/api/actions/service', {
    headers: { origin: 'http://127.0.0.1:4322' },
    form: {
      csrf,
      back: '/servicios',
      name: 'Servicio prohibido',
      duration: '30',
      price: '100',
    },
  });
  await agent.goto('/servicios');
  await expect(
    agent.getByRole('cell', { name: 'Servicio prohibido' }),
  ).toHaveCount(0);
  await agent.goto('/reportes');
  await expect(agent.getByRole('alert')).toContainText('permisos');
  await context.close();
});
test('works on a mobile viewport without a page-wide overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page, 'movil');
  await expect(
    page.getByRole('heading', { name: 'Hola, Persona.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto('/agenda');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
