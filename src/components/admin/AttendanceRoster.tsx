import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRoster,
  setAttendance,
  attendanceLabel,
  type AttendanceStatus,
  type ManagedSession,
} from '../../features/admin/api';
import { useAuth } from '../../app/AuthProvider';
import { LoadingState, ErrorState, EmptyState } from '../ui/States';
import { Button } from '../ui/Button';
import { errorMessage } from '../../lib/errors';
export function AttendanceRoster({
  session,
  onClose,
}: {
  session: ManagedSession;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const key = ['admin', 'roster', user?.id, session.id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => getRoster(session.id),
    refetchInterval: 30000,
  });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AttendanceStatus }) =>
      setAttendance(id, status),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: key });
      // El indicador de no-shows depende de la asistencia recién guardada.
      await cache.invalidateQueries({ queryKey: ['admin', 'dataset'] });
    },
  });
  const future = new Date(session.starts_at).getTime() > Date.now();
  return (
    <section className="panel admin-roster" aria-label="Inscritos y asistencia">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow yellow">Control de asistencia</p>
          <h2>{session.name}</h2>
          <p>
            {new Date(session.starts_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })} ·{' '}
            {session.room}
          </p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Cerrar inscritos
        </Button>
      </div>
      {future && (
        <p className="notice">
          Puedes consultar los inscritos. El registro de asistencia se habilita cuando comienza la
          sesión.
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="field-error">
          {errorMessage(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && <p role="status">Asistencia guardada correctamente.</p>}
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.length ? (
        <EmptyState title="Sin inscritos" message="Esta sesión todavía no tiene reservas." />
      ) : (
        <>
          <p>
            {query.data.length} reservas ·{' '}
            {query.data.filter((r) => r.attendance_status === 'present').length} presentes
          </p>
          <div className="admin-roster-grid">
            {query.data.map((r) => (
              <article className="admin-member" key={r.id}>
                <h3>{r.member_name}</h3>
                <p>{r.member_email}</p>
                <p className="reservation-code">{r.code}</p>
                <p>
                  Reserva: {r.status === 'cancelled' ? 'Cancelada' : 'Confirmada'} · Asistencia:{' '}
                  <strong>{attendanceLabel[r.attendance_status]}</strong>
                </p>
                <label className="admin-select">
                  Asistencia de {r.member_name}
                  <select
                    value={r.attendance_status}
                    disabled={future || r.status === 'cancelled' || mutation.isPending}
                    onChange={(e) =>
                      mutation.mutate({ id: r.id, status: e.target.value as AttendanceStatus })
                    }
                  >
                    {Object.entries(attendanceLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {r.history.length > 0 && (
                  <details>
                    <summary>Historial de asistencia ({r.history.length})</summary>
                    <ol>
                      {r.history.map((h, i) => (
                        <li key={`${h.created_at}-${i}`}>
                          {attendanceLabel[h.status]} ·{' '}
                          {new Date(h.created_at).toLocaleString('es-PE', {
                            timeZone: 'America/Lima',
                          })}
                          <br />
                          <small>
                            {h.recorded_by === user?.id
                              ? 'Registrado por ti'
                              : `Administrador ${h.recorded_by.slice(0, 8)}`}
                          </small>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
