import { Link } from 'react-router-dom';
import { ArrowRight, CalendarX2, MapPin, Ticket } from 'lucide-react';
import { dayLabel, formatTime } from '../utils/sessions';
import { useSessions, useGymLocations } from '../features/classes/queries';
import { ClassCard } from '../components/classes/ClassCard';
import { ButtonLink } from '../components/ui/Button';
import { CardGridSkeleton, EmptyState, ErrorState } from '../components/ui/States';

const steps = [
  {
    title: 'Elige la clase',
    text: 'Filtra por disciplina, día o instructor y revisa la duración y la sala.',
  },
  {
    title: 'Revisa los cupos',
    text: 'Cada sesión muestra cuántos lugares quedan. El aforo se vuelve a comprobar al confirmar.',
  },
  {
    title: 'Confirma y guarda tu código',
    text: 'Ingresa con tu cuenta, confirma tus datos y presenta el código en recepción.',
  },
];

export default function HomePage() {
  const query = useSessions();
  const sessions = query.data ?? [];
  const locationQuery = useGymLocations();
  const locations = locationQuery.data ?? [];
  const next = sessions[0];
  const freeSpots = sessions.reduce((total, s) => total + Math.max(0, s.available), 0);
  const ready = query.isSuccess;

  return (
    <>
      <section className="hero">
        <img
          className="hero-photo"
          src="/assets/generated/hero.jpg"
          alt="Sala de entrenamiento con iluminación amarilla"
          fetchPriority="high"
        />
        <div className="hero-overlay" />
        <div className="container hero-content">
          <p className="hero-kicker">TITAN GYM · Reserva de clases grupales</p>
          <h1>
            SUPERA TUS <span>LÍMITES</span>
          </h1>
          <p>
            Consulta los horarios, mira cuántos cupos quedan y reserva tu lugar sin escribir por
            WhatsApp ni esperar a recepción.
          </p>
          <div className="hero-buttons">
            <ButtonLink to="/clases">
              Explorar clases <ArrowRight size={18} />
            </ButtonLink>
            <ButtonLink to="/mis-reservas" variant="secondary">
              Mis reservas
            </ButtonLink>
          </div>
          <dl className="hero-metrics" aria-live="polite">
            <div>
              <dt>Próxima clase</dt>
              <dd>
                {ready
                  ? next
                    ? `${dayLabel(next.starts_at)} ${formatTime(next.starts_at)}`
                    : 'Sin horarios'
                  : '—'}
              </dd>
              <small>{next?.name ?? 'Pronto se publicarán nuevas sesiones'}</small>
            </div>
            <div>
              <dt>En la agenda</dt>
              <dd>
                {ready
                  ? `${sessions.length} ${sessions.length === 1 ? 'sesión' : 'sesiones'}`
                  : '—'}
              </dd>
              <small>Programadas desde hoy</small>
            </div>
            <div>
              <dt>Cupos libres</dt>
              <dd>{ready ? freeSpots : '—'}</dd>
              <small>Sumando todas las sesiones</small>
            </div>
          </dl>
        </div>
      </section>

      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow yellow">Agenda</p>
            <h2>Próximas clases</h2>
          </div>
          <ButtonLink to="/clases" variant="secondary">
            Ver todos los horarios <ArrowRight size={16} />
          </ButtonLink>
        </div>
        {query.isPending ? (
          <CardGridSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : sessions.length ? (
          <div className="class-grid">
            {sessions.slice(0, 3).map((s) => (
              <ClassCard key={s.id} session={s} featured />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Próximamente nuevas sesiones"
            message="Todavía no hay sesiones publicadas en la agenda."
          />
        )}
      </section>

      <section className="how-section">
        <div className="container section how-layout">
          <div>
            <p className="eyebrow yellow">Cómo reservar</p>
            <h2>Tres pasos, sin llamadas</h2>
            <p>
              Antes las reservas se anotaban en un cuaderno o por mensaje. Ahora cada cupo queda
              registrado y nadie puede reservar por encima del aforo de la sala.
            </p>
          </div>
          <ol className="steps">
            {steps.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container home-info">
        <article className="panel">
          <h3>
            <MapPin size={20} />
            Nuestra sede
          </h3>
          {locationQuery.isPending ? (
            <p role="status">Consultando la dirección…</p>
          ) : locationQuery.isError ? (
            <p>No pudimos consultar la dirección. Inténtalo de nuevo.</p>
          ) : (
            locations.map((l) => (
              <p key={l.id}>
                <strong>{l.name}</strong>
                <br />
                {l.address}
              </p>
            ))
          )}
        </article>
        <article className="panel">
          <h3>
            <CalendarX2 size={20} />
            ¿No puedes asistir?
          </h3>
          <p>
            Cancela desde Mis reservas antes de que empiece la clase. Tu cupo queda libre para otro
            socio.
          </p>
        </article>
        <article className="panel">
          <h3>
            <Ticket size={20} />
            Tus comprobantes
          </h3>
          <p>Cada reserva tiene un código único que puedes consultar desde tu cuenta.</p>
          <Link to="/mis-reservas">
            Ir a Mis reservas <ArrowRight size={14} />
          </Link>
        </article>
      </section>
    </>
  );
}
