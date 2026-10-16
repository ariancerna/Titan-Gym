import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
const Context = createContext<{ user: User | null; loading: boolean }>({
  user: null,
  loading: true,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const cache = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let currentId: string | null = null;
    function apply(next: User | null) {
      if (!active) return;
      // Los datos privados solo se descartan si cambia la cuenta, no en cada renovación del token.
      if ((next?.id ?? null) !== currentId) {
        cache.removeQueries({ queryKey: ['reservations'] });
        cache.removeQueries({ queryKey: ['admin'] });
      }
      currentId = next?.id ?? null;
      setUser(next);
      setLoading(false);
    }
    supabase.auth
      .getUser()
      .then(({ data }) => apply(data.user))
      .catch(() => {
        if (active) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      apply(session?.user ?? null),
    );
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [cache]);
  return <Context.Provider value={{ user, loading }}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);
