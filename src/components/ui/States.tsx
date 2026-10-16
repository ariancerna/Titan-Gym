import { AlertCircle, CalendarDays, LoaderCircle } from 'lucide-react';
import { Button, ButtonLink } from './Button';
import { errorMessage } from '../../lib/errors';
export function LoadingState() {
  return (
    <div className="state" role="status">
      <LoaderCircle className="animate-spin" />
      <p>Cargando la agenda…</p>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="state error" role="alert">
      <AlertCircle />
      <h2>Agenda no disponible</h2>
      <p>{errorMessage(error)}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
export function EmptyState({
  title = 'Sin clases para estos filtros',
  message = 'Prueba otra fecha o disciplina.',
  action = false,
}: {
  title?: string;
  message?: string;
  action?: boolean;
}) {
  return (
    <div className="state">
      <CalendarDays />
      <h2>{title}</h2>
      <p>{message}</p>
      {action && <ButtonLink to="/clases">Explorar clases</ButtonLink>}
    </div>
  );
}

/** Siluetas de tarjetas mientras carga el catálogo: anticipan la forma del contenido. */
export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="class-grid" role="status" aria-label="Cargando clases">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="class-card skeleton-card" aria-hidden="true">
          <span className="skeleton line short" />
          <span className="skeleton line title" />
          <span className="skeleton line" />
          <span className="skeleton line" />
          <span className="skeleton block" />
          <span className="skeleton button" />
        </div>
      ))}
    </div>
  );
}
