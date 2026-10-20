// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error función JavaScript de api/ sin tipos
import { createHandler } from '../../api/recordatorios.js';

const secret = 'a'.repeat(64);
const env = {
  CRON_SECRET: secret,
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  SMTP_USER: 'gym@example.com',
  SMTP_PASS: 'app-password',
};
const summary = {
  dryRun: false,
  reminders: { pending: 1, sent: 1, failed: 0 },
  waitlist: { pending: 0, sent: 0, failed: 0 },
  cancellations: { pending: 0, sent: 0, failed: 0 },
};

function call(handler: ReturnType<typeof createHandler>, req: Record<string, unknown>) {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return handler({ method: 'POST', headers: {}, query: {}, ...req } as never, res as never).then(
    () => res,
  );
}

describe('/api/recordatorios', () => {
  it('solo acepta POST', async () => {
    const res = await call(createHandler(vi.fn(), env), { method: 'GET' });
    expect(res.statusCode).toBe(405);
  });

  it('rechaza sin la clave o con una clave distinta, sin ejecutar la tarea', async () => {
    const run = vi.fn();
    const handler = createHandler(run, env);
    expect((await call(handler, {})).statusCode).toBe(401);
    expect(
      (await call(handler, { headers: { authorization: `Bearer ${'b'.repeat(64)}` } })).statusCode,
    ).toBe(401);
    expect((await call(handler, { headers: { authorization: 'Bearer corta' } })).statusCode).toBe(
      401,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('no funciona si CRON_SECRET no está configurado o es débil', async () => {
    const res = await call(createHandler(vi.fn(), { ...env, CRON_SECRET: 'corta' }), {
      headers: { authorization: 'Bearer corta' },
    });
    expect(res.statusCode).toBe(503);
  });

  it('avisa qué variables faltan en Vercel', async () => {
    const res = await call(createHandler(vi.fn(), { ...env, SMTP_PASS: '' }), {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Faltan variables en Vercel: SMTP_PASS' });
  });

  it('con la clave correcta ejecuta la tarea y devuelve solo cantidades', async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, summary });
    const res = await call(createHandler(run, env), {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(run).toHaveBeenCalledWith({ env, dryRun: false });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(summary);
  });

  it('acepta la URL de Supabase con prefijo VITE_ y la prueba en seco no pide SMTP', async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, summary });
    const viteEnv = {
      CRON_SECRET: secret,
      VITE_SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 's',
    };
    const res = await call(createHandler(run, viteEnv), {
      headers: { authorization: `Bearer ${secret}` },
      query: { dry_run: '1' },
    });
    expect(res.statusCode).toBe(200);
    expect(run).toHaveBeenCalledWith({ env: viteEnv, dryRun: true });
  });
});
