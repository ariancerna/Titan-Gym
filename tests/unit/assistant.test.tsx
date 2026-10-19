import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import AssistantPanel from '../../src/components/assistant/AssistantPanel';
import { nextSessionPerClass, upcomingSessions } from '../../src/utils/sessions';
import type { ClassSession } from '../../src/types/domain';

const hour = 3600000;
const at = (h: number) => new Date(Date.now() + h * hour).toISOString();
const base: ClassSession = { id: 's1', class_id: 'c1', name: 'Spinning Pro', description: 'Cardio intenso sobre bicicleta.', discipline: 'Spinning', instructor: 'Ana', instructor_bio: '', instructor_image: null, image_url: null, location: 'Qatuna', address: '', room: 'Sala 1', starts_at: at(3), duration_minutes: 50, capacity: 20, reserved: 5, available: 15 };
const sessions: ClassSession[] = [
  { ...base, id: 's3', starts_at: at(27) },
  { ...base, id: 's2', class_id: 'c2', name: 'Yoga Flow', discipline: 'Yoga', starts_at: at(2), reserved: 20, available: 0 },
  base,
  { ...base, id: 'past', class_id: 'c3', name: 'HIIT', starts_at: at(-5) },
];
vi.mock('../../src/features/classes/queries', () => ({
  useSessions: () => ({ data: sessions, isPending: false, isError: false, refetch: vi.fn() }),
}));
const renderPanel = (onClose = () => {}) => render(<MemoryRouter><AssistantPanel id="a" onClose={onClose} /></MemoryRouter>);
const quickReplies = () => screen.getByRole('group', { name: 'Respuestas rápidas' });

describe('asistente guiado', () => {
  it('ordena solo sesiones futuras y elige la próxima de cada clase', () => {
    expect(upcomingSessions(sessions).map((s) => s.id)).toEqual(['s2', 's1', 's3']);
    expect(nextSessionPerClass(sessions).map((s) => s.id)).toEqual(['s2', 's1']);
  });
  it('«Ver clases» describe cada clase y muestra sus horarios al pedirlos', async () => {
    renderPanel();
    expect(screen.getByRole('dialog', { name: 'Asistente TITAN' })).toBeInTheDocument();
    await userEvent.click(within(quickReplies()).getByRole('button', { name: 'Ver clases' }));
    expect(screen.getByText('Ver clases disponibles')).toHaveClass('assistant-user');
    expect(await screen.findByText('Tenemos 2 clases con sesiones próximas:')).toBeInTheDocument();
    expect(screen.getByText('Spinning · 50 min · con Ana')).toBeInTheDocument();
    expect(screen.queryByText(/cupos/)).toBeNull();
    await userEvent.click(screen.getAllByRole('button', { name: 'Ver horarios' })[0]);
    expect(await screen.findByText('Próximos horarios de Yoga Flow. Toca uno para ver el detalle y reservar:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Completa/ })).toHaveAttribute('href', '/clases/s2');
  });
  it('«Horarios» pregunta el día y lista las clases de ese día', async () => {
    renderPanel();
    await userEvent.click(within(quickReplies()).getByRole('button', { name: 'Horarios' }));
    expect(await screen.findByText(/¿Qué día te interesa\?/)).toBeInTheDocument();
    const days = within(quickReplies()).getAllByRole('button').filter((b) => b.textContent !== ' Menú');
    expect(days.length).toBeGreaterThanOrEqual(1);
    await userEvent.click(days[0]);
    expect(await screen.findByText(/^Clases de /)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Spinning Pro|Yoga Flow/ }).length).toBeGreaterThanOrEqual(1);
    await userEvent.click(within(quickReplies()).getByRole('button', { name: 'Menú' }));
    expect(within(quickReplies()).getByRole('button', { name: 'Hablar con un asesor' })).toBeInTheDocument();
  });
  it('enlaza el WhatsApp del gimnasio y se cierra con Escape', async () => {
    const onClose = vi.fn();
    renderPanel(onClose);
    await userEvent.click(within(quickReplies()).getByRole('button', { name: 'Hablar con un asesor' }));
    expect(await screen.findByRole('link', { name: /922 863 400/ })).toHaveAttribute('href', 'https://wa.me/51922863400');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
