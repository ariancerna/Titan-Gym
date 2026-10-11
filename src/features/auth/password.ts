import { requireSupabase } from '../../lib/supabase/client';

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const client = requireSupabase();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  const verified = await client.auth.getUser();
  if (verified.error || !verified.data.user?.email_confirmed_at || verified.data.user.is_anonymous || verified.data.user.id !== result.data.user?.id) {
    await client.auth.signOut({ scope: 'local' });
    throw new Error('AUTH_REQUIRED');
  }
}

export async function createAccountPassword(password: string): Promise<void> {
  const client = requireSupabase();
  const verified = await client.auth.getUser();
  if (verified.error || !verified.data.user?.email_confirmed_at || verified.data.user.is_anonymous) throw new Error('AUTH_REQUIRED');
  const result = await client.auth.updateUser({ password });
  if (result.error) throw result.error;
  if (result.data.user.id !== verified.data.user.id) throw new Error('AUTH_REQUIRED');
}
