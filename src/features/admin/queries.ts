import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/AuthProvider';
import { getAdminRole } from './api';
export function useAdminRole() {
  const { user, loading } = useAuth();
  return useQuery({ queryKey: ['admin', 'role', user?.id], queryFn: getAdminRole, enabled: !loading && Boolean(user), staleTime: 0, retry: 1 });
}
