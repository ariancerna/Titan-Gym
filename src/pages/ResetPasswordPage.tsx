import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { CircleCheck } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { createPasswordSchema } from '../schemas/auth';
import { createAccountPassword } from '../features/auth/password';
import { errorMessage } from '../lib/errors';
import { Button, ButtonLink } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState, LoadingState } from '../components/ui/States';

type Values = z.infer<typeof createPasswordSchema>;

/** Destino del enlace de recuperación: la sesión ya fue validada en /auth/confirm. */
export default function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(createPasswordSchema),
    defaultValues: { password: '', confirmation: '' },
  });

  async function submit(values: Values) {
    setError('');
    try {
      await createAccountPassword(values.password);
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
      form.reset();
    }
  }

  if (loading) return <LoadingState />;
  if (!user)
    return (
      <div className="container page narrow">
        <EmptyState
          title="Enlace no válido o vencido"
          message="Pide un enlace nuevo desde «¿Olvidaste tu contraseña?». Cada enlace funciona una sola vez y vence en 1 hora."
        />
        <div className="center">
          <ButtonLink to="/mis-reservas">Volver al acceso</ButtonLink>
        </div>
      </div>
    );

  return (
    <div className="container page narrow">
      <section className="panel auth-panel" aria-labelledby="reset-title">
        {done ? (
          <div className="auth-sent" role="status">
            <CircleCheck aria-hidden="true" />
            <h2 id="reset-title">Contraseña actualizada</h2>
            <p>
              Desde ahora inicia sesión con <strong>{user.email}</strong> y tu nueva contraseña.
            </p>
            <ButtonLink to="/mis-reservas">Ir a mis reservas</ButtonLink>
          </div>
        ) : (
          <>
            <h2 id="reset-title">Elige una contraseña nueva</h2>
            <p className="auth-intro">
              Para la cuenta <strong>{user.email}</strong>. Usa al menos 12 caracteres.
            </p>
            <form onSubmit={form.handleSubmit(submit)} noValidate>
              <Input
                id="reset-password"
                label="Nueva contraseña"
                type="password"
                autoComplete="new-password"
                error={form.formState.errors.password?.message}
                {...form.register('password')}
              />
              <Input
                id="reset-confirmation"
                label="Repite la contraseña"
                type="password"
                autoComplete="new-password"
                error={form.formState.errors.confirmation?.message}
                {...form.register('confirmation')}
              />
              <Button className="btn-block" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
              </Button>
              {error && (
                <p role="alert" className="field-error">
                  {error}
                </p>
              )}
            </form>
          </>
        )}
      </section>
    </div>
  );
}
