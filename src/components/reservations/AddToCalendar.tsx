import { CalendarPlus, Download } from 'lucide-react';
import type { ClassSession } from '../../types/domain';
import { googleCalendarUrl, icsContent } from '../../utils/calendar';

type Props = {
  session: Pick<ClassSession, 'name' | 'starts_at' | 'duration_minutes' | 'room' | 'instructor'>;
  code: string;
};

/** Guarda la clase en el calendario del socio: menos olvidos, menos inasistencias. */
export function AddToCalendar({ session, code }: Props) {
  function download() {
    const blob = new Blob([icsContent(session, code)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `titan-gym-${code}.ics`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="add-calendar" aria-labelledby="add-calendar-title">
      <h2 id="add-calendar-title">Agrégala a tu calendario</h2>
      <p>Te avisa una hora antes para que no se te pase.</p>
      <div className="add-calendar-actions">
        <a
          className="btn btn-secondary"
          href={googleCalendarUrl(session, code)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <CalendarPlus size={18} aria-hidden="true" /> Google Calendar
          <span className="sr-only"> (abre en otra pestaña)</span>
        </a>
        <button type="button" className="btn btn-secondary" onClick={download}>
          <Download size={18} aria-hidden="true" /> iPhone u Outlook (.ics)
        </button>
      </div>
    </section>
  );
}
