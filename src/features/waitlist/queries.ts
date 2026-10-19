import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/AuthProvider';
import { getMyWaitlist } from './api';

// La clave empieza por 'reservations' para descartarse al cambiar de cuenta.
export const waitlistKey = (userId?: string) => ['reservations', 'waitlist', userId];
export function useMyWaitlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: waitlistKey(user?.id),
    queryFn: getMyWaitlist,
    enabled: Boolean(user),
  });
}
