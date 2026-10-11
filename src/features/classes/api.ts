import { requireSupabase } from '../../lib/supabase/client';
import type { ClassSession } from '../../types/domain';
export interface GymLocation { id: string; name: string; address: string }
export async function getGymLocations(): Promise<GymLocation[]> {
  const { data, error } = await requireSupabase().from('locations').select('id,name,address').order('name');
  if (error) throw error;
  return data as GymLocation[];
}
export async function getSessions(): Promise<ClassSession[]> {
  const { data, error } = await requireSupabase().rpc('list_sessions');
  if (error) throw error;
  return data as ClassSession[];
}
export async function getSession(id: string): Promise<ClassSession | null> {
  const { data, error } = await requireSupabase().rpc('list_sessions', { p_session_id: id });
  if (error) throw error;
  return (data as ClassSession[])[0] ?? null;
}
