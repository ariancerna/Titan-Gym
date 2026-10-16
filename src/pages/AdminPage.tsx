import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldCheck, Plus, CalendarDays, Users, Pencil } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { useAdminRole } from '../features/admin/queries';
import { getAdminSnapshot, type ManagedClass, type ManagedSession } from '../features/admin/api';
import { ClassEditor, SessionEditor } from '../components/admin/AdminForms';
import { AttendanceRoster } from '../components/admin/AttendanceRoster';
import { AttendanceIndicators } from '../components/admin/AttendanceIndicators';
import { CheckInPanel } from '../components/admin/CheckInPanel';
import { PasswordSignInForm } from '../components/reservations/PasswordSignInForm';
import { EmailRequestForm } from '../components/reservations/EmailRequestForm';
import { GoogleSignInButton } from '../components/reservations/GoogleSignInButton';
import { requestPasswordReset } from '../features/auth/password';
import { CreatePasswordForm } from '../components/reservations/CreatePasswordForm';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { Button } from '../components/ui/Button';

function AdminDashboard() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'snapshot', user?.id],
    queryFn: getAdminSnapshot,
    refetchInterval: 30000,
  });
  const [editor, setEditor] = useState<'class' | 'session' | null>(null);
  const [currentClass, setCurrentClass] = useState<ManagedClass>();
  const [currentSession, setCurrentSession] = useState<ManagedSession>();
  const [rosterId, setRosterId] = useState<string>();
  const [tab, setTab] = useState<'sessions' | 'classes'>('sessions');
  const [filter, setFilter] = useState('');
  const [period, setPeriod] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [saved, setSaved] = useState(false);
  const refresh = () => {
    setEditor(null);
    setSaved(true);
    void cache.invalidateQueries({ queryKey: ['admin'] });
    void cache.invalidateQueries({ queryKey: ['sessions'] });
  };
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const roster = data.sessions.find((s) => s.id === rosterId);
  const upcoming = data.sessions.filter((s) => new Date(s.starts_at).getTime() > Date.now());
  return (
    <>
      <div className="admin-metrics">
        <div className="panel">
          <CalendarDays />
          <strong>{upcoming.length}</strong>
          <span>Próximas sesiones · {data.sessions.length} en total</span>
        </div>
        <div className="panel">
          <Users />
          <strong>{upcoming.reduce((n, s) => n + s.reserved, 0)}</strong>
          <span>Reservas en próximas sesiones</span>
        </div>
        <div className="panel">
          <ShieldCheck />
          <strong>{data.classes.length}</strong>
          <span>Clases en el catálogo</span>
        </div>
      </div>
      <CheckInPanel />
      <AttendanceIndicators />
      <div className="admin-actions">
        <Button
          onClick={() => {
            setEditor('class');
            setCurrentClass(undefined);
            setSaved(false);
          }}
        >
          <Plus size={18} />
          Nueva clase
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setEditor('session');
            setCurrentSession(undefined);
            setSaved(false);
          }}
        >
          <Plus size={18} />
          Nueva sesión
        </Button>
      </div>
      {saved && (
        <p role="status" className="notice">
          Cambios guardados en la base de datos.
        </p>
      )}
      {editor === 'class' && (
        <ClassEditor
          key={`class-${currentClass?.id ?? 'new'}`}
          data={data}
          current={currentClass}
          onSaved={refresh}
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
      {roster && (
        <AttendanceRoster
          key={`roster-${roster.id}`}
          session={roster}
          onClose={() => setRosterId(undefined)}
        />
      )}
      <section aria-label="Gestión del catálogo">
        <div className="admin-section-heading">
          <div className="admin-actions">
            <button
              type="button"
              className={`chip ${tab === 'sessions' ? 'selected' : ''}`}
              aria-pressed={tab === 'sessions'}
              onClick={() => setTab('sessions')}
            >
              Sesiones e inscritos
            </button>
            <button
              type="button"
              className={`chip ${tab === 'classes' ? 'selected' : ''}`}
              aria-pressed={tab === 'classes'}
              onClick={() => setTab('classes')}
            >
              Clases generales
            </button>
          </div>
          {tab === 'sessions' && (
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
                  onClick={() => setPeriod(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <label className="admin-search">
            Buscar en administración
            <input value={filter} onChange={(e) => setFilter(e.target.value)} type="search" />
          </label>
        </div>
        <div className="admin-list">
          {tab === 'sessions'
            ? data.sessions
                .filter((s) => {
                  if (period === 'all') return true;
                  const isUpcoming = new Date(s.starts_at).getTime() > Date.now();
                  return period === 'upcoming' ? isUpcoming : !isUpcoming;
                })
                // Las próximas, de la más cercana a la más lejana; las pasadas, de la más reciente.
                .sort((a, b) =>
                  period === 'upcoming'
                    ? a.starts_at.localeCompare(b.starts_at)
                    : b.starts_at.localeCompare(a.starts_at),
                )
                .filter((s) =>
                  `${s.name} ${s.instructor} ${s.location}`
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((s) => (
                  <article key={s.id} className="panel admin-session">
                    <div>
                      <span className={`badge ${s.published ? 'available' : 'full'}`}>
                        {s.published ? 'Publicada' : 'Borrador'}
                      </span>
                      <h2>{s.name}</h2>
                      <p>
                        {new Date(s.starts_at).toLocaleString('es-PE', {
                          timeZone: 'America/Lima',
                        })}{' '}
                        · {s.duration_minutes} min
                      </p>
                      <p>
                        {s.instructor} · {s.room}
                      </p>
                      <p>
                        <strong className="yellow">
                          {s.reserved}/{s.capacity}
                        </strong>{' '}
                        reservas activas · {s.capacity - s.reserved} cupos
                      </p>
                    </div>
                    <div className="admin-actions">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setRosterId(s.id);
                          setEditor(null);
                        }}
                      >
                        <Users size={16} />
                        Ver inscritos
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={new Date(s.starts_at).getTime() <= Date.now()}
                        onClick={() => {
                          setCurrentSession(s);
                          setEditor('session');
                          setSaved(false);
                        }}
                      >
                        <Pencil size={16} />
                        Editar sesión
                      </Button>
                    </div>
                  </article>
                ))
            : data.classes
                .filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
                .map((c) => (
                  <article key={c.id} className="panel admin-session">
                    <div>
                      <h2>{c.name}</h2>
                      <p>{data.disciplines.find((d) => d.id === c.discipline_id)?.name}</p>
                      <p>{c.description}</p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setCurrentClass(c);
                        setEditor('class');
                        setSaved(false);
                      }}
                    >
                      <Pencil size={16} />
                      Editar clase
                    </Button>
                  </article>
                ))}
        </div>
      </section>
      <CreatePasswordForm key={user?.id} />
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
        <p className="eyebrow yellow">TITAN GYM · Gestión</p>
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
