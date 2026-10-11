import { ArrowRight, Clock, MapPin, UserRound } from 'lucide-react';
import type { ClassSession } from '../../types/domain';
import { dayLabel, formatDate, timeRange, isBookable } from '../../utils/sessions';
import { AvailabilityBadge } from './AvailabilityBadge';
import { OccupancyBar } from './OccupancyBar';
import { Button, ButtonLink } from '../ui/Button';
export function ClassCard({ session: s, featured = false }: { session: ClassSession; featured?: boolean }) {
  return <article className={`class-card ${featured ? 'featured' : ''}`}>{featured && (s.featured_image_url || s.image_url) && <div className="card-image"><img src={s.featured_image_url || s.image_url || undefined} alt={`Entrenamiento de ${s.discipline}`} loading="lazy"/><AvailabilityBadge available={s.available} capacity={s.capacity}/><span className="image-discipline">{s.discipline}</span></div>}<div className="card-body"><div className="card-top"><div><p className="eyebrow">{dayLabel(s.starts_at)} · {formatDate(s.starts_at)}</p><p className="session-time">{timeRange(s)}</p><p className="meta"><Clock size={14}/>{s.duration_minutes} min · {s.discipline}</p></div>{!featured && <AvailabilityBadge available={s.available} capacity={s.capacity}/>}</div><h3>{s.name}</h3><p className="meta"><UserRound size={15}/>Instructor: <strong>{s.instructor}</strong></p><p className="meta"><MapPin size={15}/>{s.location} · {s.room}</p><OccupancyBar capacity={s.capacity} reserved={s.reserved}/><div className="card-cta">{isBookable(s) ? <ButtonLink to={`/clases/${s.id}`}>Ver detalles y reservar <ArrowRight size={16}/></ButtonLink> : <><Button disabled>Clase completa · sin cupos</Button><ButtonLink to={`/clases/${s.id}`} variant="secondary">Ver detalles</ButtonLink></>}</div></div></article>;
}
