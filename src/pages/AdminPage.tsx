import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { useAdminRole } from '../features/admin/queries';
import {
  getAdminSnapshot,
  getDataset,
  type ManagedClass,
  type ManagedInstructor,
  type ManagedSession,
} from '../features/admin/api';
import { formatPercent } from '../features/admin/indicators';
import {
  groupByDay,
  recentNoShowRate,
  todaySummary,
  upcomingOccupancy,
} from '../features/admin/insights';
import { dateKey, dayLabel, formatDate } from '../utils/sessions';
import { ClassEditor, InstructorEditor, SessionEditor } from '../components/admin/AdminForms';
import { SessionRow } from '../components/admin/SessionRow';
import { AttendanceRoster } from '../components/admin/AttendanceRoster';
import { AttendanceIndicators } from '../components/admin/AttendanceIndicators';
import { CheckInPanel } from '../components/admin/CheckInPanel';
import { PasswordSignInForm } from '../components/reservations/PasswordSignInForm';
import { EmailRequestForm } from '../components/reservations/EmailRequestForm';
import { GoogleSignInButton } from '../components/reservations/GoogleSignInButton';
import { requestPasswordReset } from '../features/auth/password';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { Button } from '../components/ui/Button';

const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

const AGENDA_PAGE = 7;

type View = 'hoy' | 'agenda' | 'catalogo' | 'indicadores';
const views: [View, string][] = [
  ['hoy', 'Hoy'],
  ['agenda', 'Agenda'],
  ['catalogo', 'Catálogo'],
  ['indicadores', 'Indicadores'],
];
type Period = 'upcoming' | 'past' | 'all';

/** Métricas de la vista Hoy: lo que el personal necesita al abrir el panel. */
function TodayMetrics({ sessions }: { sessions: ManagedSession[] }) {
  const { user } = useAuth();
  const dataset = useQuery({ queryKey: ['admin', 'dataset', user?.id], queryFn: getDataset });
  const today = todaySummary(sessions);
  const occupancy = upcomingOccupancy(sessions);
  const noShows = dataset.data ? recentNoShowRate(dataset.data) : null;
  return (
    <dl className="admin-metrics">
      <div className="panel">
        <dt>Clases hoy</dt>
        <dd>{today.sessions}</dd>
        <small>
          {today.reserved} reservas · {today.waiting} en espera
        </small>
      </div>
      <div className="panel">
        <dt>Llegadas registradas hoy</dt>
        <dd>{today.present}</dd>
        <small>de {today.reserved} reservas del día</small>
      </div>
      <div className="panel">
        <dt>No-shows · últimos 30 días</dt>
        <dd>{formatPercent(noShows)}</dd>
        <small>Ausentes sin cancelar</small>
      </div>
      <div className="panel">
        <dt>Ocupación de las próximas clases</dt>
        <dd>{formatPercent(occupancy)}</dd>
        <small>Reservas sobre la capacidad total</small>
      </div>
    </dl>
  );
}

