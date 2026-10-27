import { useEffect, useState } from 'react';

/** Hora actual que se renueva cada `intervalMs`. Para cuentas regresivas y etiquetas "en vivo". */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
