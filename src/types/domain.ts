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
}
export interface Reservation {
  id: string;
  code: string;
  session_id: string;
  member_name: string;
  member_email: string;
  status: 'confirmed' | 'cancelled' | 'attended';
  created_at: string;
}
