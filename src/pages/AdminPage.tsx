import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldCheck, Plus, CalendarDays, Users, Pencil } from 'lucide-react';
import { useAuth } from '../app/AuthProvider';
import { useAdminRole } from '../features/admin/queries';
import { getAdminSnapshot, type ManagedClass, type ManagedSession } from '../features/admin/api';
import { ClassEditor, SessionEditor } from '../components/admin/AdminForms';
import { AttendanceRoster } from '../components/admin/AttendanceRoster';
import { PasswordSignInForm } from '../components/reservations/PasswordSignInForm';
import { CreatePasswordForm } from '../components/reservations/CreatePasswordForm';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { Button } from '../components/ui/Button';

function AdminDashboard() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'snapshot', user?.id], queryFn: getAdminSnapshot, refetchInterval: 30000 });
  const [editor, setEditor] = useState<'class' | 'session' | null>(null);
  const [currentClass, setCurrentClass] = useState<ManagedClass>();
  const [currentSession, setCurrentSession] = useState<ManagedSession>();
  const [rosterId, setRosterId] = useState<string>();
  const [tab, setTab] = useState<'sessions' | 'classes'>('sessions');
  const [filter, setFilter] = useState('');
  const [saved, setSaved] = useState(false);
  const refresh = () => { setEditor(null); setSaved(true); void cache.invalidateQueries({ queryKey: ['admin'] }); void cache.invalidateQueries({ queryKey: ['sessions'] }); void cache.invalidateQueries({ queryKey: ['session'] }); };
  if (query.isPending) return <LoadingState/>;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()}/>;
  const data = query.data;
  const roster = data.sessions.find(s => s.id === rosterId);
  return <><div className="admin-metrics"><div className="panel"><CalendarDays/><strong>{data.sessions.length}</strong><span>Sesiones programadas e históricas</span></div><div className="panel"><Users/><strong>{data.sessions.reduce((n, s) => n + s.reserved, 0)}</strong><span>Reservas activas</span></div><div className="panel"><ShieldCheck/><strong>{data.classes.length}</strong><span>Clases generales</span></div></div>
    <div className="admin-actions"><Button onClick={() => { setEditor('class'); setCurrentClass(undefined); setSaved(false); }}><Plus size={18}/>Nueva clase</Button><Button variant="secondary" onClick={() => { setEditor('session'); setCurrentSession(undefined); setSaved(false); }}><Plus size={18}/>Nueva sesión</Button></div>
    {saved && <p role="status" className="notice">Cambios guardados en la base de datos.</p>}
    {editor === 'class' && <ClassEditor key={`class-${currentClass?.id ?? 'new'}`} data={data} current={currentClass} onSaved={refresh} onCancel={() => setEditor(null)}/>}
    {editor === 'session' && <SessionEditor key={`session-${currentSession?.id ?? 'new'}`} data={data} current={currentSession} onSaved={refresh} onCancel={() => setEditor(null)}/>}
    {roster && <AttendanceRoster key={`roster-${roster.id}`} session={roster} onClose={() => setRosterId(undefined)}/>}
    <section aria-label="Gestión del catálogo"><div className="admin-section-heading"><div className="admin-actions"><button type="button" className={`chip ${tab === 'sessions' ? 'selected' : ''}`} aria-pressed={tab === 'sessions'} onClick={() => setTab('sessions')}>Sesiones e inscritos</button><button type="button" className={`chip ${tab === 'classes' ? 'selected' : ''}`} aria-pressed={tab === 'classes'} onClick={() => setTab('classes')}>Clases generales</button></div><label className="admin-search">Buscar en administración<input value={filter} onChange={e => setFilter(e.target.value)} type="search"/></label></div>
    <div className="admin-list">{tab === 'sessions' ? data.sessions.filter(s => `${s.name} ${s.instructor} ${s.location}`.toLowerCase().includes(filter.toLowerCase())).map(s => <article key={s.id} className="panel admin-session"><div><span className={`badge ${s.published ? 'available' : 'full'}`}>{s.published ? 'Publicada' : 'Borrador'}</span><h2>{s.name}</h2><p>{new Date(s.starts_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })} · {s.duration_minutes} min</p><p>{s.instructor} · {s.location} · {s.room}</p><p><strong className="yellow">{s.reserved}/{s.capacity}</strong> reservas activas · {s.capacity - s.reserved} cupos</p></div><div className="admin-actions"><Button variant="secondary" onClick={() => { setRosterId(s.id); setEditor(null); }}><Users size={16}/>Ver inscritos</Button><Button variant="secondary" disabled={new Date(s.starts_at).getTime() <= Date.now()} onClick={() => { setCurrentSession(s); setEditor('session'); setSaved(false); }}><Pencil size={16}/>Editar sesión</Button></div></article>) : data.classes.filter(c => c.name.toLowerCase().includes(filter.toLowerCase())).map(c => <article key={c.id} className="panel admin-session"><div><h2>{c.name}</h2><p>{data.disciplines.find(d => d.id === c.discipline_id)?.name}</p><p>{c.description}</p></div><Button variant="secondary" onClick={() => { setCurrentClass(c); setEditor('class'); setSaved(false); }}><Pencil size={16}/>Editar clase</Button></article>)}</div>
    </section><CreatePasswordForm key={user?.id}/></>;
}
export default function AdminPage() {
  const { user, loading } = useAuth();
  const role = useAdminRole();
  const [, setBusy] = useState(false);
  return <div className="container page admin-page"><div className="page-heading"><p className="eyebrow yellow">TITAN GYM · Gestión</p><h1>Administración</h1><p>Gestiona clases, sesiones, alumnos inscritos y asistencia.</p></div>{loading ? <LoadingState/> : !user ? <section className="panel narrow" aria-label="Acceso administrativo"><ShieldCheck className="yellow"/><h2>Acceso de administradores</h2><p>Ingresa con tu correo y contraseña. Solo las cuentas autorizadas pueden acceder al panel.</p><PasswordSignInForm blocked={false} onBusy={setBusy}/><p>Si todavía no tienes contraseña, entra a tu cuenta de socio y configúrala. El responsable del proyecto debe asignarte el rol.</p><Link className="yellow" to="/mis-reservas">Ir al acceso de socios</Link></section> : role.isPending ? <LoadingState/> : role.isError ? <ErrorState error={role.error} retry={() => void role.refetch()}/> : !role.data ? <EmptyState title="Acceso restringido" message="Tu cuenta no tiene permisos de administrador. Puedes continuar usando el catálogo y tus reservas." action/> : <AdminDashboard key={user.id}/>}</div>;
}
