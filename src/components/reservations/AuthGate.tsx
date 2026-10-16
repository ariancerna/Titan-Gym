import { useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { requireSupabase, configured } from '../../lib/supabase/client';
import { rememberReturnPath, magicLinkRedirect } from '../../lib/supabase/magic-link';
import { requestPasswordReset } from '../../features/auth/password';
import { PasswordSignInForm } from './PasswordSignInForm';
import { SignUpForm } from './SignUpForm';
import { EmailRequestForm } from './EmailRequestForm';
import { GoogleSignInButton } from './GoogleSignInButton';

type View = 'login' | 'signup' | 'link' | 'reset';

const copy: Record<View, { title: string; text: string }> = {
  login: {
    title: 'Accede a tu cuenta',
    text: 'Inicia sesión para reservar clases y consultar tus comprobantes.',
  },
  signup: {
    title: 'Crea tu cuenta',
    text: 'Regístrate con tu correo para reservar clases en TITAN GYM.',
  },
  link: {
    title: 'Entra con un enlace',
    text: 'Te enviamos un enlace de un solo uso a tu correo. No necesitas contraseña.',
  },
  reset: {
    title: 'Recupera tu contraseña',
    text: 'Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.',
  },
};

export function AuthGate() {
  const location = useLocation();
  const [view, setView] = useState<View>('login');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  function show(next: View) {
    setView(next);
  }

  async function sendMagicLink(email: string) {
    rememberReturnPath(location.pathname);
    const { error } = await requireSupabase().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: magicLinkRedirect() },
    });
    if (error) throw error;
  }

  // Patrón de pestañas accesible: las flechas mueven la selección entre las dos opciones.
  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const next = view === 'signup' ? 'login' : 'signup';
    show(next);
    document.getElementById(`auth-tab-${next}`)?.focus();
  }

  const withTabs = view === 'login' || view === 'signup';

  return (
    <section className="panel auth-panel" aria-labelledby="auth-title">
      {withTabs && (
        <div
          className="auth-tabs"
          role="tablist"
          aria-label="Acceso de socios"
          onKeyDown={onTabKey}
        >
          {(['login', 'signup'] as const).map((tab) => (
            <button
              key={tab}
              id={`auth-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={view === tab}
              aria-controls="auth-view"
              tabIndex={view === tab ? 0 : -1}
              onClick={() => show(tab)}
            >
              {tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          ))}
        </div>
      )}

      <div id="auth-view" role={withTabs ? 'tabpanel' : undefined}>
        <h2 id="auth-title">{copy[view].title}</h2>
        <p className="auth-intro">{copy[view].text}</p>
        {!configured && (
          <p className="notice" role="status">
            La agenda aún no está conectada a Supabase.
          </p>
        )}

        {view === 'login' && (
          <>
            <PasswordSignInForm
              blocked={googleLoading}
              onBusy={setPasswordBusy}
              onForgot={() => show('reset')}
            />
            <button type="button" className="link-button auth-alt" onClick={() => show('link')}>
              Prefiero recibir un enlace por correo
            </button>
          </>
        )}
        {view === 'signup' && <SignUpForm onSignIn={() => show('login')} />}
        {view === 'link' && (
          <EmailRequestForm
            id="access-email"
            submitLabel="Enviar enlace de acceso"
            pendingLabel="Enviando enlace…"
            onRequest={sendMagicLink}
            onBack={() => show('login')}
            sentMessage={(email) => (
              <p>
                Solicitud aceptada para <strong>{email}</strong>. Abre el enlace del correo para
                entrar; pedir el enlace no reserva ningún cupo.
              </p>
            )}
          />
        )}
        {view === 'reset' && (
          <EmailRequestForm
            id="reset-email"
            submitLabel="Enviar enlace de recuperación"
            pendingLabel="Enviando enlace…"
            onRequest={requestPasswordReset}
            onBack={() => show('login')}
            sentMessage={(email) => (
              <p>
                Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace para elegir
                una contraseña nueva.
              </p>
            )}
          />
        )}

        {withTabs && (
          <>
            <div className="auth-divider" aria-hidden="true">
              <span>o</span>
            </div>
            <GoogleSignInButton disabled={passwordBusy} onLoadingChange={setGoogleLoading} />
          </>
        )}
      </div>

      <p className="auth-staff">
        ¿Eres parte del personal? <Link to="/admin">Acceso de administradores</Link>
      </p>
    </section>
  );
}
