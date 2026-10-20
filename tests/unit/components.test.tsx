import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { ClassCard } from '../../src/components/classes/ClassCard';
import { OccupancyBar } from '../../src/components/classes/OccupancyBar';
import { Input } from '../../src/components/ui/Input';
import type { ClassSession } from '../../src/types/domain';
const session: ClassSession = {
  id: '1',
  class_id: '1',
  name: 'Funcional Élite',
  description: '',
  discipline: 'Funcional',
  instructor: 'David Ruiz',
  instructor_bio: '',
  instructor_image: null,
  image_url: null,
  location: 'Central',
  address: '',
  room: 'Sala',
  starts_at: '2030-06-15T23:00:00Z',
  duration_minutes: 60,
  capacity: 18,
  reserved: 18,
  available: 0,
  cancelled: false,
  cancel_reason: null,
};
describe('interfaz APF2', () => {
  it('PF-04: una clase completa no permite iniciar una reserva', () => {
    render(
      <MemoryRouter>
        <ClassCard session={session} />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Clase completa').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver detalles' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Ver detalles y reservar/ })).not.toBeInTheDocument();
  });
  it('PF-02: porcentaje accesible y cero cupos', () => {
    render(<OccupancyBar reserved={18} capacity={18} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('0 cupos libres')).toBeInTheDocument();
  });
  it('presenta mensajes de validación asociados al campo', () => {
    render(<Input id="test-name" label="Nombre" error="Ingresa tu nombre" />);
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Ingresa tu nombre');
  });
});