function AdminDashboard() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const view: View = views.find(([v]) => v === params.get('vista'))?.[0] ?? 'hoy';
  const query = useQuery({
    queryKey: ['admin', 'snapshot', user?.id],
    queryFn: getAdminSnapshot,
    refetchInterval: 30000,
  });
  const [editor, setEditor] = useState<'class' | 'session' | 'instructor' | null>(null);
  const [currentClass, setCurrentClass] = useState<ManagedClass>();
  const [currentSession, setCurrentSession] = useState<ManagedSession>();
  const [currentInstructor, setCurrentInstructor] = useState<ManagedInstructor>();
  const [rosterId, setRosterId] = useState<string>();
  const [filter, setFilter] = useState('');
  const [period, setPeriod] = useState<Period>('upcoming');
  // La agenda se dibuja por tandas de días (hallazgo Q3): con meses programados no se pintan
  // cientos de filas de golpe.
  const [days, setDays] = useState(AGENDA_PAGE);
  const [saved, setSaved] = useState('');
  const roster = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rosterId) roster.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [rosterId]);

  function show(next: View) {
    setEditor(null);
    setRosterId(undefined);
    setSaved('');
    setParams(next === 'hoy' ? {} : { vista: next }, { replace: true });
  }
  // Pestañas accesibles: las flechas cambian de pestaña.
  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const index = views.findIndex(([v]) => v === view);
    const step = event.key === 'ArrowRight' ? 1 : views.length - 1;
    const next = views[(index + step) % views.length][0];
    show(next);
    document.getElementById(`admin-tab-${next}`)?.focus();
  }
  const refresh = (message?: string) => {
    setEditor(null);
    setSaved(message ?? 'Cambios guardados en la base de datos.');
    void cache.invalidateQueries({ queryKey: ['admin'] });
    void cache.invalidateQueries({ queryKey: ['sessions'] });
  };
  const openEditor = (kind: 'class' | 'session' | 'instructor') => {
    setEditor(kind);
    setSaved('');
    setRosterId(undefined);
  };

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const rosterSession = data.sessions.find((s) => s.id === rosterId);
  const now = Date.now();
  const todayKey = dateKey(new Date());

  const row = (s: ManagedSession) => (
    <SessionRow
      key={s.id}
      session={s}
      onRoster={() => {
        setEditor(null);
        setRosterId(s.id);
      }}
      onEdit={() => {
        setCurrentSession(s);
        openEditor('session');
      }}
    />
  );

  const agenda = data.sessions
    .filter((s) => {
      if (period === 'all') return true;
      const upcoming = new Date(s.starts_at).getTime() > now;
      return period === 'upcoming' ? upcoming : !upcoming;
    })
    // Las próximas, de la más cercana a la más lejana; las pasadas, de la más reciente.
    .sort((a, b) =>
      period === 'upcoming'
        ? a.starts_at.localeCompare(b.starts_at)
        : b.starts_at.localeCompare(a.starts_at),
    )
    .filter((s) =>
      `${s.name} ${s.instructor} ${s.room}`.toLowerCase().includes(filter.toLowerCase()),
    );
  const agendaDays = groupByDay(agenda);
  const today = data.sessions
    .filter((s) => dateKey(s.starts_at) === todayKey)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <>
      <div
        className="admin-tabs"
        role="tablist"
        aria-label="Secciones del panel"
        onKeyDown={onTabKey}
      >
        {views.map(([value, label]) => (
          <button
            key={value}
            id={`admin-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={view === value}
            aria-controls="admin-view"
            tabIndex={view === value ? 0 : -1}
            onClick={() => show(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        id="admin-view"
        role="tabpanel"
        aria-labelledby={`admin-tab-${view}`}
        className="admin-view"
      >
        {saved && (
          <p role="status" className="notice success">
            {saved}
          </p>
        )}
        {editor === 'class' && (
          <ClassEditor
            key={`class-${currentClass?.id ?? 'new'}`}
            data={data}
            current={currentClass}
            onSaved={() => refresh()}
            onCancel={() => setEditor(null)}
          />
        )}
        {editor === 'session' && (
          <SessionEditor
            key={`session-${currentSession?.id ?? 'new'}`}
            data={data}
            current={currentSession}
            onSaved={refresh}
            onCancel={() => setEditor(null)}
          />
        )}
        {editor === 'instructor' && (
          <InstructorEditor
            key={`instructor-${currentInstructor?.id ?? 'new'}`}
            current={currentInstructor}
            onSaved={() => refresh()}
            onCancel={() => setEditor(null)}
          />
        )}
        <div ref={roster}>
          {rosterSession && (
            <AttendanceRoster
              key={`roster-${rosterSession.id}`}
              session={rosterSession}
              onClose={() => setRosterId(undefined)}
            />
          )}
        </div>

        {view === 'hoy' && (
          <>
            <TodayMetrics sessions={data.sessions} />
            <CheckInPanel />
            <section className="admin-day" aria-labelledby="today-title">
              <h2 id="today-title">Clases de hoy</h2>
              {today.length ? (
                <div className="admin-list">{today.map(row)}</div>
              ) : (
                <p className="notice">No hay clases programadas para hoy. Revisa la Agenda.</p>
              )}
            </section>
          </>
        )}

        {view === 'agenda' && (
          <section aria-label="Agenda de sesiones">
            <div className="admin-toolbar">
              <Button
                onClick={() => {
                  setCurrentSession(undefined);
                  openEditor('session');
                }}
              >
                <Plus size={18} />
                Nueva sesión
              </Button>
              <div className="admin-period" role="group" aria-label="Mostrar sesiones">
                {(
                  [
                    ['upcoming', 'Próximas'],
                    ['past', 'Pasadas'],
                    ['all', 'Todas'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`chip ${period === value ? 'selected' : ''}`}
                    aria-pressed={period === value}
                    onClick={() => {
                      setPeriod(value);
                      setDays(AGENDA_PAGE);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="admin-search">
                <span className="sr-only">Buscar sesiones</span>
                <input
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setDays(AGENDA_PAGE);
                  }}
                  type="search"
                  placeholder="Buscar por clase, instructor o sala…"
                />
              </label>
            </div>
            {period !== 'upcoming' && (
              <p className="admin-hint">
                Se muestran las sesiones pasadas de los últimos 90 días. El historial completo está
                en Indicadores.
              </p>
            )}
            {agenda.length ? (
              agendaDays.slice(0, days).map(([day, sessions]) => (
                <section key={day} className="admin-day" aria-labelledby={`day-${day}`}>
                  <h3 id={`day-${day}`}>
                    {capitalize(dayLabel(`${day}T12:00:00-05:00`))} ·{' '}
                    {formatDate(`${day}T12:00:00-05:00`)}
                    <small>
                      {sessions.length} {sessions.length === 1 ? 'sesión' : 'sesiones'}
                    </small>
                  </h3>
                  <div className="admin-list">{sessions.map(row)}</div>
                </section>
              ))
            ) : (
              <p className="notice">No hay sesiones con estos filtros.</p>
            )}
            {agendaDays.length > days && (
              <div className="admin-more">
                <Button variant="secondary" onClick={() => setDays((n) => n + AGENDA_PAGE)}>
                  Mostrar {AGENDA_PAGE} días más
                </Button>
                <small>
                  {days} de {agendaDays.length} días con sesiones
                </small>
              </div>
            )}
          </section>
        )}

        {view === 'catalogo' && (
          <section aria-label="Catálogo de clases e instructores">
            <div className="admin-toolbar">
              <Button
                onClick={() => {
                  setCurrentClass(undefined);
                  openEditor('class');
                }}
              >
                <Plus size={18} />
                Nueva clase
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setCurrentInstructor(undefined);
                  openEditor('instructor');
                }}
              >
                <Plus size={18} />
                Nuevo instructor
              </Button>
            </div>
            <section className="admin-day" aria-labelledby="classes-title">
              <h2 id="classes-title">Clases · {data.classes.length}</h2>
              <div className="admin-catalog">
                {data.classes.map((c) => (
                  <article
                    key={c.id}
                    className="panel admin-catalog-item"
                    data-discipline={data.disciplines.find((d) => d.id === c.discipline_id)?.name}
                  >
                    <div>
                      <p className="eyebrow accent">
                        {data.disciplines.find((d) => d.id === c.discipline_id)?.name}
                      </p>
                      <h3>{c.name}</h3>
                      <p>{c.description}</p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setCurrentClass(c);
                        openEditor('class');
                      }}
                    >
                      <Pencil size={16} />
                      Editar clase
                    </Button>
                  </article>
                ))}
              </div>
            </section>
            <section className="admin-day" aria-labelledby="instructors-title">
              <h2 id="instructors-title">Instructores · {data.instructors.length}</h2>
              <div className="admin-catalog">
                {data.instructors.map((i) => (
                  <article key={i.id} className="panel admin-catalog-item">
                    <div>
                      <h3>{i.name}</h3>
                      <p>{i.bio || 'Sin presentación.'}</p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setCurrentInstructor(i);
                        openEditor('instructor');
                      }}
                    >
                      <Pencil size={16} />
                      Editar instructor
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}

        {view === 'indicadores' && <AttendanceIndicators />}
      </div>
    </>
  );
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const role = useAdminRole();
  const [busy, setBusy] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  return (
    <div className="container page admin-page">
      <div className="page-heading">
        <p className="eyebrow accent">TITAN GYM · Gestión</p>
        <h1>Administración</h1>
        <p>Gestiona clases, sesiones, alumnos inscritos y asistencia.</p>
      </div>
      {loading ? (
        <LoadingState />
      ) : !user ? (
        <section className="panel auth-panel narrow" aria-label="Acceso administrativo">
          <h2>Acceso de administradores</h2>
          <p className="auth-intro">
            Ingresa con tu cuenta. Solo las cuentas autorizadas por el responsable del proyecto
            pueden ver el panel; iniciar sesión no concede el permiso.
          </p>
          {recovering ? (
            <EmailRequestForm
              id="admin-reset-email"
              submitLabel="Enviar enlace de recuperación"
              pendingLabel="Enviando enlace…"
              onRequest={requestPasswordReset}
              onBack={() => setRecovering(false)}
              sentMessage={(email) => (
                <p>
                  Si existe una cuenta con <strong>{email}</strong>, recibirás un enlace para elegir
                  una contraseña nueva.
                </p>
              )}
            />
          ) : (
            <>
              <PasswordSignInForm
                blocked={googleLoading}
                onBusy={setBusy}
                onForgot={() => setRecovering(true)}
              />
              <div className="auth-divider" aria-hidden="true">
                <span>o</span>
              </div>
              <GoogleSignInButton disabled={busy} onLoadingChange={setGoogleLoading} />
            </>
          )}
          <p className="auth-staff">
            ¿Eres socio? <Link to="/mis-reservas">Ir al acceso de socios</Link>
          </p>
        </section>
      ) : role.isPending ? (
        <LoadingState />
      ) : role.isError ? (
        <ErrorState error={role.error} retry={() => void role.refetch()} />
      ) : !role.data ? (
        <EmptyState
          title="Acceso restringido"
          message="Tu cuenta no tiene permisos de administrador. Puedes continuar usando el catálogo y tus reservas."
          action
        />
      ) : (
        <AdminDashboard key={user.id} />
      )}
    </div>
  );
}
