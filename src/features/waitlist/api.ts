import { requireSupabase } from '../../lib/supabase/client';
import type { ReservationValues } from '../../schemas/reservation';
import type { WaitlistEntry } from '../../types/domain';

/** PostgREST responde PGRST202 si la función no existe: la migración aún no se aplicó. */
const missingFunction = (error: { code?: string } | null) => error?.code === 'PGRST202';

export async function joinWaitlist(sessionId: string, values: ReservationValues): Promise<string> {
  const { data, error } = await requireSupabase().rpc('join_waitlist', {
    p_session_id: sessionId,
    p_member_name: values.name,
    p_email: values.email,
  });
  if (error) throw error;
  return data as string;
}

export async function leaveWaitlist(entryId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('leave_waitlist', { p_entry_id: entryId });
  if (error) throw error;
}

/** Entradas activas del socio con su posición. Sin la migración, la lista no existe: vacía. */
export async function getMyWaitlist(): Promise<WaitlistEntry[]> {
  const { data, error } = await requireSupabase().rpc('my_waitlist');
  if (missingFunction(error)) return [];
  if (error) throw error;
  return data as WaitlistEntry[];
}
