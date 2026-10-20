import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Hourglass } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { useClassSession } from '../features/classes/queries';
import { ReservationSummary } from '../components/reservations/ReservationSummary';
import { ReservationForm } from '../components/reservations/ReservationForm';
import { AuthGate } from '../components/reservations/AuthGate';
import { ButtonLink } from '../components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { useMyWaitlist } from '../features/waitlist/queries';
import {
  bookingOpensAt,
  bookingState,
  formatDate,
  isBookable,
  waitlistOpen,
} from '../utils/sessions';

/** Clase llena: si ya está en la fila muestra su posición; si no, el formulario de espera. */
function WaitlistStep({ sessionId }: { sessionId: string }) {
  const waitlist = useMyWaitlist();
  if (waitlist.isPending) return <LoadingState />;
  const entry = waitlist.data?.find((w) => w.session_id === sessionId);
  if (!entry) return <ReservationForm sessionId={sessionId} available={0} waitlist />;
  return (
    <section className="panel form-panel waitlist-joined" role="status">
      <Hourglass aria-hidden="true" />
      <h2>Ya estás en la lista de espera</h2>
      <p>
        Tu posición es la <strong>{entry.queue_position}</strong>. Si se libera un cupo te lo
        asignamos automáticamente y te avisamos por correo.
      </p>
      <ButtonLink to="/mis-reservas#lista-espera" variant="secondary">
        Ver mis reservas
      </ButtonLink>
    </section>
  );
}
export default function BookingPage() {
  const { id = '' } = useParams();
  const query = useClassSession(id);
  const { user, loading } = useAuth();
  if (loading || query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const s = query.data;
  if (!s) return <EmptyState title="Sesión no encontrada" action />;
  return (
    <div className="container page">
      <Link className="back-link" to={`/clases/${id}`}>
        <ArrowLeft size={16} />
        Regresar al detalle de la clase
      </Link>
      <div className="booking-header">
        <h1>{waitlistOpen(s) ? 'Lista de espera' : 'Reserva tu lugar'}</h1>
        <ol className="stepper" aria-label="Pasos de la reserva">
          <li className="done">
            <span aria-hidden="true">
              <Check size={14} />
            </span>
            Elegir clase
          </li>
          <li aria-current="step">
            <span aria-hidden="true">2</span>
            {user ? 'Confirmar datos' : 'Ingresar'}
          </li>
          <li>
            <span aria-hidden="true">3</span>
            Comprobante
          </li>
        </ol>
      </div>
      <div className="booking-layout">
        <ReservationSummary session={s} />
        {waitlistOpen(s) ? (
          user ? (
            <WaitlistStep sessionId={s.id} />
          ) : (
            <AuthGate />
          )
        ) : !isBookable(s) ? (
          <EmptyState
            title={
              bookingState(s) === 'cancelled'
                ? 'Clase cancelada'
                : bookingState(s) === 'full'
                  ? 'Clase completa'
                  : bookingState(s) === 'not-open'
                    ? 'Reservas aún no abiertas'
                    : 'La sesión ya comenzó'
            }
            message={
              bookingState(s) === 'cancelled'
                ? `El gimnasio canceló esta clase${s.cancel_reason ? `: ${s.cancel_reason}` : ''}. Elige otro horario.`
                : bookingState(s) === 'not-open'
                  ? `Las reservas se abren 7 días antes de la clase: desde el ${formatDate(bookingOpensAt(s).toISOString())}.`
                  : 'No se puede registrar una reserva para esta sesión. Explora otros horarios.'
            }
            action
          />
        ) : user ? (
          <ReservationForm sessionId={s.id} available={s.available} />
        ) : (
          <AuthGate />
        )}
      </div>
    </div>
  );
}
