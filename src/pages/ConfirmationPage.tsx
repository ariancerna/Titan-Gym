import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Check, CalendarCheck, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { getReservation } from '../features/reservations/api';
import { useClassSession } from '../features/classes/queries';
import { ReservationSummary } from '../components/reservations/ReservationSummary';
import { AuthGate } from '../components/reservations/AuthGate';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { ButtonLink } from '../components/ui/Button';
function Receipt({ id }: { id: string }) {
  const { user } = useAuth();
  const reservation = useQuery({
    queryKey: ['reservations', user?.id, id],
    queryFn: () => getReservation(id),
    enabled: /^[0-9a-f-]{36}$/i.test(id),
  });
  const query = useClassSession(reservation.data?.session_id ?? '');
  if (reservation.isLoading || query.isLoading) return <LoadingState />;
  if (reservation.isError || query.isError)
    return (
      <ErrorState
        error={reservation.error ?? query.error}
        retry={() => {
          void reservation.refetch();
          void query.refetch();
        }}
      />
    );
  const r = reservation.data;
  const s = query.data;
  if (!r || !s)
    return (
      <EmptyState
        title="Reserva no encontrada"
        message="No existe un comprobante accesible para tu cuenta con ese identificador."
        action
      />
    );
  const cancelled = r.status === 'cancelled';
  return (
    <div className="container page confirmation">
      <div className={cancelled ? 'success-icon cancelled' : 'success-icon'}>
        {cancelled ? <X size={32} /> : <Check size={32} />}
      </div>
      <p className="eyebrow yellow">Comprobante de reserva</p>
      <h1>
        {cancelled
          ? 'Reserva cancelada'
          : r.status === 'confirmed'
            ? '¡Reserva confirmada!'
            : 'Comprobante de reserva'}
      </h1>
      <p>
        {cancelled
          ? 'Cancelaste esta reserva y el cupo quedó libre. El código ya no es válido para ingresar.'
          : 'Tu reserva está guardada. En recepción escanearán tu QR para registrar tu asistencia.'}
      </p>
      <article className="receipt panel">
        <div className="receipt-code">
          {!cancelled && (
            <figure className="receipt-qr">
              {/* El QR solo contiene el código: sin nombre ni correo del socio. */}
              <QRCodeSVG
                value={r.code}
                size={176}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#101114"
                role="img"
                aria-label={`Código QR de la reserva ${r.code}`}
              />
              <figcaption>Muestra este QR en recepción</figcaption>
            </figure>
          )}
          <small>Código de reserva</small>
          <strong>{r.code}</strong>
          <span className={`badge ${cancelled ? 'full' : 'available'}`}>
            {cancelled
              ? 'Cancelada'
              : r.status === 'attended'
                ? 'Asistencia registrada'
                : 'Confirmada'}
          </span>
        </div>
        <ReservationSummary session={s} />
        <div className="receipt-member">
          <small>Socio titular</small>
          <strong>{r.member_name}</strong>
          <p>{r.member_email}</p>
        </div>
      </article>
      {!cancelled && (
        <div className="notice">
          Llega 10 minutos antes y muestra el QR desde Mis reservas; no necesitas imprimirlo. Si no
          puedes asistir, cancela para liberar el cupo.
        </div>
      )}
      <div className="hero-buttons">
        <ButtonLink to="/mis-reservas">
          <CalendarCheck size={18} />
          Ver mis reservas
        </ButtonLink>
        <ButtonLink to="/clases" variant="secondary">
          Explorar más clases <ArrowRight size={18} />
        </ButtonLink>
      </div>
    </div>
  );
}
export default function ConfirmationPage() {
  const { id = '' } = useParams();
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  return user ? (
    <Receipt id={id} />
  ) : (
    <div className="container page narrow">
      <AuthGate />
    </div>
  );
}
