import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { passwordLoginSchema } from '../../schemas/auth';
import { signInWithPassword } from '../../features/auth/password';
import { errorMessage } from '../../lib/errors';
import { configured } from '../../lib/supabase/client';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function PasswordSignInForm({
  blocked,
  onBusy,
  onForgot,
}: {
  blocked: boolean;
  onBusy: (busy: boolean) => void;
  onForgot?: () => void;
}) {
  const [error, setError] = useState('');
  const lock = useRef(false);
  const form = useForm<z.infer<typeof passwordLoginSchema>>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: '', password: '' },
  });
  async function submit(values: z.infer<typeof passwordLoginSchema>) {
    if (lock.current) return;
    lock.current = true;
    setError('');
    onBusy(true);
    try {
      await signInWithPassword(values.email, values.password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      form.resetField('password');
      onBusy(false);
      lock.current = false;
    }
  }
  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate>
      <Input
        id="password-email"
        label="Correo electrónico"
        type="email"
        autoComplete="username"
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />
      <Input
        id="login-password"
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        error={form.formState.errors.password?.message}
        {...form.register('password')}
      />
      {onForgot && (
        <button type="button" className="link-button field-link" onClick={onForgot}>
          ¿Olvidaste tu contraseña?
        </button>
      )}
      <Button
        className="btn-block"
        disabled={!configured || blocked || form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? 'Verificando acceso…' : 'Iniciar sesión'}
      </Button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </form>
  );
}
