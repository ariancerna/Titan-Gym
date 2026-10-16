import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key);
export const supabase = configured
  ? createClient(url, key, {
      auth: { storageKey: 'fitsmart-agenda-auth', flowType: 'pkce', detectSessionInUrl: false },
    })
  : null;
export function requireSupabase() {
  if (!supabase)
    throw new Error(
      'La agenda aún no está conectada. Configura Supabase para consultar clases y registrar reservas.',
    );
  return supabase;
}
