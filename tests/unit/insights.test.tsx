import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  groupByDay,
  recentNoShowRate,
  todaySummary,
  upcomingOccupancy,
  weekStart,
  weeklyNoShows,
} from '../../src/features/admin/insights';
import { NoShowTrend } from '../../src/components/admin/NoShowTrend';
import type { DatasetRow, ManagedSession } from '../../src/features/admin/api';
import { formatSessionWhen } from '../../src/utils/sessions';

const row = (inicio: string, asistio: boolean | null, estado: DatasetRow['estado'] = 'confirmed') =>
  ({ inicio_sesion: inicio, asistio, estado }) as DatasetRow;
const session = (starts_at: string, extra: Partial<ManagedSession> = {}) =>
  ({
    starts_at,
    reserved: 5,
    capacity: 10,
    present: 2,
    waiting: 1,
    cancelled_at: null,
    ...extra,
  }) as ManagedSession;

describe('indicadores del panel', () => {
  it('agrupa los no-shows por semana (lunes, hora de Lima) sin contar cancelaciones ni pendientes', () => {
    expect(weekStart('2026-10-21T23:00:00Z')).toBe('2026-10-19'); // miércoles 21 → lunes 19
    expect(weekStart('2026-10-19T04:30:00Z')).toBe('2026-10-12'); // domingo 18 a las 23:30 en Lima
    const weeks = weeklyNoShows([
      row('2026-10-13T12:00:00Z', true),
      row('2026-10-14T12:00:00Z', false),
      row('2026-10-20T12:00:00Z', false),
      row('2026-10-21T12:00:00Z', null),
      row('2026-10-22T12:00:00Z', false, 'cancelled'),
    ]);
    expect(weeks).toEqual([
      { week: '2026-10-12', registered: 2, absent: 1, rate: 0.5 },
      { week: '2026-10-19', registered: 1, absent: 1, rate: 1 },
    ]);
  });

  it('resume el día y la ocupación sin contar sesiones canceladas', () => {
    const now = new Date('2026-10-20T15:00:00Z'); // 10:00 en Lima
    const sessions = [
      session('2026-10-20T23:00:00Z'),
      session('2026-10-20T13:00:00Z'),
      session('2026-10-20T22:00:00Z', { cancelled_at: '2026-10-19T10:00:00Z' }),
      session('2026-10-21T23:00:00Z', { reserved: 10 }),
    ];
    expect(todaySummary(sessions, now)).toEqual({
      sessions: 2,
      reserved: 10,
      present: 4,
      waiting: 2,
    });
    expect(upcomingOccupancy(sessions, now.getTime())).toBe(15 / 20);
  });

  it('calcula los no-shows de los últimos 30 días', () => {
    const now = new Date('2026-10-20T12:00:00Z').getTime();
    expect(
      recentNoShowRate(
        [
          row('2026-10-10T12:00:00Z', false),
          row('2026-10-11T12:00:00Z', true),
          row('2026-08-01T12:00:00Z', false),
        ],
        now,
      ),
    ).toBe(0.5);
    expect(recentNoShowRate([], now)).toBeNull();
  });

  it('agrupa la agenda por día conservando el orden', () => {
    const groups = groupByDay([
      session('2026-10-20T13:00:00Z'),
      session('2026-10-20T23:00:00Z'),
      session('2026-10-21T13:00:00Z'),
    ]);
    expect(groups.map(([day, list]) => [day, list.length])).toEqual([
      ['2026-10-20', 2],
      ['2026-10-21', 1],
    ]);
  });

  it('formatea la sesión en el formato compacto del panel', () => {
    expect(formatSessionWhen('2026-10-20T01:00:00Z', 50)).toBe('lun 19 oct · 20:00–20:50');
  });
});

describe('gráfico semanal de no-shows', () => {
  it('pide al menos dos semanas con datos', () => {
    render(<NoShowTrend weeks={[{ week: '2026-10-12', registered: 4, absent: 1, rate: 0.25 }]} />);
    expect(screen.getByText(/al menos dos semanas/)).toBeInTheDocument();
  });

  it('dibuja una barra por semana con su descripción y una tabla equivalente', () => {
    render(
      <NoShowTrend
        weeks={[
          { week: '2026-10-05', registered: 10, absent: 3, rate: 0.3 },
          { week: '2026-10-12', registered: 8, absent: 1, rate: 0.125 },
        ]}
      />,
    );
    expect(screen.getByText('No-shows por semana')).toBeInTheDocument();
    expect(screen.getByLabelText('Semana del 5 oct: 30% de no-shows, 3 de 10')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // cabecera + 2 semanas
  });
});
