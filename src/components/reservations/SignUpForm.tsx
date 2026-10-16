import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { signUpSchema } from '../../schemas/auth';
import { signUpWithPassword } from '../../features/auth/password';
import { rememberReturnPath } from '../../lib/supabase/magic-link';
import { configured } from '../../lib/supabase/client';
import { errorMessage } from '../../lib/errors';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type Values = z.infer<typeof signUpSchema>;

export function SignUpForm({ onSignIn }: { onSignIn: () => void }) {
  const location = useLocation();
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const form = useForm<Values>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmation: '', privacy: false },
  });

  async function submit(values: Values) {
    setError('');
    try {
      // Tras confirmar el correo, el socio vuelve a la reserva que estaba haciendo.
      rememberReturnPath(location.pathname);
      const signedIn = await signUpWithPassword(values.email, values.password);
      if (!signedIn) setSentTo(values.email);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      form.resetField('password');
      form.resetField('confirmation');
    }
  }

  if (sentTo)
    return (
      <div className="auth-sent" role="status">
        <MailCheck aria-hidden="true" />
        <h3>Revisa tu correo</h3>
        <p>
          Si <strong>{sentTo}</strong> no estaba registrado, te enviamos un enlace para confirmar la
          cuenta. Ábrelo para terminar el registro.
        </p>
        <p>¿Ya tenías cuenta con ese correo? Inicia sesión o recupera tu contraseña.</p>
        <Button type="button" variant="secondary" onClick={onSignIn}>
          Volver a iniciar sesión
        </Button>
      </div>
    );

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate>
      <Input
        id="signup-email"
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />
      <Input
        id="signup-password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        error={form.formState.errors.password?.message}
        {...form.register('password')}
      />
      <Input
        id="signup-confirmation"
        label="Repite la contraseña"
        type="password"
        autoComplete="new-password"
        error={form.formState.errors.confirmation?.message}
        {...form.register('confirmation')}
      />
      <p className="field-hint">Mínimo 12 caracteres. Una frase corta es más fácil de recordar.</p>
      <div className="field">
        <label className="checkbox-label">
          <input
            type="checkbox"
            aria-invalid={Boolean(form.formState.errors.privacy)}
            aria-describedby={form.formState.errors.privacy ? 'signup-privacy-error' : undefined}
            {...form.register('privacy')}
          />
          <span>
            He leído y acepto la{' '}
            <Link to="/privacidad" target="_blank" rel="noopener" className="yellow">
              Política de privacidad
            </Link>
            .
          </span>
        </label>
        {form.formState.errors.privacy && (
          <p id="signup-privacy-error" className="field-error" role="alert">
            {form.formState.errors.privacy.message}
          </p>
        )}
      </div>
      <Button className="btn-block" disabled={!configured || form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
      </Button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
}
