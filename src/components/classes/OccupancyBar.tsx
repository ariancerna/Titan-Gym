import type { CSSProperties } from 'react';
import { occupancy } from '../../utils/sessions';

/** Barra dividida en un segmento por cupo (hasta 40): se lee como "lugares", no como porcentaje. */
export function OccupancyBar({ capacity, reserved }: { capacity: number; reserved: number }) {
  const percent = occupancy({ capacity, reserved });
  const available = Math.max(0, capacity - reserved);
  const state = available === 0 ? 'bar-full' : percent >= 80 ? 'bar-low' : '';
  return (
    <div className="occupancy">
      <div className="occupancy-label">
        <span>
          {reserved} de {capacity} reservados
        </span>
        <strong>{available} cupos libres</strong>
      </div>
      <div
        role="progressbar"
        aria-label="Ocupación de la clase"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`bar ${state}`}
        style={{ '--segments': Math.min(capacity, 40) } as CSSProperties}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
