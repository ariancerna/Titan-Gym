import { describe, expect, it } from 'vitest';
import { limaHour, noShowRisk, riskBacktest } from '../../src/features/admin/risk';
import type { DatasetRow } from '../../src/features/admin/api';

const base = { priorReservations: 6, priorAbsences: 0, hoursAhead: 24, startHour: 18 };

describe('riesgo de no-show', () => {
  it('un socio con buen historial, reserva cercana y clase de tarde tiene riesgo bajo', () => {
    expect(noShowRisk(base)).toEqual({ level: 'bajo', points: 0, reasons: [] });
  });

  it('quien falta seguido sin avisar tiene riesgo alto y se explica por qué', () => {
    const risk = noShowRisk({ ...base, priorAbsences: 2 });
    expect(risk.level).toBe('alto');
    expect(risk.reasons).toEqual(['Faltó sin avisar a 2 de sus 6 reservas anteriores']);
  });

  it('una falta aislada suma poco; con otro factor llega a medio', () => {
    expect(noShowRisk({ ...base, priorReservations: 10, priorAbsences: 2 }).level).toBe('bajo');
    const risk = noShowRisk({ ...base, priorAbsences: 1, startHour: 7 });
    expect(risk.level).toBe('medio');
    expect(risk.reasons).toEqual(['Faltó sin avisar una vez', 'Clase antes de las 8:00']);
  });

  it('primera reserva, mucha anticipación y clase temprana suman riesgo alto', () => {
    const risk = noShowRisk({
      priorReservations: 0,
      priorAbsences: 0,
      hoursAhead: 100,
      startHour: 7,
    });
    expect(risk).toMatchObject({ level: 'alto', points: 3 });
    expect(risk.reasons).toContain('Reservó con 4 días de anticipación');
    expect(risk.reasons).toContain('Es su primera reserva');
  });

  it('usa la hora de Lima', () => {
    expect(limaHour('2026-10-20T12:00:00Z')).toBe(7);
  });

  it('la comprobación compara cada nivel con lo que pasó y omite lo no registrado', () => {
    const row = (asistio: boolean | null, extra: Partial<DatasetRow> = {}) =>
      ({
        asistio,
        reservas_previas: 6,
        inasistencias_previas: 0,
        anticipacion_horas: 24,
        hora_inicio: 18,
        ...extra,
      }) as DatasetRow;
    expect(
      riskBacktest([row(true), row(false), row(null), row(false, { inasistencias_previas: 3 })]),
    ).toEqual([
      { level: 'bajo', registered: 2, absent: 1, rate: 0.5 },
      { level: 'medio', registered: 0, absent: 0, rate: null },
      { level: 'alto', registered: 1, absent: 1, rate: 1 },
    ]);
  });
});
