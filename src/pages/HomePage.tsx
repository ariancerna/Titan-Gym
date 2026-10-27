import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, MapPin, MessageCircle } from 'lucide-react';
import { useSessions, useGymLocations } from '../features/classes/queries';
import { ClassCard } from '../components/classes/ClassCard';
import { ButtonLink } from '../components/ui/Button';
import { CardGridSkeleton, EmptyState, ErrorState } from '../components/ui/States';
import { Photo } from '../components/ui/Photo';
import { LiveBoard } from '../components/home/LiveBoard';
import { Marquee } from '../components/home/Marquee';
import { disciplines } from '../content/disciplines';
import { gym } from '../content/gym';

// Reglas que el sistema hace cumplir de verdad (ventana de 7 días, refresco cada 15 s, lista de espera).
const houseRules = [
  { big: '7', unit: 'días', text: 'Las reservas abren una semana antes de cada clase.' },
  { big: '15', unit: 's', text: 'Los cupos se actualizan solos. Lo que ves es lo que queda.' },
  {
    big: '1',
    unit: 'código',
    text: 'Tu reserva tiene un código. Lo enseñas en recepción y entras.',
  },
  {
    big: '0',
    unit: 'cupos?',
    text: 'Entra a la lista de espera: si alguien cancela, el lugar pasa por orden de llegada.',
  },
];

export default function HomePage() {
  const query = useSessions();
  const sessions = query.data ?? [];
  const locationQuery = useGymLocations();
  const locations = locationQuery.data?.length
    ? locationQuery.data
    : [{ id: 'sede', name: gym.branch, address: gym.address }];
  const perDiscipline = (name: string) => sessions.filter((s) => s.discipline === name).length;

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-media" aria-hidden="true">
          <Photo
            className="hero-photo"
            src="/assets/generated/hero.jpg"
            alt=""
            fetchPriority="high"
          />
        </div>
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="hero-kicker">
              <span>{gym.branch}</span>
              <span>Carabayllo · Lima Norte</span>
            </p>
            <h1 id="hero-title" className="hero-title">
              <span className="hero-line">WAKE THE</span>{' '}
              <span className="hero-line hero-best">BEST</span>
            </h1>
            <p className="hero-lead">
              Spinning, HIIT, funcional y más. Mira cuántos cupos quedan en tiempo real y asegura tu
              lugar antes de salir de casa.
            </p>
            <div className="hero-buttons">
              <ButtonLink to="/clases">
                Explorar clases <ArrowRight size={18} />
              </ButtonLink>
              <ButtonLink to="/mis-reservas" variant="secondary">
                Mis reservas
              </ButtonLink>
            </div>
          </div>
          <LiveBoard sessions={sessions} status={query.status} />
        </div>
        <p className="hero-coords" aria-hidden="true">
          11.8906° S · 77.0422° O
        </p>
      </section>
      <Marquee items={disciplines.map((d) => d.name)} />

      <section className="container section" aria-labelledby="next-title">
        <header className="section-head">
          <h2 id="next-title">
            Próximas <span className="outline">clases</span>
          </h2>
          <div className="section-head-side">
            <p>
              {query.isSuccess
                ? `${sessions.length} ${sessions.length === 1 ? 'sesión' : 'sesiones'} en los próximos 7 días.`
                : 'La agenda de los próximos 7 días.'}
            </p>
            <ButtonLink to="/clases" variant="secondary">
              Ver toda la agenda <ArrowRight size={16} />
            </ButtonLink>
          </div>
        </header>
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

      <section className="section disciplines-section" aria-labelledby="disc-title">
        <div className="container">
          <header className="section-head">
            <h2 id="disc-title">
              Elige tu <span className="outline">disciplina</span>
            </h2>
            <div className="section-head-side">
              <p>Seis formas de sudar en la misma sede. Toca una para ver solo sus horarios.</p>
            </div>
          </header>
          <ul className="discipline-grid">
            {disciplines.map((d, i) => {
              const count = perDiscipline(d.name);
              return (
                <li key={d.name} data-discipline={d.name}>
                  <Link
                    to={`/clases?disciplina=${encodeURIComponent(d.name)}`}
                    className="discipline-tile"
                  >
                    <Photo src={d.image} alt="" loading="lazy" />
                    <span className="dt-index" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="dt-body">
                      <strong>{d.name}</strong>
                      <span>{d.line}</span>
                      {query.isSuccess && (
                        <small>
                          {count
                            ? `${count} ${count === 1 ? 'sesión' : 'sesiones'} esta semana`
                            : 'Sin sesiones esta semana'}
                        </small>
                      )}
                    </span>
                    <ArrowUpRight className="dt-arrow" size={22} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="container section" aria-labelledby="rules-title">
        <header className="section-head">
          <h2 id="rules-title">
            Las reglas <span className="outline">de la casa</span>
          </h2>
          <div className="section-head-side">
            <p>Sin cuadernos ni mensajes. El aforo de cada sala se respeta siempre.</p>
          </div>
        </header>
        <ol className="rules">
          {houseRules.map((r) => (
            <li key={r.unit}>
              <p className="rule-big">
                {r.big}
                <small>{r.unit}</small>
              </p>
              <p>{r.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container section venue" aria-labelledby="venue-title">
        <div className="venue-copy">
          <h2 id="venue-title">Nuestra sede</h2>
          {locations.map((l) => (
            <div key={l.id} className="venue-address">
              <p className="venue-name">{l.name}</p>
              <p>{l.address}</p>
            </div>
          ))}
          <div className="hero-buttons">
            <a
              className="btn btn-primary"
              href={gym.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={18} aria-hidden="true" /> Cómo llegar
              <span className="sr-only"> (abre Google Maps en otra pestaña)</span>
            </a>
            <a
              className="btn btn-secondary"
              href={gym.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} aria-hidden="true" /> WhatsApp {gym.whatsapp}
              <span className="sr-only"> (abre WhatsApp en otra pestaña)</span>
            </a>
          </div>
          <p className="venue-note">
            ¿No puedes ir? Cancela desde <Link to="/mis-reservas">Mis reservas</Link> antes de que
            empiece la clase y tu cupo pasa a otro socio.
          </p>
        </div>
        <figure className="venue-map">
          <iframe
            src={gym.mapsEmbedUrl}
            title={`Mapa de ${gym.branch}, ${gym.address}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <figcaption>
            <span>
              <MapPin size={16} aria-hidden="true" />
              {gym.branch}
            </span>
            <a href={gym.mapsUrl} target="_blank" rel="noopener noreferrer">
              Abrir en Google Maps <ArrowUpRight size={14} aria-hidden="true" />
              <span className="sr-only"> (abre en otra pestaña)</span>
            </a>
          </figcaption>
        </figure>
      </section>

      <section className="final-cta" aria-labelledby="cta-title">
        <div className="container final-cta-inner">
          <h2 id="cta-title">
            ¿Entrenas <span>hoy?</span>
          </h2>
          <ButtonLink to="/clases">
            Ver horarios <ArrowRight size={18} />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
