import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Power, Send } from 'lucide-react';
import {
  getModelStatus,
  getPredictionLog,
  predictOnServer,
  setModelActive,
  type PredictionInput,
  type ServerPrediction,
} from '../../features/admin/api';
import { useAuth } from '../../app/AuthProvider';
import { errorMessage } from '../../lib/errors';
import { formatDate, formatTime } from '../../utils/sessions';
import { limaHour } from '../../features/admin/risk';
import { limaWeekday } from '../../features/admin/noshowModel';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const riskBadge = { bajo: 'available', medio: 'low', alto: 'risk-high' } as const;
const DISCIPLINES = ['Cross Training', 'Funcional', 'HIIT', 'Spinning', 'Yoga', 'Zumba'];

/** Mañana a las 7:00 en el formato de <input type="datetime-local">. */
function tomorrowAtSeven() {
  const d = new Date(Date.now() + 86400000);
  d.setHours(7, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T07:00`;
}

interface FormState {
  disciplina: string;
  inicio: string;
  duracion_min: string;
  capacidad: string;
  reservas_activas: string;
  anticipacion_horas: string;
  reservas_previas: string;
  inasistencias_previas: string;
  recordatorio: 'si' | 'no' | 'desconocido';
}

const initialForm = (): FormState => ({
  disciplina: 'Funcional',
  inicio: tomorrowAtSeven(),
  duracion_min: '60',
  capacidad: '18',
  reservas_activas: '5',
  anticipacion_horas: '96',
  reservas_previas: '6',
  inasistencias_previas: '3',
  recordatorio: 'no',
});

/** Texto vacío → null para que el servidor lo rechace con su propio mensaje (no se valida aquí). */
const num = (value: string) => (value.trim() === '' ? null : Number(value));

function toInput(f: FormState): PredictionInput {
  // El gimnasio opera en Lima (UTC−5 todo el año): la hora ingresada se interpreta en Lima, no en la
  // zona horaria del navegador.
  const iso = f.inicio ? new Date(`${f.inicio}:00-05:00`).toISOString() : '';
  return {
    disciplina: f.disciplina,
    inicio_sesion: iso,
    dia_semana: iso ? limaWeekday(iso) : (null as unknown as number),
    hora_inicio: iso ? limaHour(iso) : (null as unknown as number),
    duracion_min: num(f.duracion_min) as number,
    capacidad: num(f.capacidad) as number,
    reservas_activas: num(f.reservas_activas) as number,
    anticipacion_horas: num(f.anticipacion_horas) as number,
    reservas_previas: num(f.reservas_previas) as number,
    inasistencias_previas: num(f.inasistencias_previas) as number,
    recordatorio_enviado: f.recordatorio === 'desconocido' ? null : f.recordatorio === 'si',
  };
}

function Result({ result }: { result: ServerPrediction }) {
  return (
    <div className="prediction-result" role="status">
      <p className="admin-risk">
        <span className={`badge ${riskBadge[result.riesgo]}`}>Riesgo {result.riesgo}</span>
        <strong>
          {Math.round(result.probabilidad_no_show * 100)} % de probabilidad de no-show
        </strong>
      </p>
      <p>
        <strong>Qué hacer:</strong> {result.accion_sugerida}
      </p>
      <p className="admin-roster-muted">
        Calculado en el servidor con el modelo {result.modelo_version} · predicción n.°{' '}
        {result.prediccion_id} registrada el {formatDate(result.fecha)}, {formatTime(result.fecha)}.
        Umbrales: medio desde {Math.round(result.umbral_contacto * 100)} %, alto desde{' '}
        {Math.round(result.umbral_alto * 100)} %.
      </p>
    </div>
  );
}

/**
 * Indicadores → Servicio de predicción. Muestra el estado del modelo servido por Supabase, permite
 * probar una predicción (caso nuevo o dato inválido), desactivarlo para comprobar la degradación
 * controlada y consultar el registro de las últimas predicciones.
 */
export function PredictionService() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [form, setForm] = useState<FormState>(initialForm);
  const status = useQuery({
    queryKey: ['admin', 'model-status', user?.id],
    queryFn: getModelStatus,
    refetchInterval: 30000,
  });
  const log = useQuery({
    queryKey: ['admin', 'prediction-log', user?.id],
    queryFn: () => getPredictionLog(10),
    refetchInterval: 30000,
  });
  const refreshAll = () => {
    void cache.invalidateQueries({ queryKey: ['admin', 'model-status'] });
    void cache.invalidateQueries({ queryKey: ['admin', 'prediction-log'] });
    void cache.invalidateQueries({ queryKey: ['admin', 'roster-risk'] });
  };
  const predict = useMutation({ mutationFn: predictOnServer, onSettled: refreshAll });
  const toggle = useMutation({ mutationFn: setModelActive, onSettled: refreshAll });
  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    predict.mutate(toInput(form));
  };
  const active = status.data?.activo ?? false;

  return (
    <section className="panel prediction-service" aria-labelledby="prediction-title">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow accent">Modelo de Machine Learning</p>
          <h2 id="prediction-title">Servicio de predicción</h2>
          <p>
            El riesgo de no-show se calcula en el servidor (Supabase) y cada predicción queda
            registrada con su entrada, resultado, versión del modelo y fecha.
          </p>
        </div>
      </div>

      {status.isError ? (
        <p role="alert" className="field-error">
          {errorMessage(status.error)}
        </p>
      ) : status.data ? (
        <div className="prediction-status">
          <p>
            <Activity size={16} aria-hidden="true" />{' '}
            <span className={`badge ${active ? 'available' : 'risk-high'}`}>
              {active ? 'Activo' : 'Desactivado'}
            </span>{' '}
            Modelo <strong>{status.data.version}</strong> · {status.data.modelo}
          </p>
          <p className="admin-roster-muted">
            {status.data.predicciones_registradas} predicciones registradas
            {status.data.ultima_prediccion &&
              ` · la última el ${formatDate(status.data.ultima_prediccion)}, ${formatTime(status.data.ultima_prediccion)}`}
            .{' '}
            {active
              ? 'Si se desactiva, «Ver inscritos» muestra el riesgo por reglas (respaldo) y lo avisa.'
              : '«Ver inscritos» está usando la regla de respaldo hasta que se reactive.'}
          </p>
          <Button
            variant="secondary"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(!active)}
          >
            <Power size={16} aria-hidden="true" />
            {active ? 'Desactivar modelo (prueba de degradación)' : 'Reactivar modelo'}
          </Button>
          {toggle.isError && (
            <p role="alert" className="field-error">
              {errorMessage(toggle.error)}
            </p>
          )}
        </div>
      ) : null}

      <form className="prediction-form" onSubmit={submit} noValidate>
        <h3>Probar una predicción</h3>
        <p className="admin-roster-muted">
          Ingresa una reserva como la registraría el MVP. Los datos los valida el servidor: un valor
          fuera de rango se rechaza con un mensaje y no se registra como predicción.
        </p>
        <div className="admin-form-grid">
          <label className="admin-select">
            Disciplina
            <select value={form.disciplina} onChange={(e) => set('disciplina')(e.target.value)}>
              {DISCIPLINES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <Input
            id="pred-inicio"
            label="Inicio de la clase"
            type="datetime-local"
            value={form.inicio}
            onChange={(e) => set('inicio')(e.target.value)}
          />
          <Input
            id="pred-duracion"
            label="Duración (min)"
            type="number"
            value={form.duracion_min}
            onChange={(e) => set('duracion_min')(e.target.value)}
          />
          <Input
            id="pred-capacidad"
            label="Aforo"
            type="number"
            value={form.capacidad}
            onChange={(e) => set('capacidad')(e.target.value)}
          />
          <Input
            id="pred-activas"
            label="Reservas activas en la clase"
            type="number"
            value={form.reservas_activas}
            onChange={(e) => set('reservas_activas')(e.target.value)}
          />
          <Input
            id="pred-anticipacion"
            label="Anticipación de la reserva (horas)"
            type="number"
            value={form.anticipacion_horas}
            onChange={(e) => set('anticipacion_horas')(e.target.value)}
          />
          <Input
            id="pred-previas"
            label="Reservas anteriores del socio"
            type="number"
            value={form.reservas_previas}
            onChange={(e) => set('reservas_previas')(e.target.value)}
          />
          <Input
            id="pred-faltas"
            label="Faltas sin avisar anteriores"
            type="number"
            value={form.inasistencias_previas}
            onChange={(e) => set('inasistencias_previas')(e.target.value)}
          />
          <label className="admin-select">
            Recordatorio por correo
            <select value={form.recordatorio} onChange={(e) => set('recordatorio')(e.target.value)}>
              <option value="no">No se envió</option>
              <option value="si">Se envió</option>
              <option value="desconocido">No se sabe</option>
            </select>
          </label>
        </div>
        <Button disabled={predict.isPending}>
          <Send size={16} aria-hidden="true" />
          {predict.isPending ? 'Calculando…' : 'Calcular riesgo en el servidor'}
        </Button>
      </form>
      {predict.isError && (
        <p role="alert" className="field-error prediction-error">
          {errorMessage(predict.error)}
        </p>
      )}
      {predict.isSuccess && <Result result={predict.data} />}

      <div className="prediction-log">
        <h3>Últimas predicciones registradas</h3>
        {log.isError ? (
          <p role="alert" className="field-error">
            {errorMessage(log.error)}
          </p>
        ) : log.data && log.data.length ? (
          <div className="admin-roster-table-wrap">
            <table className="admin-roster-table">
              <caption className="sr-only">Registro de las últimas predicciones del modelo</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Origen</th>
                  <th scope="col">Versión</th>
                  <th scope="col">Entrada</th>
                  <th scope="col">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {log.data.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Fecha">
                      {formatDate(p.creado_en)}, {formatTime(p.creado_en)}
                    </td>
                    <td data-label="Origen">
                      {p.origen === 'panel' ? 'Ver inscritos' : 'Prueba manual'}
                    </td>
                    <td data-label="Versión">{p.version}</td>
                    <td data-label="Entrada" className="admin-roster-reasons">
                      {p.entrada.disciplina} · {p.entrada.hora_inicio}:00 · reservó{' '}
                      {p.entrada.anticipacion_horas} h antes · faltó a{' '}
                      {p.entrada.inasistencias_previas} de {p.entrada.reservas_previas} reservas
                    </td>
                    <td data-label="Resultado">
                      <span className={`badge ${riskBadge[p.riesgo]}`}>Riesgo {p.riesgo}</span>{' '}
                      {Math.round(p.probabilidad * 100)} %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-roster-muted">Todavía no hay predicciones registradas.</p>
        )}
      </div>
    </section>
  );
}
