import type { User } from '@supabase/supabase-js';
import { requireSupabase } from '../../lib/supabase/client';

/** Nombre guardado en el perfil. Google lo aporta como full_name al crear la cuenta. */
export function savedName(user: User | null): string {
  const name = user?.user_metadata?.full_name;
  return typeof name === 'string' ? name : '';
}

/** Guarda el nombre para completar las próximas reservas. No cambia las reservas ya hechas. */
export async function saveName(name: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ data: { full_name: name } });
  if (error) throw error;
}

/** Formas de entrar que tiene la cuenta, para mostrarlas en el perfil. */
export function signInMethods(user: User, password: boolean): string[] {
  const providers: unknown[] = user.app_metadata?.providers ?? [user.app_metadata?.provider];
  const methods: string[] = [];
  if (providers.includes('google')) methods.push('Google');
  if (password) methods.push('Correo y contraseña');
  if (providers.includes('email')) methods.push('Enlace al correo');
  return methods;
}
