export function AvailabilityBadge({ available, capacity }: { available: number; capacity: number }) {
  const full = available <= 0;
  const low = available > 0 && available / capacity <= .2;
  return <span className={`badge ${full ? 'full' : low ? 'low' : 'available'}`}><span className="dot"/>{full ? 'Clase completa' : low ? 'Últimos cupos' : 'Cupos disponibles'}</span>;
}
