import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { useClassSession } from '../features/classes/queries';
import { ReservationSummary } from '../components/reservations/ReservationSummary';
import { ReservationForm } from '../components/reservations/ReservationForm';
import { AuthGate } from '../components/reservations/AuthGate';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { bookingOpensAt, bookingState, formatDate, isBookable } from '../utils/sessions';
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
        <h1>Reserva tu lugar</h1>
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
        {!isBookable(s) ? (
          <EmptyState
            title={
              bookingState(s) === 'full'
                ? 'Clase completa'
                : bookingState(s) === 'not-open'
                  ? 'Reservas aún no abiertas'
                  : 'La sesión ya comenzó'
            }
            message={
              bookingState(s) === 'not-open'
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
