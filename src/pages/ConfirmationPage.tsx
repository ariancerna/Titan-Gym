import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, CalendarCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { getReservation } from '../features/reservations/api';
import { useClassSession } from '../features/classes/queries';
import { ReservationSummary } from '../components/reservations/ReservationSummary';
import { AuthGate } from '../components/reservations/AuthGate';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { ButtonLink } from '../components/ui/Button';
function Receipt({ id }: { id: string }) {
  const { user } = useAuth();
  const reservation = useQuery({ queryKey: ['reservations', user?.id, id], queryFn: () => getReservation(id), enabled: /^[0-9a-f-]{36}$/i.test(id) });
  const query = useClassSession(reservation.data?.session_id ?? '');
  if (reservation.isLoading || query.isLoading) return <LoadingState/>;
  if (reservation.isError || query.isError) return <ErrorState error={reservation.error ?? query.error} retry={() => { void reservation.refetch(); void query.refetch(); }}/>;
  const r = reservation.data;
  const s = query.data;
  if (!r || !s) return <EmptyState title="Reserva no encontrada" message="No existe un comprobante accesible para tu cuenta con ese identificador." action/>;
  const confirmed = r.status === 'confirmed';
  return <div className="container page confirmation"><div className="success-icon"><Check size={32}/></div><p className="eyebrow yellow">Comprobante registrado</p><h1>{confirmed ? '¡Reserva confirmada!' : 'Comprobante de reserva'}</h1><p>Tu reserva está guardada en TITAN GYM. Conserva tu código para presentarlo en recepción.</p><article className="receipt panel"><div className="receipt-code"><small>Código único de reserva</small><strong>{r.code}</strong><span className="badge available">{r.status === 'cancelled' ? 'Cancelada' : r.status === 'attended' ? 'Asistencia registrada' : 'Confirmada'}</span></div><ReservationSummary session={s}/><div className="receipt-member"><small>Socio titular</small><strong>{r.member_name}</strong><p>{r.member_email}</p></div></article><div className="notice">Recuerda llegar 10 minutos antes y presentar tu código de reserva.</div><div className="hero-buttons"><ButtonLink to="/mis-reservas"><CalendarCheck size={18}/>Ver mis reservas</ButtonLink><ButtonLink to="/clases" variant="secondary">Explorar más clases <ArrowRight size={18}/></ButtonLink></div></div>;
}
export default function ConfirmationPage() { const { id = '' } = useParams(); const { user, loading } = useAuth(); if (loading) return <LoadingState/>; return user ? <Receipt id={id}/> : <div className="container page narrow"><AuthGate/></div>; }
