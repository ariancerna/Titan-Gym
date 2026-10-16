import { describe, expect, it } from 'vitest';
import { datasetToCsv, formatPercent, summarizeAttendance } from '../../src/features/admin/indicators';
import type { DatasetRow } from '../../src/features/admin/api';

function row(overrides: Partial<DatasetRow>): DatasetRow {
  return {
    reserva_id: crypto.randomUUID(),
    socio_ref: 'a1b2c3d4e5f60718',
    sesion_id: 's1',
    clase: 'HIIT Titan Burn',
    disciplina: 'HIIT',
    instructor: 'Sofía Herrera',
    inicio_sesion: '2026-10-10T00:30:00Z',
    dia_semana: 5,
    hora_inicio: 19,
    duracion_min: 45,
    capacidad: 20,
    reservas_activas: 3,
    fecha_reserva: '2026-10-08T15:00:00Z',
    anticipacion_horas: 33.5,
    reservas_previas: 0,
    inasistencias_previas: 0,
    estado: 'confirmed',
    cancelada_en: null,
    asistencia: 'pending',
    asistio: null,
    ...overrides,
  };
}

describe('indicadores de asistencia (HU09)', () => {
  it('calcula la tasa de no-shows solo con asistencias registradas', () => {
    const summary = summarizeAttendance([
      row({ asistencia: 'present', asistio: true }),
      row({ asistencia: 'present', asistio: true }),
      row({ asistencia: 'present', asistio: true }),
      row({ asistencia: 'absent', asistio: false }),
      row({ asistencia: 'pending', asistio: null }),
      row({ estado: 'cancelled', asistencia: null, asistio: null, cancelada_en: '2026-10-09T10:00:00Z' }),
    ]);
    expect(summary).toMatchObject({ reservas: 6, canceladas: 1, presentes: 3, ausentes: 1, sinRegistrar: 1 });
    expect(summary.tasaNoShow).toBe(0.25);
    expect(summary.cobertura).toBe(0.8);
    expect(formatPercent(summary.tasaNoShow)).toBe('25%');
  });

  it('no inventa porcentajes cuando todavía no hay datos', () => {
    const summary = summarizeAttendance([]);
    expect(summary.tasaNoShow).toBeNull();
    expect(summary.cobertura).toBeNull();
    expect(formatPercent(summary.tasaNoShow)).toBe('—');
  });

  it('ordena las clases por tasa de no-shows', () => {
    const summary = summarizeAttendance([
      row({ clase: 'Yoga', asistio: true, asistencia: 'present' }),
      row({ clase: 'Spinning', asistio: false, asistencia: 'absent' }),
    ]);
    expect(summary.porClase.map((c) => c.clase)).toEqual(['Spinning', 'Yoga']);
  });
});

describe('exportación del dataset (APF3)', () => {
  it('genera cabecera fija, escapa comas y neutraliza fórmulas', () => {
    const csv = datasetToCsv([row({ clase: '=HYPERLINK("x")', instructor: 'Ruiz, David', asistio: false })]);
    const [header, line] = csv.split('\r\n');
    expect(header.split(',')).toHaveLength(20);
    expect(header).not.toMatch(/nombre|correo|email|user_id/);
    expect(line).toContain(`"'=HYPERLINK(""x"")"`);
    expect(line).toContain('"Ruiz, David"');
    expect(line.endsWith(',false')).toBe(true);
  });
});
