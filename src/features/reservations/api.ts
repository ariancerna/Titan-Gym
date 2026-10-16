import { requireSupabase } from '../../lib/supabase/client';
import type { Reservation } from '../../types/domain';
import type { ReservationValues } from '../../schemas/reservation';
export async function createReservation(id: string, values: ReservationValues): Promise<string> {
  const { data, error } = await requireSupabase().rpc('reserve_session', {
    p_session_id: id,
    p_member_name: values.name,
    p_email: values.email,
  });
  if (error) throw error;
  if (!data || typeof data !== 'string') throw new Error('No se recibió una reserva guardada.');
  return data;
}
export async function cancelReservation(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('cancel_reservation', { p_reservation_id: id });
  if (error) throw error;
}
export async function getReservations(): Promise<Reservation[]> {
  const { data, error } = await requireSupabase()
    .from('reservations')
    .select('id,code,session_id,member_name,member_email,status,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Reservation[];
}
export async function getReservation(id: string): Promise<Reservation | null> {
  const { data, error } = await requireSupabase()
    .from('reservations')
    .select('id,code,session_id,member_name,member_email,status,created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Reservation | null;
}
