import { describe, expect, it } from 'vitest';
import paridad from './fixtures/noshow-paridad.json';
import {
  limaWeekday,
  noShowLevel,
  noShowModelInfo,
  predictFromDatasetRow,
  predictNoShow,
  reminderStatus,
  type NoShowInput,
} from '../../src/features/admin/noshowModel';
import { riskBacktest } from '../../src/features/admin/risk';
import type { DatasetRow } from '../../src/features/admin/api';

const casos = paridad as { entrada: NoShowInput; probabilidad: number }[];

const base: NoShowInput = {
  disciplina: 'Spinning',
  inicio_sesion: '2026-11-18T23:00:00Z',
  dia_semana: 3,
  hora_inicio: 18,
  duracion_min: 50,
  capacidad: 25,
  reservas_activas: 21,
  anticipacion_horas: 5.5,
  reservas_previas: 25,
  inasistencias_previas: 0,
  recordatorio_enviado: true,
};

describe('modelo de no-show exportado desde el notebook (APF3)', () => {
  it('reproduce exactamente las probabilidades de scikit-learn', () => {
    expect(casos.length).toBe(200);
    for (const { entrada, probabilidad } of casos) {
      expect(Math.abs(predictNoShow(entrada).probability - probabilidad)).toBeLessThan(1e-9);
    }
  });

  it('imputa el recordatorio desconocido igual que el pipeline de entrenamiento', () => {
    const conNulo = casos.filter((c) => c.entrada.recordatorio_enviado === null);
    expect(conNulo.length).toBeGreaterThan(0);
    for (const { entrada, probabilidad } of conNulo) {
      expect(predictNoShow(entrada).probability).toBeCloseTo(probabilidad, 9);
    }
  });

  it('el historial de faltas y la anticipación suben el riesgo; el recordatorio lo baja', () => {
    const constante = predictNoShow(base);
    const faltador = predictNoShow({
      ...base,
      disciplina: 'Funcional',
      inicio_sesion: '2026-11-16T12:00:00Z',
      dia_semana: 1,
      hora_inicio: 7,
      duracion_min: 60,
      capacidad: 18,
      reservas_activas: 5,
      anticipacion_horas: 96,
      reservas_previas: 6,
      inasistencias_previas: 3,
      recordatorio_enviado: false,
    });
    expect(constante.level).toBe('bajo');
    expect(faltador.level).toBe('alto');
    expect(faltador.probability).toBeGreaterThan(constante.probability);
    expect(predictNoShow({ ...base, recordatorio_enviado: false }).probability).toBeGreaterThan(
      constante.probability,
    );
  });

  it('asigna los niveles con los umbrales del notebook', () => {
    expect(noShowModelInfo.highThreshold).toBeGreaterThan(noShowModelInfo.contactThreshold);
    expect(noShowLevel(noShowModelInfo.highThreshold)).toBe('alto');
    expect(noShowLevel(noShowModelInfo.contactThreshold)).toBe('medio');
    expect(noShowLevel(noShowModelInfo.contactThreshold - 0.001)).toBe('bajo');
  });

  it('usa el día de la semana de Lima', () => {
    // Lunes 19:30 en Lima ya es martes en UTC.
    expect(limaWeekday('2026-11-17T00:30:00Z')).toBe(1);
    expect(limaWeekday('2026-11-22T15:00:00Z')).toBe(7);
  });

  it('el recordatorio cuenta si se envió o si sigue programado', () => {
    const inicio = '2026-11-18T23:00:00Z';
    const reserva = '2026-11-17T12:00:00Z';
    const antes = Date.parse('2026-11-18T10:00:00Z');
    expect(reminderStatus({ reminder_sent_at: '2026-11-18T20:00:00Z' }, inicio, reserva)).toBe(
      true,
    );
    expect(reminderStatus({ email_reminders: true }, inicio, reserva, antes)).toBe(true);
    expect(reminderStatus({ email_reminders: false }, inicio, reserva, antes)).toBe(false);
    // Reservó a menos de 3 h del inicio: el recordatorio ya no se envía.
    expect(reminderStatus({ email_reminders: true }, inicio, '2026-11-18T21:30:00Z', antes)).toBe(
      false,
    );
    // Sin la migración no se sabe: el modelo lo imputa.
    expect(reminderStatus({}, inicio, reserva, antes)).toBeNull();
  });

  it('la comprobación de Indicadores puede evaluar el modelo con el dataset del MVP', () => {
    const fila = (asistio: boolean | null, extra: Partial<DatasetRow> = {}) =>
      ({
        ...base,
        recordatorio_enviado: true,
        asistio,
        ...extra,
      }) as unknown as DatasetRow;
    const filas = [
      fila(true),
      fila(null),
      fila(false, {
        inasistencias_previas: 20,
        anticipacion_horas: 120,
        recordatorio_enviado: false,
      }),
    ];
    expect(predictFromDatasetRow(filas[2]).level).toBe('alto');
    expect(riskBacktest(filas, (r) => predictFromDatasetRow(r).level)).toEqual([
      { level: 'bajo', registered: 1, absent: 0, rate: 0 },
      { level: 'medio', registered: 0, absent: 0, rate: null },
      { level: 'alto', registered: 1, absent: 1, rate: 1 },
    ]);
  });
});
