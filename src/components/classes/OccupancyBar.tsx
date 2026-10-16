import { occupancy } from '../../utils/sessions';
export function OccupancyBar({ capacity, reserved }: { capacity: number; reserved: number }) {
  const percent = occupancy({ capacity, reserved });
  const available = Math.max(0, capacity - reserved);
  return (
    <div className="occupancy">
      <div className="occupancy-label">
        <span>
          Ocupación: {reserved} / {capacity} ({percent}%)
        </span>
        <strong>{available} cupos libres</strong>
      </div>
      <div
        role="progressbar"
        aria-label="Ocupación de la clase"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`bar ${available === 0 ? 'bar-full' : percent >= 80 ? 'bar-low' : ''}`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
