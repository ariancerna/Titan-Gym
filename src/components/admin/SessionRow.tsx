import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Pencil, Users } from 'lucide-react';
import { cancelSession, type ManagedSession } from '../../features/admin/api';
import { errorMessage } from '../../lib/errors';
import { formatTime } from '../../utils/sessions';
import { Button } from '../ui/Button';

/** Fila compacta de una sesión en la agenda del panel. */
export function SessionRow({
  session: s,
  onRoster,
  onEdit,
}: {
  session: ManagedSession;
  onRoster: () => void;
  onEdit: () => void;
}) {
  const cache = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const started = new Date(s.starts_at).getTime() <= Date.now();
  const cancelled = Boolean(s.cancelled_at);
  const end = new Date(new Date(s.starts_at).getTime() + s.duration_minutes * 60000).toISOString();
  const percent = Math.min(100, Math.round((s.reserved / s.capacity) * 100));
  const full = s.reserved >= s.capacity;

  const mutation = useMutation({
    mutationFn: () => cancelSession(s.id, reason.trim()),
    onSuccess: async () => {
      setCancelling(false);
      await cache.invalidateQueries({ queryKey: ['admin'] });
      await cache.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  return (
    <article className={`admin-session${cancelled ? ' is-cancelled' : ''}`}>
      <div className="admin-session-time">
        <strong>
          {formatTime(s.starts_at)}–{formatTime(end)}
        </strong>
        <small>{s.duration_minutes} min</small>
      </div>
      <div className="admin-session-main">
        <h4>{s.name}</h4>
        <p>
          {s.instructor} · {s.room}
        </p>
        <div className="admin-session-tags">
          {cancelled && <span className="badge full">Cancelada</span>}
          {!cancelled && !s.published && <span className="badge low">Borrador</span>}
          {!cancelled && full && !started && <span className="badge full">Llena</span>}
          {s.waiting > 0 && !cancelled && (
            <span className="badge waiting">{s.waiting} en espera</span>
          )}
        </div>
        {cancelled && s.cancel_reason && (
          <p className="admin-session-reason">Motivo: {s.cancel_reason}</p>
        )}
      </div>
      <div className="admin-session-occupancy">
        <div
          className={`bar ${full ? 'bar-full' : percent >= 80 ? 'bar-low' : ''}`}
          role="img"
          aria-label={`Ocupación ${percent} %`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <p>
          <strong>
            {s.reserved}/{s.capacity}
          </strong>{' '}
          reservas activas
          {started && !cancelled && <> · {s.present} presentes</>}
        </p>
      </div>
      <div className="admin-actions">
        <Button variant="secondary" onClick={onRoster}>
          <Users size={16} />
          Ver inscritos
        </Button>
        <Button variant="secondary" disabled={started || cancelled} onClick={onEdit}>
          <Pencil size={16} />
          Editar sesión
        </Button>
        {!started && !cancelled && !cancelling && (
          <Button variant="ghost" onClick={() => setCancelling(true)}>
            <Ban size={16} />
            Cancelar sesión
          </Button>
        )}
      </div>
      {cancelling && (
        <form
          className="admin-cancel-form"
          aria-label={`Cancelar ${s.name}`}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length < 3)
              return setReasonError('Escribe el motivo; se enviará a los inscritos.');
            setReasonError('');
            mutation.mutate();
          }}
        >
          <p>
            Se cancelarán <strong>{s.reserved}</strong> reservas
            {s.waiting > 0 && <> y se cerrará la lista de espera ({s.waiting})</>}. Cada inscrito
            recibirá un correo con el motivo.
          </p>
          <div className="field">
            <label htmlFor={`cancel-reason-${s.id}`}>Motivo de la cancelación</label>
            <input
              id={`cancel-reason-${s.id}`}
              value={reason}
              maxLength={200}
              placeholder="Ej. el instructor está enfermo"
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError('');
              }}
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? `cancel-reason-error-${s.id}` : undefined}
            />
            {reasonError && (
              <p id={`cancel-reason-error-${s.id}`} role="alert" className="field-error">
                {reasonError}
              </p>
            )}
          </div>
          {mutation.isError && (
            <p role="alert" className="field-error">
              {errorMessage(mutation.error)}
            </p>
          )}
          <div className="admin-actions">
            <Button variant="danger" disabled={mutation.isPending}>
              {mutation.isPending ? 'Cancelando…' : 'Confirmar cancelación'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => {
                setCancelling(false);
                setReason('');
                setReasonError('');
                mutation.reset();
              }}
            >
              Volver
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
