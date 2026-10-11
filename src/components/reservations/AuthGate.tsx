import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, ShieldCheck } from 'lucide-react';
import { requireSupabase, configured } from '../../lib/supabase/client';
import { rememberReturnPath, magicLinkRedirect } from '../../lib/supabase/magic-link';
import { getGoogleAvailability } from '../../lib/supabase/providers';
import { errorMessage } from '../../lib/errors';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PasswordSignInForm } from './PasswordSignInForm';
const schema = z.object({ email: z.string().trim().email('Ingresa un correo válido.').max(254) });
export function AuthGate() {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [mode, setMode] = useState<'link' | 'password'>('password');
  const google = useQuery({ queryKey: ['auth-providers'], queryFn: getGoogleAvailability, enabled: configured, staleTime: 60000, retry: 1 });
  const mailForm = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  async function send(values: z.infer<typeof schema>) {
    setError('');
    try {
      rememberReturnPath(location.pathname);
      const { error } = await requireSupabase().auth.signInWithOtp({ email: values.email, options: { shouldCreateUser: true, emailRedirectTo: magicLinkRedirect() } });
      if (error) throw error;
      setEmail(values.email); setSent(true);
    } catch (e) { setError(errorMessage(e)); }
  }
  async function signInGoogle() {
    if (googleLoading || !google.data) return;
    setError(''); setGoogleLoading(true);
    try {
      rememberReturnPath(location.pathname);
      const { error } = await requireSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: magicLinkRedirect(), scopes: 'openid email profile', queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
    } catch (e) { setError(errorMessage(e)); setGoogleLoading(false); }
  }
  return <section className="panel auth-panel">
    <ShieldCheck className="yellow"/><p className="eyebrow yellow">Acceso seguro del socio</p>
    <h2>Accede a tu cuenta</h2>
    <p>Inicia sesión con tu correo y contraseña. También puedes elegir otro método de acceso.</p>
    <div className="flex flex-wrap gap-2 mb-6" aria-label="Método de acceso por correo">
      <button type="button" className={`chip ${mode === 'password' ? 'selected' : ''}`} aria-pressed={mode === 'password'} disabled={googleLoading || passwordBusy || mailForm.formState.isSubmitting} onClick={() => { setMode('password'); setError(''); }}>Correo y contraseña</button>
      <button type="button" className={`chip ${mode === 'link' ? 'selected' : ''}`} aria-pressed={mode === 'link'} disabled={googleLoading || passwordBusy || mailForm.formState.isSubmitting} onClick={() => { setMode('link'); setError(''); }}>Enlace por correo</button>
    </div>
    {mode === 'link' && <p className="notice mb-6">El enlace por correo de esta demostración solo permite destinatarios autorizados del equipo de Supabase. No añadas socios al equipo para eludir esta limitación.</p>}
    {!configured && <p className="notice" role="status">La agenda aún no está conectada a Supabase.</p>}
    {mode === 'password' ? <PasswordSignInForm blocked={googleLoading} onBusy={setPasswordBusy}/> : sent ? <div>
      <p role="status">Solicitud aceptada para <strong>{email}</strong>. Revisa tu correo y la carpeta de no deseado.</p>
      <p>Abre el enlace en este mismo navegador y dispositivo. Al volver podrás continuar; solicitar acceso no reserva un cupo.</p>
      <Button type="button" variant="secondary" onClick={() => { setSent(false); setError(''); }}>Usar otro correo o solicitar un enlace nuevo</Button>
    </div> : <form onSubmit={mailForm.handleSubmit(send)} noValidate>
      <Input id="access-email" label="Correo electrónico" type="email" autoComplete="email" placeholder="tu.correo@ejemplo.com" error={mailForm.formState.errors.email?.message} {...mailForm.register('email')}/>
      <Button disabled={!configured || googleLoading || mailForm.formState.isSubmitting}><Mail size={18}/>{mailForm.formState.isSubmitting ? 'Solicitando enlace…' : 'Enviar enlace de acceso'}</Button>
    </form>}
    {error && <p role="alert" className="field-error">{error}</p>}
    <div className="auth-divider" aria-hidden="true"><span>o</span></div>
    <button type="button" className="google-signin" disabled={!configured || !google.data || googleLoading || passwordBusy || mailForm.formState.isSubmitting} onClick={() => void signInGoogle()}>
      <img src="/assets/brands/google-g.png" width="20" height="20" alt="" aria-hidden="true"/>
      <span>{googleLoading ? 'Abriendo Google…' : 'Continuar con Google'}</span>
    </button>
    {configured && google.isLoading && <p role="status">Comprobando acceso con Google…</p>}
    {configured && google.data === false && <p className="notice">El acceso con Google está pendiente de configuración por el administrador.</p>}
    {google.isError && <div><p className="notice">No pudimos comprobar si Google está disponible.</p><Button type="button" variant="secondary" onClick={() => void google.refetch()}>Comprobar Google otra vez</Button></div>}
    {mode === 'password' && <details className="auth-help"><summary>¿Aún no tienes contraseña o la olvidaste?</summary><p>Entra con Google o con el enlace y configura tu contraseña en Mis reservas. Si ya la tenías, el formulario la reemplaza.</p><p>La recuperación por correo requiere un servicio de envío habilitado para tu dirección. Google debe estar vinculado a esa misma cuenta.</p></details>}
  </section>;
}
