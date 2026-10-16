import type { ReactNode } from 'react';
import { CalendarDays, Clock, MapPin, UserRound } from 'lucide-react';
import type { ClassSession } from '../../types/domain';
import { formatDate, timeRange } from '../../utils/sessions';
import { AvailabilityBadge } from '../classes/AvailabilityBadge';
import { OccupancyBar } from '../classes/OccupancyBar';
export function ReservationSummary({
  session: s,
  children,
  showNote = true,
}: {
  session: ClassSession;
  /** La nota de aforo solo tiene sentido antes de reservar (no en el comprobante). */
  showNote?: boolean;
  /** Acción principal (p. ej. el botón de reservar). Si no hay, se muestra la nota de aforo. */
  children?: ReactNode;
}) {
  return (
    <section className="panel summary">
      <div className="section-top">
        <span className="eyebrow">Detalle de sesión</span>
        <AvailabilityBadge available={s.available} capacity={s.capacity} />
      </div>
      <h2>{s.name}</h2>
      <dl className="detail-list">
        <div>
          <CalendarDays />
          <div>
            <dt>Fecha y horario</dt>
            <dd>
              {formatDate(s.starts_at)}
              <br />
              {timeRange(s)}
            </dd>
          </div>
        </div>
        <div>
          <UserRound />
          <div>
            <dt>Instructor</dt>
            <dd>{s.instructor}</dd>
          </div>
        </div>
        <div>
          <MapPin />
          <div>
            <dt>Sala</dt>
            <dd>{s.room}</dd>
          </div>
        </div>
        <div>
          <Clock />
          <div>
            <dt>Duración</dt>
            <dd>{s.duration_minutes} minutos</dd>
          </div>
        </div>
      </dl>
      <OccupancyBar capacity={s.capacity} reserved={s.reserved} />
      {children ??
        (showNote && (
          <p className="notice">
            Tu cupo se asigna al confirmar la reserva, sujeto a disponibilidad.
          </p>
        ))}
    </section>
  );
}
