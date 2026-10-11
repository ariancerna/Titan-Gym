import { useQuery } from '@tanstack/react-query';
import { getSessions, getSession, getGymLocations } from './api';
export const useGymLocations = () => useQuery({ queryKey: ['locations'], queryFn: getGymLocations, staleTime: 60000 });
export const useSessions = () => useQuery({ queryKey: ['sessions'], queryFn: getSessions, refetchInterval: 15000 });
export const useClassSession = (id: string) => useQuery({ queryKey: ['sessions', id], queryFn: () => getSession(id), enabled: /^[0-9a-f-]{36}$/i.test(id), refetchInterval: 15000 });
