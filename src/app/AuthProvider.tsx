import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
const Context = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const cache = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) { setUser(data.user); setLoading(false); } }).catch(() => { if (active) setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { setUser(session?.user ?? null); setLoading(false); cache.removeQueries({ queryKey: ['reservations'] }); cache.removeQueries({ queryKey: ['admin'] }); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [cache]);
  return <Context.Provider value={{ user, loading }}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);
