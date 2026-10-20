export interface ClassSession {
  id: string;
  class_id: string;
  name: string;
  description: string;
  discipline: string;
  image_url: string | null;
  featured_image_url?: string | null;
  instructor: string;
  instructor_bio: string;
  instructor_image: string | null;
  location: string;
  address: string;
  room: string;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  reserved: number;
  available: number;
  /** Cancelada por el gimnasio: no admite reservas; el comprobante muestra el motivo. */
  cancelled: boolean;
  cancel_reason: string | null;
}
export interface Reservation {
  id: string;
  code: string;
  session_id: string;
  member_name: string;
  member_email: string;
  status: 'confirmed' | 'cancelled' | 'attended';
  /** La canceló el gimnasio al cancelar la sesión (no el socio). */
  cancelled_by_gym?: boolean;
  created_at: string;
}
export interface WaitlistEntry {
  id: string;
  session_id: string;
  name: string;
  instructor: string;
  room: string;
  starts_at: string;
  duration_minutes: number;
  queue_position: number;
  created_at: string;
}
export interface ReservationWithSession extends Reservation {
  session: Pick<
    ClassSession,
    'starts_at' | 'duration_minutes' | 'room' | 'name' | 'instructor' | 'cancel_reason'
  > | null;
}
