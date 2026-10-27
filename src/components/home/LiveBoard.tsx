import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ClassSession } from '../../types/domain';
import { countdownParts, dayLabel, formatTime, isBookable } from '../../utils/sessions';
import { useNow } from '../../hooks/useNow';
import { ButtonLink } from '../ui/Button';

const pad = (n: number) => String(n).padStart(2, '0');

/** Cuenta regresiva hasta la próxima clase. Con más de un día de margen muestra días y horas. */
function Countdown({ startsAt }: { startsAt: string }) {
  const now = useNow(1000);
  const t = countdownParts(startsAt, now);
  const units: [string, string][] =
    t.days > 0
      ? [
          [String(t.days), t.days === 1 ? 'día' : 'días'],
          [pad(t.hours), 'h'],
          [pad(t.minutes), 'min'],
        ]
      : [
          [pad(t.hours), 'h'],
          [pad(t.minutes), 'min'],
          [pad(t.seconds), 's'],
        ];
  return (
    <p className="lb-countdown">
      <span className="sr-only">Empieza en </span>
      {units.map(([value, label]) => (
        <span key={label} className="lb-unit">
          <strong>{value}</strong>
          <small>{label}</small>
        </span>
      ))}
    </p>
  );
}

export function LiveBoard({
  sessions,
  status,
}: {
  sessions: ClassSession[];
  status: 'pending' | 'error' | 'success';
}) {
  const next = sessions.find((s) => !s.cancelled);
  const later = sessions.filter((s) => s !== next && !s.cancelled).slice(0, 3);
  return (
    <aside className="live-board" aria-label="Próxima clase">
      <p className="lb-status">
        <span className="live-dot" aria-hidden="true" />
        En vivo · cupos al día
      </p>
      {status === 'pending' ? (
        <div className="lb-skeleton" role="status" aria-label="Cargando la agenda">
          <span className="skeleton line short" />
          <span className="skeleton line title" />
          <span className="skeleton line" />
          <span className="skeleton block" />
        </div>
      ) : status === 'error' ? (
        <div className="lb-empty">
          <p className="lb-name">La agenda no cargó</p>
          <p>Revisa tu conexión o mira todos los horarios.</p>
          <ButtonLink to="/clases" variant="secondary">
            Ver horarios
          </ButtonLink>
        </div>
      ) : !next ? (
        <div className="lb-empty">
          <p className="lb-name">Pronto, nuevos horarios</p>
          <p>Todavía no hay sesiones publicadas para esta semana.</p>
        </div>
      ) : (
        <>
          <p className="lb-label">
            Próxima clase · {dayLabel(next.starts_at)} {formatTime(next.starts_at)}
          </p>
          <Countdown startsAt={next.starts_at} />
          <p className="lb-name" data-discipline={next.discipline}>
            <span className="lb-disc" aria-hidden="true" />
            {next.name}
          </p>
          <p className="lb-meta">
            con {next.instructor} · {next.room}
          </p>
          <div className="lb-spots" data-full={next.available <= 0 || undefined}>
            <strong>{Math.max(0, next.available)}</strong>
            <span>
              {next.available === 1 ? 'cupo libre' : 'cupos libres'}
              <small> de {next.capacity}</small>
            </span>
          </div>
          <ButtonLink to={`/clases/${next.id}`} className="btn-block">
            {isBookable(next) ? 'Reservar esta clase' : 'Ver la clase'} <ArrowRight size={18} />
          </ButtonLink>
          {later.length > 0 && (
            <ol className="lb-next" aria-label="Después">
              {later.map((s) => (
                <li key={s.id} data-discipline={s.discipline}>
                  <Link to={`/clases/${s.id}`}>
                    <time dateTime={s.starts_at}>
                      <small>{dayLabel(s.starts_at).slice(0, 3)}</small>
                      {formatTime(s.starts_at)}
                    </time>
                    <span className="lb-next-name">{s.name}</span>
                    <span className="lb-next-spots">
                      {s.available > 0 ? `${s.available} libres` : 'Lleno'}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </aside>
  );
}
