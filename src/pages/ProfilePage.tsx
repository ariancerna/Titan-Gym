import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '../app/AuthProvider';
import { hasPassword } from '../features/auth/password';
import { savedName, saveName, signInMethods } from '../features/auth/profile';
import { usePrivacyConsent } from '../features/privacy/queries';
import { profileSchema } from '../schemas/reservation';
import { formatDate } from '../utils/sessions';
import { errorMessage } from '../lib/errors';
import { AuthGate } from '../components/reservations/AuthGate';
import { CreatePasswordForm } from '../components/reservations/CreatePasswordForm';
import { ReminderPreference } from '../components/reservations/ReminderPreference';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingState } from '../components/ui/States';

function AccountDetails({ user }: { user: User }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: savedName(user) },
  });
  const methods = signInMethods(user, hasPassword(user));
  async function submit(values: z.infer<typeof profileSchema>) {
    setSaved(false);
    setError('');
    try {
      await saveName(values.name);
      form.reset(values);
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <section className="panel" aria-labelledby="profile-title">
      <p className="eyebrow accent">Datos de la cuenta</p>
      <h2 id="profile-title">Tus datos</h2>
      <dl className="profile-facts">
        <div>
          <dt>Correo verificado</dt>
          <dd>{user.email}</dd>
        </div>
        {methods.length > 0 && (
          <div>
            <dt>Formas de entrar</dt>
            <dd>{methods.join(' · ')}</dd>
          </div>
        )}
      </dl>
      <form className="max-w-xl" onSubmit={form.handleSubmit(submit)} noValidate>
        <Input
          id="profile-name"
          label="Nombre completo"
          autoComplete="name"
          placeholder="Ej. Alejandro Morales"
          maxLength={100}
          error={form.formState.errors.name?.message}
          {...form.register('name', { onChange: () => setSaved(false) })}
        />
        <p className="profile-hint">
          Lo usamos para completar tus próximas reservas. No cambia las reservas que ya hiciste.
        </p>
        <Button disabled={form.formState.isSubmitting || !form.formState.isDirty}>
          {form.formState.isSubmitting ? 'Guardando…' : 'Guardar nombre'}
        </Button>
        {saved && (
          <p role="status" className="profile-status">
            Nombre guardado. Aparecerá en tu próxima reserva.
          </p>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

function PrivacySummary() {
  const consent = usePrivacyConsent();
  if (!consent.isSuccess) return null;
  return (
    <p className="privacy-summary">
      {consent.data
        ? `Aceptaste la política de privacidad el ${formatDate(consent.data.accepted_at)}. `
        : 'Te pediremos aceptar la política de privacidad en tu próxima reserva. '}
      <Link to="/privacidad">Ver política y cómo ejercer tus derechos</Link>
    </p>
  );
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  return (
    <div className="container page">
      <div className="page-heading">
        <p className="eyebrow accent">FitSmart Agenda</p>
        <h1>Mi perfil</h1>
        <p>Tus datos, cómo entras a tu cuenta y tus preferencias.</p>
      </div>
      {loading ? (
        <LoadingState />
      ) : user ? (
        <>
          <AccountDetails key={user.id} user={user} />
          <CreatePasswordForm key={`password-${user.id}`} />
          <ReminderPreference />
          <PrivacySummary />
        </>
      ) : (
        <div className="narrow">
          <AuthGate />
        </div>
      )}
    </div>
  );
}
