import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { requireSupabase, configured } from '../../lib/supabase/client';
import { rememberReturnPath, magicLinkRedirect } from '../../lib/supabase/magic-link';
import { getGoogleAvailability } from '../../lib/supabase/providers';
import { errorMessage } from '../../lib/errors';
import { Button } from '../ui/Button';

/**
 * Inicio de sesión con Google. Lo usan el acceso de socios y el de administradores:
 * el proveedor solo identifica a la persona; el rol lo decide la base de datos.
 */
export function GoogleSignInButton({
  disabled = false,
  onLoadingChange,
}: {
  disabled?: boolean;
  onLoadingChange?: (loading: boolean) => void;
}) {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const google = useQuery({
    queryKey: ['auth-providers'],
    queryFn: getGoogleAvailability,
    enabled: configured,
    staleTime: 60000,
    retry: 1,
  });

  function setBusy(value: boolean) {
    setLoading(value);
    onLoadingChange?.(value);
  }

  async function signIn() {
    if (loading || !google.data) return;
    setError('');
    setBusy(true);
    try {
      // Al volver de Google se regresa a esta misma página (reserva, Mis reservas o /admin).
      rememberReturnPath(location.pathname);
      const { error } = await requireSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: magicLinkRedirect(),
          scopes: 'openid email profile',
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="google-signin"
        disabled={!configured || !google.data || loading || disabled}
        onClick={() => void signIn()}
      >
        <img src="/assets/brands/google-g.png" width="20" height="20" alt="" aria-hidden="true" />
        <span>{loading ? 'Abriendo Google…' : 'Continuar con Google'}</span>
      </button>
      {configured && google.isLoading && <p role="status">Comprobando acceso con Google…</p>}
      {configured && google.data === false && (
        <p className="notice">
          El acceso con Google está pendiente de configuración por el administrador.
        </p>
      )}
      {google.isError && (
        <div>
          <p className="notice">No pudimos comprobar si Google está disponible.</p>
          <Button type="button" variant="secondary" onClick={() => void google.refetch()}>
            Comprobar Google otra vez
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </>
  );
}
