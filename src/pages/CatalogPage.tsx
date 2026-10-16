import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useSessions } from '../features/classes/queries';
import { filterSessions, dateKey, dayLabel, formatShortDate } from '../utils/sessions';
import { ClassCard } from '../components/classes/ClassCard';
import { LoadingState, ErrorState, EmptyState } from '../components/ui/States';
import { Button } from '../components/ui/Button';
export default function CatalogPage() {
  const query = useSessions();
  const [search, setSearch] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [date, setDate] = useState('');
  const [availability, setAvailability] = useState('');
  const sessions = query.data ?? [];
  const filtered = filterSessions(sessions, search, discipline, date, availability);
  const dates = [...new Set(sessions.map((s) => dateKey(s.starts_at)))].slice(0, 7);
  // Las disciplinas salen de la agenda real: no se ofrecen filtros que no devuelven nada.
  const disciplines = [...new Set(sessions.map((s) => s.discipline))].sort((a, b) =>
    a.localeCompare(b),
  );
  const filtering = Boolean(search || discipline || date || availability);
  function reset() {
    setSearch('');
    setDiscipline('');
    setDate('');
    setAvailability('');
  }
  return (
    <div className="container page">
      <div className="section-heading page-heading">
        <div>
          <p className="eyebrow yellow">Agenda de clases</p>
          <h1>Horarios y clases disponibles</h1>
          <p>Elige una sesión, revisa los cupos y reserva tu lugar en TITAN GYM.</p>
        </div>
        {query.isSuccess && (
          <div className="catalog-metric">
            <small>Sede activa</small>
            <strong>
              {new Set(sessions.map((s) => s.location)).size}{' '}
              {new Set(sessions.map((s) => s.location)).size === 1 ? 'sede' : 'sedes'}
            </strong>
          </div>
        )}
      </div>
      <section className="filters" aria-label="Filtros de clases">
        <div className="filter-row">
          <label className="search">
            <Search size={18} />
            <span className="sr-only">Buscar clases</span>
            <input
              type="search"
              placeholder="Buscar por clase, disciplina o instructor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="select-field">
            <span className="sr-only">Disponibilidad</span>
            <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="available">Con cupos disponibles</option>
              <option value="full">Clase completa</option>
            </select>
          </label>
          <label className="select-field">
            <span className="sr-only">Fecha de la sesión</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="discipline-filters">
          <span className="eyebrow">
            <SlidersHorizontal size={14} />
            Disciplina
          </span>
          {['', ...disciplines].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={discipline === d}
              className={discipline === d ? 'chip selected' : 'chip'}
              onClick={() => setDiscipline(d)}
            >
              {d || 'Todas'}
            </button>
          ))}
        </div>
        {dates.length > 0 && (
          <div className="date-tabs" aria-label="Fechas disponibles">
            {dates.map((d) => {
              const value = `${d}T12:00:00-05:00`;
              return (
                <button
                  key={d}
                  type="button"
                  className={date === d ? 'date-tab selected' : 'date-tab'}
                  aria-pressed={date === d}
                  onClick={() => setDate(date === d ? '' : d)}
                >
                  <span>{dayLabel(value)}</span>
                  <strong>{formatShortDate(value)}</strong>
                </button>
              );
            })}
          </div>
        )}
        {filtering && (
          <Button variant="secondary" onClick={reset}>
            Limpiar filtros
          </Button>
        )}
      </section>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p className="results-count" role="status">
            {filtered.length} {filtered.length === 1 ? 'sesión' : 'sesiones'}
            {filtering ? ` de ${sessions.length} con los filtros aplicados` : ' programadas'}
          </p>
          {filtered.length ? (
            <div className="class-grid">
              {filtered.map((s) => (
                <ClassCard key={s.id} session={s} />
              ))}
            </div>
          ) : sessions.length ? (
            <EmptyState />
          ) : (
            <EmptyState
              title="No hay sesiones programadas"
              message="La administración todavía no publica nuevos horarios. Vuelve a consultar más tarde."
            />
          )}
          <p className="catalog-note">
            Los cupos se actualizan cada 15 segundos. El lugar se asegura al confirmar la reserva.
          </p>
        </>
      )}
    </div>
  );
}
