import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { useClassSession } from '../features/classes/queries';
import { ReservationSummary } from '../components/reservations/ReservationSummary';
import { ReservationForm } from '../components/reservations/ReservationForm';
import { AuthGate } from '../components/reservations/AuthGate';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { isBookable } from '../utils/sessions';
export default function BookingPage() {
  const { id = '' } = useParams();
  const query = useClassSession(id);
  const { user, loading } = useAuth();
  if (loading || query.isLoading) return <LoadingState/>;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()}/>;
  const s = query.data;
  if (!s) return <EmptyState title="Sesión no encontrada" action/>;
  return <div className="container page"><Link className="back-link" to={`/clases/${id}`}><ArrowLeft size={16}/>Regresar al detalle de la clase</Link><section className="booking-progress panel"><p className="eyebrow yellow">FitSmart Agenda · Validación</p><h1>Paso 1 de 2: confirmación de datos</h1><div className="bar bar-low"><span style={{ width: '50%' }}/></div></section><div className="booking-layout"><ReservationSummary session={s}/>{!isBookable(s) ? <EmptyState title={s.available <= 0 ? 'Clase completa' : 'La sesión ya comenzó'} message="No se puede registrar una reserva para esta sesión. Explora otros horarios." action/> : user ? <ReservationForm sessionId={s.id} available={s.available}/> : <AuthGate/>}</div></div>;
}
