import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { emailOnlySchema } from '../../schemas/auth';
import { configured } from '../../lib/supabase/client';
import { errorMessage } from '../../lib/errors';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type Values = z.infer<typeof emailOnlySchema>;

/** Formulario de un solo correo: lo usan el enlace de acceso y la recuperación de contraseña. */
export function EmailRequestForm({
  id,
  submitLabel,
  pendingLabel,
  onRequest,
  sentMessage,
  onBack,
}: {
  id: string;
  submitLabel: string;
  pendingLabel: string;
  onRequest: (email: string) => Promise<void>;
  sentMessage: (email: string) => ReactNode;
  onBack: () => void;
}) {
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const form = useForm<Values>({ resolver: zodResolver(emailOnlySchema) });

  async function submit(values: Values) {
    setError('');
    try {
      await onRequest(values.email);
      setSentTo(values.email);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (sentTo)
    return (
      <div className="auth-sent" role="status">
        <MailCheck aria-hidden="true" />
        <h3>Revisa tu correo</h3>
        {sentMessage(sentTo)}
        <p>Si no aparece en unos minutos, revisa la carpeta de spam.</p>
        <div className="auth-sent-actions">
          <Button type="button" variant="secondary" onClick={() => setSentTo('')}>
            Usar otro correo
          </Button>
          <button type="button" className="link-button" onClick={onBack}>
            Volver a iniciar sesión
          </button>
        </div>
      </div>
    );

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate>
      <Input
        id={id}
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        placeholder="tu.correo@ejemplo.com"
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />
      <Button className="btn-block" disabled={!configured || form.formState.isSubmitting}>
        {form.formState.isSubmitting ? pendingLabel : submitLabel}
      </Button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <button type="button" className="link-button auth-back" onClick={onBack}>
        Volver a iniciar sesión
      </button>
    </form>
  );
}
