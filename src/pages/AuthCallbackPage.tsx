import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requireSupabase } from '../lib/supabase/client';
import { consumeReturnPath, resetPasswordPath } from '../lib/supabase/magic-link';
import { LoadingState } from '../components/ui/States';

// Tipos de enlace que llegan desde las plantillas de correo (token_hash en nuestro dominio).
const emailLinkTypes = ['email', 'recovery'] as const;
type EmailLinkType = (typeof emailLinkTypes)[number];
const isEmailLinkType = (value: string | null): value is EmailLinkType =>
  emailLinkTypes.some((type) => type === value);

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
      if (params.has('error') || params.has('error_code')) throw new Error('INVALID_LINK');
      const client = requireSupabase();
      const code = params.get('code');
      const tokenHash = params.get('token_hash');
      const type = params.get('type');
      // Correos: el enlace apunta a esta página con token_hash y se valida aquí, sin pasar por
      // supabase.co. Google sigue devolviendo un código PKCE.
      const result =
        tokenHash && isEmailLinkType(type)
          ? await client.auth.verifyOtp({ token_hash: tokenHash, type })
          : code
            ? await client.auth.exchangeCodeForSession(code)
            : null;
      if (!result || result.error || !result.data.session) throw new Error('INVALID_LINK');
      const verified = await client.auth.getUser();
      if (
        verified.error ||
        !verified.data.user?.email_confirmed_at ||
        verified.data.user.is_anonymous
      ) {
        await client.auth.signOut();
        throw new Error('INVALID_LINK');
      }
      const path = consumeReturnPath();
      return type === 'recovery' ? resetPasswordPath : path;
    })();
    void pending.current
      .then((path) => {
        if (active) navigate(path, { replace: true });
      })
      .catch(() => {
        if (active)
          setError(
            'No pudimos verificar el acceso. Si usaste un enlace del correo, puede haber vencido o ya se usó: pide uno nuevo. Si entraste con Google, vuelve a intentarlo en el mismo navegador.',
          );
      });
    return () => {
      active = false;
    };
  }, [params, navigate]);
  if (!error) return <LoadingState />;
  return (
    <section className="container page panel auth-panel">
      <p className="eyebrow accent">Acceso seguro</p>
      <h1>Enlace no válido</h1>
      <p role="alert">{error}</p>
      <Link className="btn btn-primary" to="/mis-reservas">
        Solicitar otro enlace
      </Link>
    </section>
  );
}
