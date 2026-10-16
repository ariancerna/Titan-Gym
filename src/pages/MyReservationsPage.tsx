import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, UserRound } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { cancelReservation, getReservations } from '../features/reservations/api';
import { usePrivacyConsent } from '../features/privacy/queries';
import { useClassSession } from '../features/classes/queries';
import { dayLabel, formatDate, timeRange } from '../utils/sessions';
import { errorMessage } from '../lib/errors';
import type { Reservation } from '../types/domain';
import { AuthGate } from '../components/reservations/AuthGate';
import { CreatePasswordForm } from '../components/reservations/CreatePasswordForm';
import { ReminderPreference } from '../components/reservations/ReminderPreference';
import { Button } from '../components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';

const statusLabel: Record<Reservation['status'], string> = {
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  attended: 'Asistencia registrada',
};

function ReservationCard({
  reservation: r,
  history,
  onCancelled,
}: {
  reservation: Reservation;
  history: boolean;
  onCancelled: (className: string) => void;
}) {
  const cache = useQueryClient();
  const query = useClassSession(r.session_id);
  const [confirming, setConfirming] = useState(false);
  const cancel = useMutation({
    mutationFn: () => cancelReservation(r.id),
    onSuccess: async () => {
      onCancelled(query.data?.name ?? 'la clase');
      await cache.invalidateQueries({ queryKey: ['reservations'] });
      await cache.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const s = query.data;
  if (!s)
    return (
      <article className="panel">
        <p>Sesión no disponible · {r.code}</p>
      </article>
    );
  const upcoming = new Date(s.starts_at).getTime() > Date.now();
  const past = !upcoming || r.status !== 'confirmed';
  if (history !== past) return null;

  return (
    <article className="reservation-card panel">
      <div className="reservation-date">
        <span className="eyebrow accent">{dayLabel(s.starts_at)}</span>
        <strong>{formatDate(s.starts_at)}</strong>
        <span>{timeRange(s)}</span>
      </div>
      <div className="reservation-info">
        <span className={`badge ${r.status === 'cancelled' ? 'full' : 'available'}`}>
          {statusLabel[r.status]}
        </span>
        <h2>{s.name}</h2>
        <p className="meta">
          <UserRound size={15} />
          {s.instructor}
          <MapPin size={15} />
          {s.room}
        </p>
        <p className="reservation-code">{r.code}</p>
      </div>
      <div className="reservation-actions">
        <Link className="btn btn-primary" to={`/reserva-confirmada/${r.id}`}>
          Ver comprobante
        </Link>
        {upcoming && r.status === 'confirmed' && !confirming && (
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            Cancelar reserva
          </Button>
        )}
      </div>
      {confirming && (
        <div className="cancel-confirm" role="group" aria-label={`Cancelar reserva de ${s.name}`}>
          <p>¿Cancelar esta reserva? Tu cupo quedará libre para otro socio.</p>
          {cancel.isError && (
            <p role="alert" className="field-error">
              {errorMessage(cancel.error)}
            </p>
          )}
          <div className="cancel-confirm-actions">
            <Button variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {cancel.isPending ? 'Cancelando…' : 'Sí, cancelar'}
            </Button>
            <Button
              variant="secondary"
              disabled={cancel.isPending}
              onClick={() => {
                cancel.reset();
                setConfirming(false);
              }}
            >
              Mantener reserva
            </Button>
          </div>
        </div>
      )}
    </article>
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

function ReservationList() {
  const { user } = useAuth();
  const [history, setHistory] = useState(false);
  const [cancelled, setCancelled] = useState('');
  const query = useQuery({ queryKey: ['reservations', user?.id], queryFn: getReservations });
  return (
    <>
      <div className="reservation-tabs">
        <button
          className={!history ? 'chip selected' : 'chip'}
          aria-pressed={!history}
          onClick={() => setHistory(false)}
        >
          <CalendarDays size={16} />
          Próximas sesiones
        </button>
        <button
          className={history ? 'chip selected' : 'chip'}
          aria-pressed={history}
          onClick={() => setHistory(true)}
        >
          Historial y canceladas
        </button>
      </div>
      {cancelled && (
        <p role="status" className="notice success">
          Reserva de {cancelled} cancelada. El cupo ya está disponible para otros socios.
        </p>
      )}
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        <div className="reservation-list">
          {query.data.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              history={history}
              onCancelled={setCancelled}
            />
          ))}
          <div className="list-empty">
            <EmptyState
              title={history ? 'Aún no hay historial' : 'Sin próximas reservas'}
              message="Explora el catálogo y encuentra tu siguiente entrenamiento."
              action
            />
          </div>
        </div>
      ) : (
        <EmptyState
          title="Todavía no tienes reservas"
          message="Tu próximo entrenamiento comienza con una reserva."
          action
        />
      )}
      <p className="notice">
        ¿No podrás asistir? Cancela antes de la hora de inicio para liberar tu cupo. La asistencia
        la registra el personal del gimnasio en cada clase.
      </p>
    </>
  );
}

export default function MyReservationsPage() {
  const { user, loading } = useAuth();
  return (
    <div className="container page">
      <div className="page-heading">
        <p className="eyebrow accent">FitSmart Agenda</p>
        <h1>Mis reservas</h1>
        <p>Tus próximas clases, el historial y los comprobantes de cada reserva.</p>
      </div>
      {loading ? (
        <LoadingState />
      ) : user ? (
        <>
          <ReservationList />
          <ReminderPreference />
          <CreatePasswordForm key={user.id} />
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
