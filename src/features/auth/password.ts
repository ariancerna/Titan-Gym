import { requireSupabase } from '../../lib/supabase/client';
import { privacyPolicyVersion } from '../../content/privacy';
import {
  magicLinkRedirect,
  rememberReturnPath,
  resetPasswordPath,
} from '../../lib/supabase/magic-link';

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const client = requireSupabase();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  const verified = await client.auth.getUser();
  if (
    verified.error ||
    !verified.data.user?.email_confirmed_at ||
    verified.data.user.is_anonymous ||
    verified.data.user.id !== result.data.user?.id
  ) {
    await client.auth.signOut({ scope: 'local' });
    throw new Error('AUTH_REQUIRED');
  }
}

export async function createAccountPassword(password: string): Promise<void> {
  const client = requireSupabase();
  const verified = await client.auth.getUser();
  if (verified.error || !verified.data.user?.email_confirmed_at || verified.data.user.is_anonymous)
    throw new Error('AUTH_REQUIRED');
  const result = await client.auth.updateUser({ password });
  if (result.error) throw result.error;
  if (result.data.user.id !== verified.data.user.id) throw new Error('AUTH_REQUIRED');
}

/**
 * Crea la cuenta y envía el correo de confirmación. Devuelve true si Supabase ya inició sesión
 * (cuando la confirmación de correo está desactivada) y false si hay que confirmar el correo.
 * Si el correo ya existe, Supabase responde igual que con uno nuevo para no revelar qué cuentas existen.
 */
export async function signUpWithPassword(email: string, password: string): Promise<boolean> {
  const result = await requireSupabase().auth.signUp({
    email,
    password,
    // La base de datos registra la aceptación (y su fecha) al crear el usuario.
    options: {
      emailRedirectTo: magicLinkRedirect(),
      data: { privacy_version: privacyPolicyVersion },
    },
  });
  if (result.error) throw result.error;
  return Boolean(result.data.session);
}

/** Envía el correo para elegir una contraseña nueva. La respuesta es la misma exista o no la cuenta. */
export async function requestPasswordReset(email: string): Promise<void> {
  rememberReturnPath(resetPasswordPath);
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: magicLinkRedirect(),
  });
  if (error) throw error;
}
