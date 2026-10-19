import { useParams, Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, MapPin } from 'lucide-react';
import { useClassSession } from '../features/classes/queries';
import { ReservationSummary } from '../components/reservations/ReservationSummary';
import { Button, ButtonLink } from '../components/ui/Button';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import {
  bookingOpensAt,
  bookingState,
  formatDate,
  formatTime,
  waitlistOpen,
} from '../utils/sessions';
import { Photo } from '../components/ui/Photo';
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
  const state = bookingState(s);
  return (
    <div className="container page">
      <div className="breadcrumbs">
        <nav aria-label="Ruta de navegación">
          <Link to="/">Inicio</Link> / <Link to="/clases">Clases</Link> / {s.name}
        </nav>
      </div>
      <div className="detail-layout">
        <div>
          <article className="panel detail-hero">
            {s.image_url && (
              <div className="detail-image">
                <Photo src={s.image_url} alt={`Sesión de ${s.discipline} en TITAN GYM`} />
              </div>
            )}
            <div className="detail-content">
              <p className="eyebrow accent">{s.discipline}</p>
              <h1>{s.name}</h1>
              <p>{s.description}</p>
            </div>
          </article>
          <div className="coach-grid">
            <section className="panel">
              <p className="eyebrow">Instructor</p>
              <div className="coach-heading">
                {s.instructor_image && (
                  <img src={s.instructor_image} alt={s.instructor} loading="lazy" />
                )}
                <div>
                  <h2>{s.instructor}</h2>
                  <p className="eyebrow accent">{s.discipline}</p>
                </div>
              </div>
              <p>{s.instructor_bio}</p>
            </section>
            <section className="panel before-class">
              <p className="eyebrow accent">Antes de la clase</p>
              <h2>Qué tener en cuenta</h2>
              <ul>
                <li>Llega 10 minutos antes y presenta tu código en recepción.</li>
                <li>Trae agua, una toalla y ropa deportiva cómoda.</li>
                <li>Si tienes una lesión, avísale al instructor para adaptar los ejercicios.</li>
                <li>¿No podrás venir? Cancela desde Mis reservas para liberar tu cupo.</li>
              </ul>
              <p className="meta">
                <MapPin size={15} />
                {s.location} · {s.address}
              </p>
            </section>
          </div>
        </div>
        <aside className="detail-aside">
          <ReservationSummary session={s}>
            <div className="summary-action">
              {state === 'open' ? (
                <ButtonLink to={`/reservar/${s.id}`} className="btn-block">
                  Reservar mi lugar <ArrowRight size={18} />
                </ButtonLink>
              ) : waitlistOpen(s) ? (
                <>
                  <ButtonLink to={`/reservar/${s.id}`} className="btn-block">
                    Unirme a la lista de espera <ArrowRight size={18} />
                  </ButtonLink>
                  <p>
                    La clase está llena. Si alguien cancela, el cupo se asigna por orden de llegada
                    y te avisamos por correo.
                  </p>
                </>
              ) : (
                <>
                  <Button disabled className="btn-block">
                    {state === 'full'
                      ? 'Clase completa'
                      : state === 'not-open'
                        ? 'Reservas aún no abiertas'
                        : 'Sesión finalizada'}
                  </Button>
                  <p>
                    {state === 'full'
                      ? 'No es posible reservar: la capacidad máxima ha sido alcanzada.'
                      : state === 'not-open'
                        ? `Las reservas se abren 7 días antes: desde el ${formatDate(bookingOpensAt(s).toISOString())} a las ${formatTime(bookingOpensAt(s).toISOString())}.`
                        : 'No es posible reservar: la clase ya comenzó.'}
                  </p>
                </>
              )}
              <p className="meta">
                <ShieldCheck size={16} />
                El aforo se vuelve a comprobar al confirmar.
              </p>
            </div>
          </ReservationSummary>
        </aside>
      </div>
    </div>
  );
}
