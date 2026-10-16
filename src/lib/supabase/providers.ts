export async function getGoogleAvailability(): Promise<boolean> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  // Configuración pública de Auth, sin leer secretos del proveedor.
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  if (!response.ok) throw new Error('No se pudo consultar la configuración de acceso.');
  const settings: unknown = await response.json();
  if (typeof settings !== 'object' || settings === null || !('external' in settings))
    throw new Error('Configuración de acceso inválida.');
  const external = settings.external;
  if (
    typeof external !== 'object' ||
    external === null ||
    !('google' in external) ||
    typeof external.google !== 'boolean'
  )
    throw new Error('Configuración de Google inválida.');
  return external.google;
}
