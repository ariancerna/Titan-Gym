import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGoogleAvailability } from '../../src/lib/supabase/providers';

describe('disponibilidad real del proveedor Google', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.example.invalid');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it.each([true, false])('respeta el estado alojado: %s', async enabled => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: enabled } }) });
    vi.stubGlobal('fetch', fetcher);
    expect(await getGoogleAvailability()).toBe(enabled);
    expect(fetcher).toHaveBeenCalledWith('https://test.example.invalid/auth/v1/settings', { headers: { apikey: 'public-test-key' } });
  });
  it('no asume Google disponible ante una respuesta inválida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: 'true' } }) }));
    await expect(getGoogleAvailability()).rejects.toThrow('Configuración de Google inválida');
  });
  it('no asume Google disponible ante error de conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(getGoogleAvailability()).rejects.toThrow('No se pudo consultar');
  });
});
