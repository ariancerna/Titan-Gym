import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { reservationSchema, type ReservationValues } from '../../schemas/reservation';
import { createReservation } from '../../features/reservations/api';
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
  const form = useForm<ReservationValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: { name: '', email: user?.email ?? '' },
  });
  const mutation = useMutation({
    mutationFn: (values: ReservationValues) => createReservation(sessionId, values),
    onSuccess: async (id) => {
      await cache.invalidateQueries({ queryKey: ['sessions'] });
      await cache.invalidateQueries({ queryKey: ['reservations'] });
      navigate(`/reserva-confirmada/${id}`, { replace: true });
    },
    onError: () => {
      void cache.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
  async function submit(values: ReservationValues) {
    if (locked.current) return;
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
      <p className="eyebrow yellow">Validación directa de socio</p>
      <h2>Formulario de registro del socio</h2>
      <p>Completa tus datos para registrar tu reserva y obtener tu comprobante.</p>
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
        <Button disabled={mutation.isPending || form.formState.isSubmitting || available <= 0}>
          {mutation.isPending ? 'Registrando reserva…' : 'Confirmar reserva'}
          <ArrowRight size={18} />
        </Button>
        <ButtonLink to={`/clases/${sessionId}`} variant="secondary">
          Cancelar y volver atrás
        </ButtonLink>
        <p className="meta">
          <ShieldCheck />
          Identidad verificada · Reserva protegida
        </p>
      </form>
    </section>
  );
}
