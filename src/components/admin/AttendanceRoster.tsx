import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRoster,
  getRosterRisk,
  getWaitlist,
  setAttendance,
  attendanceLabel,
  type AttendanceStatus,
  type ManagedSession,
  type RosterMember,
} from '../../features/admin/api';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { LoadingState, ErrorState, EmptyState } from '../ui/States';
import { Button } from '../ui/Button';
import { errorMessage } from '../../lib/errors';
import { formatDate, formatSessionWhen, formatTime } from '../../utils/sessions';
import { limaHour, noShowRisk, type RiskLevel } from '../../features/admin/risk';
import { confirmationLink } from '../../features/admin/whatsapp';

const riskBadge = { bajo: 'available', medio: 'low', alto: 'risk-high' } as const;

interface MemberRisk {
  level: RiskLevel;
  /** Probabilidad que calcula el servidor; null si se usa la regla de respaldo. */
  probability: number | null;
  reasons: string[];
  /** servidor = modelo de ML en Supabase · regla = respaldo · cargando = esperando al servidor. */
  source: 'servidor' | 'regla' | 'cargando';
}

const riskOrder: Record<RiskLevel, number> = { alto: 0, medio: 1, bajo: 2 };

function RiskCell({ risk }: { risk: MemberRisk | null }) {
  if (!risk) return <span className="admin-roster-muted">—</span>;
  if (risk.source === 'cargando')
    return <span className="admin-roster-muted">Calculando en el servidor…</span>;
  return (
    <span className="admin-risk">
      <span className={`badge ${riskBadge[risk.level]}`}>Riesgo {risk.level}</span>
      {risk.probability !== null ? (
        <span className="admin-risk-prob">
          {Math.round(risk.probability * 100)} % de probabilidad de no-show
        </span>
      ) : (
        <span className="admin-risk-prob">Regla de respaldo</span>
      )}
    </span>
  );
}
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
  const waitlist = useQuery({
    queryKey: ['admin', 'waitlist', user?.id, session.id],
    queryFn: () => getWaitlist(session.id),
    refetchInterval: 30000,
  });
  // El riesgo lo calcula el servidor (modelo de ML en Supabase) y queda registrado. Se vuelve a pedir
  // cuando cambia el número de reservas activas, no en cada refresco de la lista.
  const activeCount = (query.data ?? []).filter((r) => r.status !== 'cancelled').length;
  const riskQuery = useQuery({
    queryKey: ['admin', 'roster-risk', user?.id, session.id, activeCount],
    queryFn: () => getRosterRisk(session.id),
    enabled: query.isSuccess && activeCount > 0,
    retry: false,
    staleTime: 5 * 60000,
  });
  const serverRisk = new Map((riskQuery.data ?? []).map((x) => [x.reservation_id, x]));
  const future = new Date(session.starts_at).getTime() > Date.now();
  const waiting = waitlist.data?.filter((w) => w.status === 'waiting') ?? [];
  // Riesgo solo para reservas activas y cuando la base ya entrega los datos necesarios.
  const startHour = limaHour(session.starts_at);
  const startsAt = new Date(session.starts_at);
  // El servidor da el nivel y la probabilidad; la regla aporta los motivos legibles y es el respaldo
  // (degradación controlada) si el modelo está desactivado, falla o tarda más de 6 segundos.
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
    const server = serverRisk.get(r.id);
    if (server) {
      const reasons =
        server.recordatorio_enviado === false
          ? [...rule.reasons, 'Sin recordatorio por correo']
          : rule.reasons;
      return {
        level: server.riesgo,
        probability: server.probabilidad_no_show,
        reasons,
        source: 'servidor',
      };
    }
    if (riskQuery.isPending && riskQuery.fetchStatus !== 'idle') {
      return { level: rule.level, probability: null, reasons: rule.reasons, source: 'cargando' };
    }
    return { level: rule.level, probability: null, reasons: rule.reasons, source: 'regla' };
  };
  const risks = new Map((query.data ?? []).map((r) => [r.id, riskOf(r)]));
  const highRisk = [...risks.values()].filter((r) => r?.level === 'alto').length;
  const usesModel = [...risks.values()].some((r) => r?.source === 'servidor');
  const modelVersion = riskQuery.data?.[0]?.modelo_version;
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
          {riskQuery.isError && (
            <p role="alert" className="notice warning admin-risk-fallback">
              <strong>Servicio de predicción no disponible.</strong> {errorMessage(riskQuery.error)}{' '}
              Mientras tanto se muestra el riesgo por reglas simples (respaldo) y recepción decide a
              quién confirmar.{' '}
              <button
                type="button"
                className="link-button"
                onClick={() => void riskQuery.refetch()}
              >
                Reintentar
              </button>
            </p>
          )}
          {[...risks.values()].some(Boolean) && (
            <div className="admin-risk-summary">
              {future && highRisk > 0 ? (
                <>
                  <strong>
                    {highRisk} {highRisk === 1 ? 'inscrito tiene' : 'inscritos tienen'} riesgo alto
                    de no-show.
                  </strong>{' '}
                  Usa «Confirmar por WhatsApp» para enviarles el mensaje ya escrito y, si no
                  confirman, libera el cupo para la lista de espera.{' '}
                </>
              ) : null}
              {usesModel ? (
                <details className="admin-risk-help">
                  <summary>
                    El riesgo lo estima el modelo de Machine Learning (regresión logística, versión{' '}
                    {modelVersion}) en el servidor. ¿Cómo se usa?
                  </summary>
                  Combina el historial del socio, la anticipación, el horario, la ocupación y el
                  recordatorio. Cada predicción queda registrada con su versión y fecha (Indicadores
                  → Servicio de predicción). Por defecto solo se confirma el riesgo alto (como
                  máximo 1 de cada 5 reservas); riesgo medio: recordatorio adicional si recepción
                  tiene tiempo. Entrenado con datos simulados: se reentrenará con la asistencia real
                  registrada aquí.
                </details>
              ) : (
                <>
                  El riesgo se estima con reglas simples: faltas anteriores sin avisar, primera
                  reserva, anticipación y horario de la clase.
                </>
              )}
            </div>
          )}
          <div className="admin-roster-table-wrap">
            <table className="admin-roster-table">
              <caption className="sr-only">
                Inscritos de la sesión, ordenados de mayor a menor riesgo de no-show
              </caption>
              <thead>
                <tr>
                  <th scope="col">Socio</th>
                  <th scope="col">Riesgo</th>
                  <th scope="col">Motivos</th>
                  <th scope="col">Asistencia</th>
                </tr>
              </thead>
              <tbody>
                {[...query.data]
                  // Primero quien más conviene confirmar; las canceladas al final.
                  .sort((a, b) => {
                    const ra = risks.get(a.id);
                    const rb = risks.get(b.id);
                    if (!ra || !rb) return ra ? -1 : rb ? 1 : 0;
                    return (
                      riskOrder[ra.level] - riskOrder[rb.level] ||
                      (rb.probability ?? 0) - (ra.probability ?? 0)
                    );
                  })
                  .map((r) => {
                    const risk = risks.get(r.id) ?? null;
                    const cancelled = r.status === 'cancelled';
                    return (
                      <tr className={`admin-member${cancelled ? ' is-cancelled' : ''}`} key={r.id}>
                        <th scope="row" data-label="Socio">
                          <strong className="admin-member-name">{r.member_name}</strong>
                          <span className="admin-roster-muted">{r.member_email}</span>
                          <span className="admin-roster-muted">
                            {r.code}
                            {cancelled && ' · Reserva cancelada'}
                          </span>
                        </th>
                        <td data-label="Riesgo">
                          <RiskCell risk={risk} />
                          {future &&
                            !cancelled &&
                            risk &&
                            risk.source !== 'cargando' &&
                            risk.level !== 'bajo' && (
                              <a
                                className="admin-whatsapp"
                                href={confirmationLink(r.member_name, session)}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Confirmar por WhatsApp a ${r.member_name} (abre WhatsApp)`}
                              >
                                <MessageCircle size={14} aria-hidden="true" /> Confirmar por
                                WhatsApp
                              </a>
                            )}
                        </td>
                        <td data-label="Motivos" className="admin-roster-reasons">
                          {risk
                            ? risk.reasons.length
                              ? risk.reasons.join(' · ')
                              : 'Sin factores de riesgo'
                            : '—'}
                        </td>
                        <td data-label="Asistencia">
                          <select
                            className="admin-roster-select"
                            aria-label={`Asistencia de ${r.member_name}`}
                            value={r.attendance_status}
                            disabled={future || cancelled || mutation.isPending}
                            onChange={(e) =>
                              mutation.mutate({
                                id: r.id,
                                status: e.target.value as AttendanceStatus,
                              })
                            }
                          >
                            {Object.entries(attendanceLabel).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          {r.history.length > 0 && (
                            <details className="admin-roster-history">
                              <summary>Historial de asistencia ({r.history.length})</summary>
                              <ol>
                                {r.history.map((h, i) => (
                                  <li key={`${h.created_at}-${i}`}>
                                    {attendanceLabel[h.status]} · {formatDate(h.created_at)},{' '}
                                    {formatTime(h.created_at)} ·{' '}
                                    {h.recorded_by === user?.id
                                      ? 'registrado por ti'
                                      : `registrado por ${h.recorded_by_email ?? 'otro administrador'}`}
                                  </li>
                                ))}
                              </ol>
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
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
