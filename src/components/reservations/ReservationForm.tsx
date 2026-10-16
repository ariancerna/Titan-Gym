import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { reservationSchema, type ReservationValues } from '../../schemas/reservation';
import { createReservation } from '../../features/reservations/api';
import { acceptPrivacyPolicy } from '../../features/privacy/api';
import { usePrivacyConsent } from '../../features/privacy/queries';
import { errorMessage } from '../../lib/errors';
import { Input } from '../ui/Input';
import { Button, ButtonLink } from '../ui/Button';
export function ReservationForm({
  sessionId,
  available,
}: {
  sessionId: string;
  available: number;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const locked = useRef(false);
  const consent = usePrivacyConsent();
  // Socios que entraron con Google o con enlace todavía no aceptaron la política.
  const needsConsent = consent.isSuccess && !consent.data;
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyError, setPrivacyError] = useState('');
  const form = useForm<ReservationValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: { name: '', email: user?.email ?? '' },
  });
  const mutation = useMutation({
    mutationFn: async (values: ReservationValues) => {
      if (needsConsent) await acceptPrivacyPolicy();
      return createReservation(sessionId, values);
    },
    onSuccess: async (id) => {
      await cache.invalidateQueries({ queryKey: ['sessions'] });
      await cache.invalidateQueries({ queryKey: ['reservations'] });
      navigate(`/reserva-confirmada/${id}`, { replace: true });
    },
    onError: () => {
      void cache.invalidateQueries({ queryKey: ['sessions'] });
      void consent.refetch();
    },
  });
  async function submit(values: ReservationValues) {
    if (locked.current) return;
    if (needsConsent && !privacyAccepted) {
      setPrivacyError('Acepta la política de privacidad para registrar la reserva.');
      return;
    }
    locked.current = true;
    try {
      await mutation.mutateAsync(values);
    } catch {
      /* El estado de mutation presenta el error. */
    } finally {
      locked.current = false;
    }
  }
  return (
    <section className="panel form-panel">
      <p className="eyebrow yellow">Datos del socio</p>
      <h2>Confirma tus datos</h2>
      <p>Con estos datos te reconocerán en recepción y recibirás tu código de reserva.</p>
      <form onSubmit={form.handleSubmit(submit)} noValidate>
        <Input
          id="member-name"
          label="Nombre completo del socio"
          autoComplete="name"
          placeholder="Ej. Alejandro Morales"
          maxLength={100}
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />
        <Input
          id="member-email"
          label="Correo electrónico verificado"
          type="email"
          readOnly
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              aria-invalid={Boolean(form.formState.errors.accepted)}
              aria-describedby="accepted-error"
              {...form.register('accepted')}
            />
            Confirmo mi asistencia y acepto llegar con puntualidad.
          </label>
          {form.formState.errors.accepted && (
            <p id="accepted-error" className="field-error" role="alert">
              {form.formState.errors.accepted.message}
            </p>
          )}
        </div>
        {needsConsent && (
          <div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={privacyAccepted}
                aria-invalid={Boolean(privacyError)}
                aria-describedby={privacyError ? 'privacy-error' : undefined}
                onChange={(e) => {
                  setPrivacyAccepted(e.target.checked);
                  setPrivacyError('');
                }}
              />
              <span>
                He leído y acepto la{' '}
                <Link to="/privacidad" target="_blank" rel="noopener" className="yellow">
                  Política de privacidad
                </Link>{' '}
                para el registro de mis reservas y asistencia.
              </span>
            </label>
            {privacyError && (
              <p id="privacy-error" className="field-error" role="alert">
                {privacyError}
              </p>
            )}
          </div>
        )}
        {mutation.isError && (
          <div role="alert" className="notice error">
            {errorMessage(mutation.error)}
            <p>
              <ButtonLink to="/clases" variant="secondary">
                Regresar al catálogo
              </ButtonLink>
            </p>
          </div>
        )}
        {available <= 0 && (
          <p role="alert" className="notice">
            Clase completa. No hay cupos disponibles para esta sesión.
          </p>
        )}
        <Button
          disabled={
            mutation.isPending || form.formState.isSubmitting || available <= 0 || consent.isLoading
          }
        >
          {mutation.isPending ? 'Registrando reserva…' : 'Confirmar reserva'}
          <ArrowRight size={18} />
        </Button>
        <ButtonLink to={`/clases/${sessionId}`} variant="secondary">
          Volver sin reservar
        </ButtonLink>
        <p className="meta">
          <ShieldCheck />
          Identidad verificada · Reserva protegida
        </p>
      </form>
    </section>
  );
}
