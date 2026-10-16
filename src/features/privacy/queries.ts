import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/AuthProvider';
import { getPrivacyConsent } from './api';

// La clave empieza por 'reservations' para que se descarte al cambiar de cuenta (AuthProvider).
export function usePrivacyConsent() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reservations', 'privacy', user?.id],
    queryFn: getPrivacyConsent,
    enabled: Boolean(user),
  });
}
