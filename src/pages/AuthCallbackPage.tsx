import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requireSupabase } from '../lib/supabase/client';
import { consumeReturnPath } from '../lib/supabase/magic-link';
import { LoadingState } from '../components/ui/States';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [error, setError] = useState('');
  const pending = useRef<Promise<string> | null>(null);
  useEffect(() => {
    let active = true;
    // Retira el código de la URL y del historial, incluso si el enlace falla.
    window.history.replaceState(window.history.state, '', '/auth/confirm');
    pending.current ??= (async () => {
      const code = params.get('code');
      if (!code || params.has('error') || params.has('error_code')) throw new Error('INVALID_LINK');
      const client = requireSupabase();
      const result = await client.auth.exchangeCodeForSession(code);
      if (result.error || !result.data.session) throw new Error('INVALID_LINK');
      const verified = await client.auth.getUser();
      if (
        verified.error ||
        !verified.data.user?.email_confirmed_at ||
        verified.data.user.is_anonymous
      ) {
        await client.auth.signOut();
        throw new Error('INVALID_LINK');
      }
      return consumeReturnPath();
    })();
    void pending.current
      .then((path) => {
        if (active) navigate(path, { replace: true });
      })
      .catch(() => {
        if (active)
          setError(
            'No pudimos verificar el acceso. Si cancelaste Google, inténtalo de nuevo. Si usaste un enlace, puede haber vencido: solicita uno nuevo y ábrelo en el mismo navegador y dispositivo donde lo pediste.',
          );
      });
    return () => {
      active = false;
    };
  }, [params, navigate]);
  if (!error) return <LoadingState />;
  return (
    <section className="container page panel auth-panel">
      <p className="eyebrow yellow">Acceso seguro</p>
      <h1>Enlace no válido</h1>
      <p role="alert">{error}</p>
      <Link className="btn btn-primary" to="/mis-reservas">
        Solicitar otro enlace
      </Link>
    </section>
  );
}
