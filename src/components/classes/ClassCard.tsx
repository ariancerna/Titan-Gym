import { ArrowRight, MapPin } from 'lucide-react';
import type { ClassSession } from '../../types/domain';
import { dayLabel, formatShortDate, formatTime, isBookable } from '../../utils/sessions';
import { AvailabilityBadge } from './AvailabilityBadge';
import { OccupancyBar } from './OccupancyBar';
import { ButtonLink } from '../ui/Button';
import { Photo } from '../ui/Photo';

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase();
}

export function ClassCard({
  session: s,
  featured = false,
}: {
  session: ClassSession;
  featured?: boolean;
}) {
  const image = s.featured_image_url || s.image_url;
  const end = new Date(new Date(s.starts_at).getTime() + s.duration_minutes * 60000).toISOString();
  return (
    <article
      className={`class-card ${featured ? 'is-featured' : ''}`}
      data-discipline={s.discipline}
    >
      {featured && image && (
        <div className="cc-media">
          <Photo src={image} alt={`Entrenamiento de ${s.discipline}`} loading="lazy" />
          <span className="cc-media-tag">{s.discipline}</span>
        </div>
      )}
      <div className="cc-body">
        <div className="cc-head">
          <p className="cc-day">
            {dayLabel(s.starts_at)} · {formatShortDate(s.starts_at)}
          </p>
          <AvailabilityBadge available={s.available} capacity={s.capacity} />
        </div>
        <p className="cc-time">
          <strong>{formatTime(s.starts_at)}</strong>
          <span>
            a {formatTime(end)} · {s.duration_minutes} min
          </span>
        </p>
        <h3>{s.name}</h3>
        {!featured && (
          <p className="cc-discipline">
            <span aria-hidden="true" />
            {s.discipline}
          </p>
        )}
        <div className="cc-people">
          <span className="cc-coach">
            {s.instructor_image ? (
              <img src={s.instructor_image} alt="" loading="lazy" width="28" height="28" />
            ) : (
              <span className="cc-initials" aria-hidden="true">
                {initials(s.instructor)}
              </span>
            )}
            <span>
              <small>Instructor</small> {s.instructor}
            </span>
          </span>
          <span className="cc-room">
            <MapPin size={14} aria-hidden="true" />
            {s.room}
          </span>
        </div>
        <OccupancyBar capacity={s.capacity} reserved={s.reserved} />
        <div className="cc-cta">
          {isBookable(s) ? (
            <ButtonLink to={`/clases/${s.id}`}>
              Ver detalles y reservar <ArrowRight size={16} />
            </ButtonLink>
          ) : (
            <>
              <p className="card-full-note">Sin cupos. Revisa otro horario o vuelve más tarde.</p>
              <ButtonLink to={`/clases/${s.id}`} variant="secondary">
                Ver detalles
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
