import { requireSupabase } from '../../lib/supabase/client';
import type { Reservation, ReservationWithSession } from '../../types/domain';
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
type SessionRow = {
  starts_at: string;
  duration_minutes: number;
  room: string;
  cancel_reason: string | null;
  class: { name: string } | null;
  instructor: { name: string } | null;
};
/**
 * Reservas del socio con los datos de su sesión en una sola consulta (antes, una por reserva).
 * RLS limita las filas a las del socio y las sesiones a las publicadas, como list_sessions.
 */
export async function getReservations(): Promise<ReservationWithSession[]> {
  const { data, error } = await requireSupabase()
    .from('reservations')
    .select(
      'id,code,session_id,member_name,member_email,status,cancelled_by_gym,created_at,' +
        'session:class_sessions(starts_at,duration_minutes,room,cancel_reason,class:classes(name),instructor:instructors(name))',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as (Reservation & { session: SessionRow | null })[]).map(
    ({ session, ...r }) => ({
      ...r,
      session: session && {
        starts_at: session.starts_at,
        duration_minutes: session.duration_minutes,
        room: session.room,
        cancel_reason: session.cancel_reason,
        name: session.class?.name ?? '',
        instructor: session.instructor?.name ?? '',
      },
    }),
  );
}
export async function getReservation(id: string): Promise<Reservation | null> {
  const { data, error } = await requireSupabase()
    .from('reservations')
    .select('id,code,session_id,member_name,member_email,status,cancelled_by_gym,created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Reservation | null;
}
