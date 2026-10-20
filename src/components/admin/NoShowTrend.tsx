import { useState } from 'react';
import type { WeekPoint } from '../../features/admin/insights';
import { formatPercent } from '../../features/admin/indicators';

const W = 640;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 34, left: 40 };
const BAR_MAX = 24;

const weekLabel = (week: string) =>
  new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${week}T12:00:00Z`))
    .replace('.', '');

/** Barra con el extremo de datos redondeado (4 px) y la base recta sobre el eje. */
function barPath(x: number, y: number, width: number, height: number) {
  const r = Math.min(4, height, width / 2);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/** Evolución semanal de la tasa de no-shows (una sola serie: el título la nombra). */
export function NoShowTrend({ weeks }: { weeks: WeekPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const points = weeks.filter((w) => w.rate !== null);
  if (points.length < 2)
    return (
      <p className="notice">
        El gráfico aparece cuando hay al menos dos semanas con asistencia registrada.
      </p>
    );

  const maxRate = Math.max(...points.map((p) => p.rate ?? 0));
  const top = Math.max(0.2, Math.ceil(maxRate * 10) / 10); // escala en múltiplos de 10 %
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / points.length;
  const barW = Math.min(BAR_MAX, band * 0.6);
  const y = (rate: number) => PAD.top + plotH - (rate / top) * plotH;
  const ticks = [0, top / 2, top];
  const labelEvery = points.length > 10 ? 2 : 1;
  const last = points.length - 1;
  const current = active === null ? null : points[active];

  return (
    <figure className="noshow-trend">
      <figcaption>
        <strong>No-shows por semana</strong>
        <span>Ausentes sin cancelar sobre las asistencias registradas de cada semana.</span>
      </figcaption>
      <div className="noshow-trend-plot" onMouseLeave={() => setActive(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Gráfico de barras de la tasa semanal de no-shows. Los datos están en la tabla siguiente."
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
              <text
                x={PAD.left - 8}
                y={y(t)}
                className="axis"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {Math.round(t * 100)} %
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = PAD.left + band * i + (band - barW) / 2;
            const rate = p.rate ?? 0;
            const h = Math.max(1, PAD.top + plotH - y(rate));
            return (
              <g
                key={p.week}
                tabIndex={0}
                className={active === i ? 'bar-group active' : 'bar-group'}
                aria-label={`Semana del ${weekLabel(p.week)}: ${formatPercent(p.rate)} de no-shows, ${p.absent} de ${p.registered}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                {/* Zona de interacción más grande que la barra. */}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  className="hit"
                />
                <path d={barPath(x, PAD.top + plotH - h, barW, h)} className="bar-mark" />
                {i % labelEvery === 0 && (
                  <text
                    x={x + barW / 2}
                    y={H - PAD.bottom + 18}
                    className="axis"
                    textAnchor="middle"
                  >
                    {weekLabel(p.week)}
                  </text>
                )}
                {i === last && (
                  <text
                    x={x + barW / 2}
                    y={PAD.top + plotH - h - 6}
                    className="value"
                    textAnchor="middle"
                  >
                    {formatPercent(p.rate)}
                  </text>
                )}
              </g>
            );
          })}
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + plotH}
            y2={PAD.top + plotH}
            className="baseline"
          />
        </svg>
        {current && active !== null && (
          <div
            className="noshow-tooltip"
            role="status"
            style={{ left: `${((PAD.left + band * active + band / 2) / W) * 100}%` }}
          >
            <strong>Semana del {weekLabel(current.week)}</strong>
            <span>
              {formatPercent(current.rate)} de no-shows · {current.absent} de {current.registered}
            </span>
          </div>
        )}
      </div>
      <details className="noshow-table">
        <summary>Ver los datos en una tabla</summary>
        <div className="table-scroll">
          <table className="indicator-table">
            <thead>
              <tr>
                <th scope="col">Semana</th>
                <th scope="col">Registradas</th>
                <th scope="col">Ausentes</th>
                <th scope="col">No-shows</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.week}>
                  <th scope="row">{weekLabel(p.week)}</th>
                  <td>{p.registered}</td>
                  <td>{p.absent}</td>
                  <td>{formatPercent(p.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
