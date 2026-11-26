import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { getDataset } from '../../features/admin/api';
import { useAuth } from '../../app/AuthProvider';
import { formatDate, formatTime } from '../../utils/sessions';
import { Button } from '../ui/Button';

/** Clases de los últimos días que se revisan en busca de asistencia sin registrar. */
export const PENDING_WINDOW_DAYS = 14;

interface PendingSession {
  sessionId: string;
  name: string;
  startsAt: string;
  pending: number;
}

/**
 * Aviso en «Hoy»: clases ya dictadas con reservas cuya asistencia sigue sin registrar. Sin ese dato
 * no se puede medir el indicador de no-shows ni reentrenar el modelo con asistencia real.
 */
export function PendingAttendance({ onOpen }: { onOpen: (sessionId: string) => void }) {
  const { user } = useAuth();
  // Misma consulta y caché que Indicadores.
  const query = useQuery({ queryKey: ['admin', 'dataset', user?.id], queryFn: getDataset });
  if (!query.data) return null;
  const since = Date.now() - PENDING_WINDOW_DAYS * 86400000;
  const now = Date.now();
  const bySession = new Map<string, PendingSession>();
  for (const row of query.data) {
    const start = new Date(row.inicio_sesion).getTime();
    const ended = start + row.duracion_min * 60000 <= now;
    if (row.estado === 'cancelled' || row.asistencia !== 'pending' || start < since || !ended)
      continue;
    const entry = bySession.get(row.sesion_id) ?? {
      sessionId: row.sesion_id,
      name: row.clase,
      startsAt: row.inicio_sesion,
      pending: 0,
    };
    entry.pending += 1;
    bySession.set(row.sesion_id, entry);
  }
  const sessions = [...bySession.values()].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  if (!sessions.length) return null;
  const total = sessions.reduce((sum, s) => sum + s.pending, 0);
  return (
    <section className="notice warning pending-attendance" aria-label="Asistencia pendiente">
      <p>
        <ClipboardCheck size={18} aria-hidden="true" />{' '}
        <strong>
          {sessions.length === 1
            ? '1 clase ya dictada tiene'
            : `${sessions.length} clases ya dictadas tienen`}{' '}
          asistencia sin registrar ({total} {total === 1 ? 'reserva' : 'reservas'}).
        </strong>{' '}
        Registrarla permite medir el porcentaje de no-shows y reentrenar el modelo con datos reales.
      </p>
      <ul>
        {sessions.slice(0, 5).map((s) => (
          <li key={s.sessionId}>
            <span>
              {s.name} · {formatDate(s.startsAt)}, {formatTime(s.startsAt)} · {s.pending}{' '}
              {s.pending === 1 ? 'pendiente' : 'pendientes'}
            </span>
            <Button variant="secondary" onClick={() => onOpen(s.sessionId)}>
              Registrar asistencia
            </Button>
          </li>
        ))}
      </ul>
      {sessions.length > 5 && (
        <p className="admin-roster-muted">
          Y {sessions.length - 5} clases más: revísalas en Agenda → Pasadas.
        </p>
      )}
    </section>
  );
}
