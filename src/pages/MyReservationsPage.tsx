import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, UserRound } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { getReservations } from '../features/reservations/api';
import { useClassSession } from '../features/classes/queries';
import { dayLabel, formatDate, timeRange } from '../utils/sessions';
import type { Reservation } from '../types/domain';
import { AuthGate } from '../components/reservations/AuthGate';
import { CreatePasswordForm } from '../components/reservations/CreatePasswordForm';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
function ReservationCard({ reservation: r, history }: { reservation: Reservation; history: boolean }) {
  const query = useClassSession(r.session_id);
  if (query.isLoading) return <LoadingState/>;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()}/>;
  const s = query.data;
  if (!s) return <article className="panel"><p>Sesión no disponible · {r.code}</p></article>;
  const past = new Date(s.starts_at).getTime() <= Date.now() || r.status !== 'confirmed';
  if (history !== past) return null;
  return <article className="reservation-card panel"><div className="reservation-date"><span className="eyebrow yellow">{dayLabel(s.starts_at)}</span><strong>{formatDate(s.starts_at)}</strong><span>{timeRange(s)}</span></div><div className="reservation-info"><span className={`badge ${r.status === 'cancelled' ? 'full' : 'available'}`}>{r.status === 'confirmed' ? 'Confirmada' : r.status === 'cancelled' ? 'Cancelada' : 'Asistencia registrada'}</span><h2>{s.name}</h2><p className="meta"><UserRound size={15}/>{s.instructor}<MapPin size={15}/>{s.location}</p><p className="reservation-code">{r.code}</p></div><Link className="btn btn-primary" to={`/reserva-confirmada/${r.id}`}>Ver comprobante</Link></article>;
}
function ReservationList() {
  const { user } = useAuth();
  const [history, setHistory] = useState(false);
  const query = useQuery({ queryKey: ['reservations', user?.id], queryFn: getReservations });
  return <><div className="reservation-tabs"><button className={!history ? 'chip selected' : 'chip'} aria-pressed={!history} onClick={() => setHistory(false)}><CalendarDays size={16}/>Próximas sesiones</button><button className={history ? 'chip selected' : 'chip'} aria-pressed={history} onClick={() => setHistory(true)}>Historial pasado</button></div>{query.isPending ? <LoadingState/> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()}/> : query.data.length ? <div className="reservation-list">{query.data.map(r => <ReservationCard key={r.id} reservation={r} history={history}/>)}<div className="list-empty"><EmptyState title={history ? 'Aún no hay historial' : 'Sin próximas reservas'} message="Explora el catálogo y encuentra tu siguiente entrenamiento." action/></div></div> : <EmptyState title="Todavía no tienes reservas" message="Tu próximo entrenamiento comienza con una reserva." action/>}<p className="notice">Las cancelaciones, la asistencia y los recordatorios estarán disponibles en una siguiente etapa.</p></>;
}
export default function MyReservationsPage() { const { user, loading } = useAuth(); return <div className="container page"><div className="page-heading"><p className="eyebrow yellow">FitSmart Agenda</p><h1>Mis reservas y entrenamientos</h1><p>Gestiona tus próximas sesiones, consulta tu historial y verifica tus comprobantes.</p></div>{loading ? <LoadingState/> : user ? <><CreatePasswordForm key={user.id}/><ReservationList/></> : <div className="narrow"><AuthGate/></div>}</div>; }
