import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { getDataset } from '../../features/admin/api';
import { datasetToCsv, formatPercent, summarizeAttendance } from '../../features/admin/indicators';
import { dateKey } from '../../utils/sessions';
import { weeklyNoShows } from '../../features/admin/insights';
import { riskBacktest } from '../../features/admin/risk';
import { NoShowTrend } from './NoShowTrend';
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
  const backtest = riskBacktest(rows);
  const [low, , high] = backtest;

  return (
    <section className="panel admin-indicators" aria-labelledby="indicators-title">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow accent">Asistencia</p>
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

      <NoShowTrend weeks={weeklyNoShows(rows)} />

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

      {registered > 0 && (
        <section className="risk-backtest" aria-labelledby="risk-backtest-title">
          <h3 id="risk-backtest-title">¿Acierta el riesgo de no-show?</h3>
          <p>
            La regla que se muestra en «Ver inscritos», aplicada a las clases ya dictadas con los
            datos que había antes de cada una. Si funciona, el riesgo alto falta más que el bajo.
          </p>
          <div className="table-scroll">
            <table className="indicator-table">
              <thead>
                <tr>
                  <th scope="col">Riesgo estimado</th>
                  <th scope="col">Registradas</th>
                  <th scope="col">Ausentes</th>
                  <th scope="col">No-shows reales</th>
                </tr>
              </thead>
              <tbody>
                {backtest.map((b) => (
                  <tr key={b.level}>
                    <th scope="row">{b.level[0].toUpperCase() + b.level.slice(1)}</th>
                    <td>{b.registered}</td>
                    <td>{b.absent}</td>
                    <td>{formatPercent(b.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {low.rate !== null && high.rate !== null && (
            <p className="indicator-compare">
              {high.rate > low.rate ? (
                <>
                  Los socios con riesgo alto faltaron{' '}
                  <strong>
                    {(high.rate / Math.max(low.rate, 0.001)).toLocaleString('es-PE', {
                      maximumFractionDigits: 1,
                    })}{' '}
                    veces más
                  </strong>{' '}
                  que los de riesgo bajo.
                </>
              ) : (
                <>Con estos datos, la regla todavía no distingue a quienes faltan.</>
              )}
            </p>
          )}
        </section>
      )}
    </section>
  );
}
