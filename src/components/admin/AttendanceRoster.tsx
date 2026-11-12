import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRoster,
  getWaitlist,
  setAttendance,
  attendanceLabel,
  type AttendanceStatus,
  type ManagedSession,
  type RosterMember,
} from '../../features/admin/api';
import { useAuth } from '../../app/AuthProvider';
import { LoadingState, ErrorState, EmptyState } from '../ui/States';
import { Button } from '../ui/Button';
import { errorMessage } from '../../lib/errors';
import { formatDate, formatSessionWhen, formatTime } from '../../utils/sessions';
import { limaHour, noShowRisk, type RiskLevel } from '../../features/admin/risk';
import { limaWeekday, predictNoShow, reminderStatus } from '../../features/admin/noshowModel';

const riskBadge = { bajo: 'available', medio: 'low', alto: 'risk-high' } as const;

interface MemberRisk {
  level: RiskLevel;
  /** Probabilidad del modelo de ML; null si se usó la regla porque faltan datos. */
  probability: number | null;
  reasons: string[];
}

function RiskNote({ risk }: { risk: MemberRisk }) {
  return (
    <p className="admin-risk">
      <span className={`badge ${riskBadge[risk.level]}`}>Riesgo {risk.level}</span>
      {risk.probability !== null && (
        <strong>{Math.round(risk.probability * 100)} % de probabilidad de no-show · </strong>
      )}
      {risk.reasons.length ? risk.reasons.join(' · ') : 'Sin factores de riesgo'}
    </p>
  );
}
export function AttendanceRoster({
  session,
  discipline,
  onClose,
}: {
  session: ManagedSession;
  /** Disciplina de la clase: la necesita el modelo de ML. Sin ella se usa la regla simple. */
  discipline?: string;
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
  const waitlist = useQuery({
    queryKey: ['admin', 'waitlist', user?.id, session.id],
    queryFn: () => getWaitlist(session.id),
    refetchInterval: 30000,
  });
  const future = new Date(session.starts_at).getTime() > Date.now();
  const waiting = waitlist.data?.filter((w) => w.status === 'waiting') ?? [];
  // Riesgo solo para reservas activas y cuando la base ya entrega los datos necesarios.
  const startHour = limaHour(session.starts_at);
  const startsAt = new Date(session.starts_at);
  // El modelo de ML (APF3) da el nivel y la probabilidad; la regla aporta los motivos legibles y es
  // el respaldo si falta algún dato (por ejemplo, la disciplina).
  const riskOf = (r: RosterMember): MemberRisk | null => {
    if (r.status === 'cancelled' || typeof r.prior_reservations !== 'number' || !r.booked_at) {
      return null;
    }
    const hoursAhead = (startsAt.getTime() - new Date(r.booked_at).getTime()) / 3600000;
    const rule = noShowRisk({
      priorReservations: r.prior_reservations,
      priorAbsences: r.prior_absences ?? 0,
      hoursAhead,
      startHour,
    });
    if (!discipline) return { level: rule.level, probability: null, reasons: rule.reasons };
    const reminder = reminderStatus(r, session.starts_at, r.booked_at);
    const model = predictNoShow({
      disciplina: discipline,
      inicio_sesion: session.starts_at,
      dia_semana: limaWeekday(session.starts_at),
      hora_inicio: startHour,
      duracion_min: session.duration_minutes,
      capacidad: session.capacity,
      reservas_activas: session.reserved,
      anticipacion_horas: Math.max(hoursAhead, 0.1),
      reservas_previas: r.prior_reservations,
      inasistencias_previas: r.prior_absences ?? 0,
      recordatorio_enviado: reminder,
    });
    const reasons =
      reminder === false ? [...rule.reasons, 'Sin recordatorio por correo'] : rule.reasons;
    return { level: model.level, probability: model.probability, reasons };
  };
  const risks = new Map((query.data ?? []).map((r) => [r.id, riskOf(r)]));
  const highRisk = [...risks.values()].filter((r) => r?.level === 'alto').length;
  const usesModel = [...risks.values()].some((r) => r && r.probability !== null);
  return (
    <section className="panel admin-roster" aria-label="Inscritos y asistencia">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow accent">Control de asistencia</p>
          <h2>{session.name}</h2>
          <p>
            {formatSessionWhen(session.starts_at, session.duration_minutes)} · {session.room}
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
          {[...risks.values()].some(Boolean) && (
            <p className="admin-risk-summary">
              {future && highRisk > 0 ? (
                <>
                  <strong>
                    {highRisk} {highRisk === 1 ? 'inscrito tiene' : 'inscritos tienen'} riesgo alto
                    de no-show.
                  </strong>{' '}
                  Conviene confirmarles la asistencia por WhatsApp y, si no confirman, liberar el
                  cupo para la lista de espera.{' '}
                </>
              ) : null}
              {usesModel ? (
                <>
                  El riesgo lo estima el modelo de Machine Learning del APF3 (regresión logística)
                  con el historial del socio, la anticipación, el horario, la ocupación y el
                  recordatorio. Riesgo medio: enviar un recordatorio adicional. Entrenado con datos
                  simulados: se reentrenará con la asistencia real registrada aquí.
                </>
              ) : (
                <>
                  El riesgo se estima con reglas simples: faltas anteriores sin avisar, primera
                  reserva, anticipación y horario de la clase.
                </>
              )}
            </p>
          )}
          <div className="admin-roster-grid">
            {query.data.map((r) => (
              <article className="admin-member" key={r.id}>
                <h3>{r.member_name}</h3>
                <p>{r.member_email}</p>
                <p className="reservation-code">{r.code}</p>
                {risks.get(r.id) && <RiskNote risk={risks.get(r.id)!} />}
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
                          {attendanceLabel[h.status]} · {formatDate(h.created_at)},{' '}
                          {formatTime(h.created_at)}
                          <br />
                          <small>
                            {h.recorded_by === user?.id
                              ? 'Registrado por ti'
                              : `Registrado por ${h.recorded_by_email ?? 'otro administrador'}`}
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
      {waitlist.isSuccess && (waiting.length > 0 || waitlist.data.length > 0) && (
        <section className="admin-waitlist" aria-label="Lista de espera">
          <h3>Lista de espera · {waiting.length} esperando</h3>
          <p>
            Cuando se libera un cupo, el primero de la fila recibe la reserva y un aviso por correo.
            Si la fila es larga, considera subir la capacidad de la sesión.
          </p>
          <ol>
            {waitlist.data.map((w) => (
              <li key={w.id}>
                <strong>{w.member_name}</strong> · {w.member_email}
                <small>
                  {w.status === 'promoted'
                    ? ' · recibió un cupo'
                    : ` · se apuntó el ${formatDate(w.created_at)}, ${formatTime(w.created_at)}`}
                </small>
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}
