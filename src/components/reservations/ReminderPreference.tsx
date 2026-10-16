import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { getEmailReminders, setEmailReminders } from '../../features/preferences/api';
import { errorMessage } from '../../lib/errors';

export function ReminderPreference() {
  const { user } = useAuth();
  const cache = useQueryClient();
  // La clave empieza por 'reservations' para descartarse al cambiar de cuenta.
  const key = ['reservations', 'preferences', user?.id];
  const query = useQuery({ queryKey: key, queryFn: getEmailReminders, enabled: Boolean(user) });
  // Cambio optimista: el interruptor responde al instante y vuelve atrás si falla el guardado.
  const [pending, setPending] = useState<boolean | null>(null);
  const mutation = useMutation({
    mutationFn: setEmailReminders,
    onSuccess: (_, enabled) => cache.setQueryData(key, enabled),
    onSettled: () => setPending(null),
  });
  if (!query.isSuccess) return null;
  const enabled = pending ?? query.data;

  return (
    <section
      className="panel reminder-preference"
      aria-labelledby="reminder-title"
      id="recordatorios"
    >
      <BellRing aria-hidden="true" />
      <div>
        <h2 id="reminder-title">Recordatorio por correo</h2>
        <p>Te escribimos 3 horas antes de cada clase con tu QR, por si necesitas cancelar.</p>
        {mutation.isError && (
          <p role="alert" className="field-error">
            {errorMessage(mutation.error)}
          </p>
        )}
      </div>
      <label className="switch">
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={mutation.isPending}
          onChange={(e) => {
            setPending(e.target.checked);
            mutation.mutate(e.target.checked);
          }}
        />
        <span aria-hidden="true" />
        <span className="sr-only">Recibir recordatorios por correo</span>
      </label>
    </section>
  );
}
