import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { getDataset } from '../../features/admin/api';
import { datasetToCsv, formatPercent, summarizeAttendance } from '../../features/admin/indicators';
import { dateKey } from '../../utils/sessions';
import { ErrorState, LoadingState } from '../ui/States';
import { Button } from '../ui/Button';

function downloadCsv(content: string, fileName: string) {
  // BOM para que Excel respete las tildes al abrir el archivo.
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function AttendanceIndicators() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['admin', 'dataset', user?.id], queryFn: getDataset });

  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;

  const rows = query.data;
  const summary = summarizeAttendance(rows);
  const registered = summary.presentes + summary.ausentes;

  return (
    <section className="panel admin-indicators" aria-labelledby="indicators-title">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow accent">Indicador del proyecto</p>
          <h2 id="indicators-title">Asistencia e inasistencias</h2>
          <p>Calculado sobre las sesiones que ya comenzaron.</p>
        </div>
        <Button
          variant="secondary"
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(datasetToCsv(rows), `fitsmart-dataset-${dateKey(new Date())}.csv`)
          }
        >
          <Download size={16} />
          Exportar dataset CSV
        </Button>
      </div>

      <dl className="indicator-grid">
        <div className="indicator indicator-main">
          <dt>Tasa de no-shows</dt>
          <dd>{formatPercent(summary.tasaNoShow)}</dd>
          <small>
            {summary.ausentes} de {registered} asistencias registradas
          </small>
        </div>
        <div className="indicator">
          <dt>Presentes</dt>
          <dd>{summary.presentes}</dd>
        </div>
        <div className="indicator">
          <dt>Cancelaciones con aviso</dt>
          <dd>{summary.canceladas}</dd>
        </div>
        <div className="indicator">
          <dt>Asistencia registrada</dt>
          <dd>{formatPercent(summary.cobertura)}</dd>
          <small>{summary.sinRegistrar} reservas sin registrar</small>
        </div>
      </dl>

      {summary.sinRegistrar > 0 && (
        <p className="notice">
          Hay {summary.sinRegistrar} reservas de clases pasadas sin asistencia registrada. Esas
          filas no sirven para entrenar el modelo: regístralas en «Ver inscritos».
        </p>
      )}

      {summary.conRecordatorio !== null && (
        <p className="indicator-compare">
          No-shows con recordatorio por correo:{' '}
          <strong>{formatPercent(summary.conRecordatorio)}</strong>
          {' · '}sin recordatorio: <strong>{formatPercent(summary.sinRecordatorio)}</strong>
        </p>
      )}

      {summary.porClase.length > 0 && (
        <div className="table-scroll">
          <table className="indicator-table">
            <caption className="sr-only">No-shows por clase</caption>
            <thead>
              <tr>
                <th scope="col">Clase</th>
                <th scope="col">Registradas</th>
                <th scope="col">Ausentes</th>
                <th scope="col">No-shows</th>
              </tr>
            </thead>
            <tbody>
              {summary.porClase.map((c) => (
                <tr key={c.clase}>
                  <th scope="row">{c.clase}</th>
                  <td>{c.registradas}</td>
                  <td>{c.ausentes}</td>
                  <td>{formatPercent(c.tasaNoShow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
