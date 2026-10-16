import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Clock,
  UsersRound,
  Droplets,
  Dumbbell,
} from 'lucide-react';
import { useClassSession } from '../features/classes/queries';
import { ReservationSummary } from '../components/reservations/ReservationSummary';
import { AvailabilityBadge } from '../components/classes/AvailabilityBadge';
import { Button, ButtonLink } from '../components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { isBookable } from '../utils/sessions';
export default function DetailPage() {
  const { id = '' } = useParams();
  const query = useClassSession(id);
  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const s = query.data;
  if (!s)
    return (
      <EmptyState
        title="Clase no encontrada"
        message="La sesión no existe o ya no está publicada."
        action
      />
    );
  return (
    <div className="container page">
      <div className="breadcrumbs">
        <span>
          <Link to="/">Inicio</Link> / <Link to="/clases">Clases</Link> / {s.name}
        </span>
        <Link to="/clases">
          <ArrowLeft size={15} />
          Volver al catálogo
        </Link>
      </div>
      <div className="detail-layout">
        <div>
          <article className="panel detail-hero">
            {s.image_url && (
              <div className="detail-image">
                <img src={s.image_url} alt={`Sesión de ${s.discipline} en TITAN GYM`} />
                <AvailabilityBadge available={s.available} capacity={s.capacity} />
              </div>
            )}
            <div className="detail-content">
              <p className="eyebrow yellow">{s.discipline} · TITAN GYM</p>
              <h1>{s.name}</h1>
              <p>{s.description}</p>
              <div className="detail-stats">
                <div>
                  <small>Duración</small>
                  <strong>
                    <Clock size={16} />
                    {s.duration_minutes} min
                  </strong>
                </div>
                <div>
                  <small>Capacidad máxima</small>
                  <strong>
                    <UsersRound size={16} />
                    {s.capacity} personas
                  </strong>
                </div>
              </div>
            </div>
          </article>
          <section className="panel includes">
            <h2>
              <ShieldCheck size={20} />
              Prepara tu entrenamiento
            </h2>
            <div className="includes-grid">
              <div>
                <Dumbbell />
                <h3>Entrena con propósito</h3>
                <p>
                  Escoge una sesión acorde a tu nivel y sigue las indicaciones de tu instructor.
                </p>
              </div>
              <div>
                <Droplets />
                <h3>Hidratación y equipo</h3>
                <p>Trae agua, una toalla y ropa deportiva cómoda.</p>
              </div>
            </div>
          </section>
          <div className="coach-grid">
            <section className="panel">
              <p className="eyebrow">Instructor</p>
              <div className="coach-heading">
                {s.instructor_image && (
                  <img src={s.instructor_image} alt={s.instructor} loading="lazy" />
                )}
                <div>
                  <h2>{s.instructor}</h2>
                  <p className="eyebrow yellow">{s.discipline}</p>
                </div>
              </div>
              <p>{s.instructor_bio}</p>
            </section>
            <section className="panel">
              <p className="eyebrow yellow">Requisitos previos</p>
              <h2>Normas de acceso</h2>
              <p>
                Llega 10 minutos antes para prepararte y consulta al instructor si necesitas adaptar
                el entrenamiento.
              </p>
              <p>{s.address}</p>
            </section>
          </div>
        </div>
        <aside className="detail-aside">
          <ReservationSummary session={s} />
          <div className="panel booking-panel">
            {isBookable(s) ? (
              <ButtonLink to={`/reservar/${s.id}`}>
                Reservar mi lugar <ArrowRight size={18} />
              </ButtonLink>
            ) : (
              <>
                <Button disabled>
                  {s.available <= 0 ? 'Clase completa' : 'Sesión finalizada'}
                </Button>
                <p>
                  No es posible reservar:{' '}
                  {s.available <= 0
                    ? 'la capacidad máxima ha sido alcanzada.'
                    : 'la clase ya comenzó.'}
                </p>
              </>
            )}
            <p className="meta">
              <ShieldCheck size={16} />
              El sistema verifica el aforo al confirmar.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
