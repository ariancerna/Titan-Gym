import { requireSupabase } from '../../lib/supabase/client';

/** Sin preferencia guardada, el socio recibe recordatorios (forman parte del servicio). */
export async function getEmailReminders(): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from('member_preferences')
    .select('email_reminders')
    .maybeSingle();
  if (error) throw error;
  return (data as { email_reminders: boolean } | null)?.email_reminders ?? true;
}

export async function setEmailReminders(enabled: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc('set_email_reminders', { p_enabled: enabled });
  if (error) throw error;
}
