import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { createPasswordSchema } from '../../schemas/auth';
import { createAccountPassword } from '../../features/auth/password';
import { errorMessage } from '../../lib/errors';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function CreatePasswordForm() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const lock = useRef(false);
  const form = useForm<z.infer<typeof createPasswordSchema>>({
    resolver: zodResolver(createPasswordSchema),
    defaultValues: { password: '', confirmation: '' },
  });
  if (!user?.email_confirmed_at || user.is_anonymous) return null;
  async function submit(values: z.infer<typeof createPasswordSchema>) {
    if (lock.current) return;
    lock.current = true;
    setError('');
    setSuccess(false);
    try {
      await createAccountPassword(values.password);
      form.reset();
      setSuccess(true);
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e));
      form.reset();
    } finally {
      lock.current = false;
    }
  }
  return (
    <section className="panel auth-panel mt-8" aria-label="Seguridad de tu cuenta">
      <p className="eyebrow yellow">Seguridad de tu cuenta</p>
      <h2>Correo y contraseña</h2>
      <p>
        Configura una contraseña para esta cuenta verificada. Se mantienen tus accesos y reservas;
        no se unen cuentas con correos diferentes.
      </p>
      {success && (
        <p role="status">
          Contraseña guardada. Puedes iniciar sesión con el correo de esta cuenta y tu nueva
          contraseña.
        </p>
      )}
      {!open ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setError('');
            setSuccess(false);
            setOpen(true);
          }}
        >
          <KeyRound size={18} />
          Crear contraseña
        </Button>
      ) : (
        <form className="max-w-xl" onSubmit={form.handleSubmit(submit)} noValidate>
          <Input
            id="account-password"
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <p>
            Usa una contraseña única o una frase larga de 12 a 128 caracteres. Si ya tenías una,
            este formulario la sustituirá.
          </p>
          <Input
            id="account-password-confirm"
            label="Repetir contraseña"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.confirmation?.message}
            {...form.register('confirmation')}
          />
          <Button disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Guardando contraseña…' : 'Guardar contraseña'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={form.formState.isSubmitting}
            onClick={() => {
              form.reset();
              setError('');
              setOpen(false);
            }}
          >
            Cancelar
          </Button>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
