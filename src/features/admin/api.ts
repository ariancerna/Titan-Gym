import { requireSupabase } from '../../lib/supabase/client';
export interface NamedEntity { id: string; name: string }
export interface ManagedClass extends NamedEntity { discipline_id: string; description: string; image_url: string | null }
export interface ManagedSession {
  id: string; class_id: string; instructor_id: string; location_id: string; room: string;
  starts_at: string; capacity: number; duration_minutes: number; published: boolean;
  name: string; instructor: string; location: string; reserved: number;
}
export interface AdminSnapshot { disciplines: NamedEntity[]; locations: NamedEntity[]; instructors: NamedEntity[]; classes: ManagedClass[]; sessions: ManagedSession[] }
export type AttendanceStatus = 'pending' | 'present' | 'absent';
export interface RosterMember {
  id: string; code: string; member_name: string; member_email: string; status: string;
  attendance_status: AttendanceStatus; attendance_updated_at: string | null;
  history: { status: AttendanceStatus; previous_status: AttendanceStatus | null; recorded_by: string; created_at: string }[];
}
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().rpc(name, args);
  if (error) throw error;
  return data as T;
}
export const getAdminRole = () => rpc<boolean>('is_admin');
export const getAdminSnapshot = () => rpc<AdminSnapshot>('admin_snapshot');
export const getRoster = (id: string) => rpc<RosterMember[]>('admin_roster', { p_session_id: id });
export const saveClass = (data: Record<string, unknown>, id?: string) => rpc<string>('admin_save_class', { p_data: data, p_id: id ?? null });
export const saveSession = (data: Record<string, unknown>, id?: string) => rpc<string>('admin_save_session', { p_data: data, p_id: id ?? null });
export const setAttendance = (id: string, status: AttendanceStatus) => rpc<null>('admin_set_attendance', { p_reservation_id: id, p_status: status });
export const attendanceLabel: Record<AttendanceStatus, string> = { pending: 'Pendiente', present: 'Presente', absent: 'Ausente' };
