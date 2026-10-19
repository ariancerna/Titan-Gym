import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  Clock,
  Dumbbell,
  Headset,
  LoaderCircle,
  MapPin,
  MessageCircle,
  X,
  type LucideIcon,
} from 'lucide-react';
import { gym } from '../../content/gym';
import { useSessions } from '../../features/classes/queries';
import {
  bookingWindowDays,
  dateKey,
  dayLabel,
  formatShortDate,
  nextSessionPerClass,
  timeRange,
  timezone,
  upcomingSessions,
} from '../../utils/sessions';
import type { ClassSession } from '../../types/domain';

type Reply =
  | { kind: 'greeting' }
  | { kind: 'classes' }
  | { kind: 'class-schedule'; classId: string; name: string }
  | { kind: 'day-picker' }
  | { kind: 'day'; day: string }
  | { kind: 'booking' }
  | { kind: 'advisor' };
type Message = { id: number; from: 'user'; text: string } | ({ id: number; from: 'bot' } & Reply);
type Ask = (text: string, reply: Reply) => void;

const topics: { label: string; text: string; icon: LucideIcon; reply: Reply }[] = [
  {
    label: 'Ver clases',
    text: 'Ver clases disponibles',
    icon: Dumbbell,
    reply: { kind: 'classes' },
  },
  { label: 'Horarios', text: 'Consultar horarios', icon: Clock, reply: { kind: 'day-picker' } },
  {
    label: 'Cómo reservar',
    text: 'Información sobre reservas',
    icon: ClipboardList,
    reply: { kind: 'booking' },
  },
  {
    label: 'Hablar con un asesor',
    text: 'Quiero hablar con un asesor',
    icon: Headset,
    reply: { kind: 'advisor' },
  },
];
const typingMs = 450;

const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const seats = (s: ClassSession) =>
  s.available > 0 ? `${s.available} ${s.available === 1 ? 'cupo' : 'cupos'}` : 'Completa';
/** «Hoy», «Mañana» o «Miércoles 21 oct». */
function dayName(value: string) {
  const label = capitalize(dayLabel(value));
  return label === 'Hoy' || label === 'Mañana' ? label : `${label} ${formatShortDate(value)}`;
}
/** Etiqueta corta para los botones de día: «Hoy», «Mañana» o «Mié 21». */
function dayChip(value: string) {
  const label = dayLabel(value);
  if (label === 'Hoy' || label === 'Mañana') return label;
  const date = new Date(value);
  const weekday = new Intl.DateTimeFormat('es-PE', { timeZone: timezone, weekday: 'short' })
    .format(date)
    .replace('.', '');
  const day = new Intl.DateTimeFormat('es-PE', { timeZone: timezone, day: 'numeric' }).format(date);
  return `${capitalize(weekday)} ${day}`;
}
/** Una sesión representante por día con clases futuras, como máximo una semana. */
function upcomingDays(sessions: ClassSession[]) {
  const seen = new Set<string>();
  return upcomingSessions(sessions)
    .filter((s) => !seen.has(dateKey(s.starts_at)) && seen.add(dateKey(s.starts_at)))
    .slice(0, 7);
}

function BotRow({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="assistant-row">
      <img className="assistant-avatar" src="/assets/brands/titan-mark.png" alt="" />
      <div className={wide ? 'assistant-bubble wide' : 'assistant-bubble'}>{children}</div>
    </div>
  );
}

/** Carga la agenda real (la misma del catálogo) y delega el contenido. */
function WithSessions({ children }: { children: (sessions: ClassSession[]) => ReactNode }) {
  const { data, isPending, isError, refetch } = useSessions();
  if (isPending)
    return (
      <BotRow>
        <p className="assistant-loading">
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Revisando la
          agenda…
        </p>
      </BotRow>
    );
  if (isError)
    return (
      <BotRow>
        <p>No pude cargar la agenda en este momento.</p>
        <button type="button" className="assistant-chip" onClick={() => refetch()}>
          Reintentar
        </button>
      </BotRow>
    );
  return children(data);
}

const noSessions = (
  <BotRow>
    <p>Por ahora no hay clases programadas. Vuelve a revisar pronto.</p>
  </BotRow>
);

function SessionList({
  list,
  title,
}: {
  list: ClassSession[];
  title: (s: ClassSession) => string;
}) {
  return (
    <ul className="assistant-sessions">
      {list.map((s) => (
        <li key={s.id}>
          <Link to={`/clases/${s.id}`}>
            <span>
              <strong>{title(s)}</strong>
              <small>
                {timeRange(s)} · {s.room}
              </small>
            </span>
            <span className={s.available > 0 ? 'assistant-seats' : 'assistant-seats full'}>
              {seats(s)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ClassesAnswer({ onAsk }: { onAsk: Ask }) {
  return (
    <WithSessions>
      {(sessions) => {
        const classes = nextSessionPerClass(sessions);
        if (!classes.length) return noSessions;
        return (
          <BotRow wide>
            <p>
              Tenemos {classes.length} {classes.length === 1 ? 'clase' : 'clases'} con sesiones
              próximas:
            </p>
            <ul className="assistant-classes">
              {classes.map((s) => (
                <li key={s.class_id}>
                  <strong>{s.name}</strong>
                  <small>
                    {s.discipline} · {s.duration_minutes} min · con {s.instructor}
                  </small>
                  {s.description && <p>{s.description}</p>}
                  <button
                    type="button"
                    className="assistant-chip"
                    onClick={() =>
                      onAsk(`Horarios de ${s.name}`, {
                        kind: 'class-schedule',
                        classId: s.class_id,
                        name: s.name,
                      })
                    }
                  >
                    Ver horarios <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </BotRow>
        );
      }}
    </WithSessions>
  );
}

function ClassScheduleAnswer({ classId, name }: { classId: string; name: string }) {
  return (
    <WithSessions>
      {(sessions) => {
        const list = upcomingSessions(sessions)
          .filter((s) => s.class_id === classId)
          .slice(0, 5);
        if (!list.length) return noSessions;
        return (
          <BotRow wide>
            <p>Próximos horarios de {name}. Toca uno para ver el detalle y reservar:</p>
            <SessionList list={list} title={(s) => dayName(s.starts_at)} />
          </BotRow>
        );
      }}
    </WithSessions>
  );
}

function DayPickerAnswer() {
  return (
    <WithSessions>
      {(sessions) =>
        upcomingDays(sessions).length ? (
          <BotRow>
            <p>¿Qué día te interesa? Elígelo en las opciones de abajo.</p>
          </BotRow>
        ) : (
          noSessions
        )
      }
    </WithSessions>
  );
}

function DayAnswer({ day }: { day: string }) {
  return (
    <WithSessions>
      {(sessions) => {
        const list = upcomingSessions(sessions).filter((s) => dateKey(s.starts_at) === day);
        if (!list.length) return noSessions;
        const label = dayLabel(list[0].starts_at);
        const title =
          label === 'Hoy' || label === 'Mañana'
            ? label.toLowerCase()
            : `${label} ${formatShortDate(list[0].starts_at)}`;
        return (
          <BotRow wide>
            <p>Clases de {title}. Toca una para ver el detalle y reservar:</p>
            <SessionList list={list} title={(s) => s.name} />
            <Link className="assistant-more" to="/clases">
              Ver la agenda completa <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </BotRow>
        );
      }}
    </WithSessions>
  );
}

function BookingAnswer() {
  return (
    <BotRow wide>
      <p>Reservar tu lugar es gratis y toma un minuto:</p>
      <ol className="assistant-steps">
        <li>
          <Link to="/mis-reservas">Ingresa o crea tu cuenta</Link> con tu correo o con Google.
        </li>
        <li>
          Elige una clase. Las reservas se abren {bookingWindowDays} días antes de cada sesión.
        </li>
        <li>
          Confirma tus datos y acepta la <Link to="/privacidad">política de privacidad</Link>.
        </li>
        <li>Muestra el código QR de tu reserva en recepción.</li>
      </ol>
      <p>
        ¿No puedes asistir? Cancela desde <Link to="/mis-reservas">Mis reservas</Link> antes de que
        empiece la clase para liberar tu cupo. Para membresías y pagos, consulta en recepción.
      </p>
    </BotRow>
  );
}

function AdvisorAnswer() {
  return (
    <BotRow wide>
      <p>Un asesor de {gym.name} te atiende por WhatsApp:</p>
      <a
        className="btn btn-primary assistant-whatsapp"
        href={gym.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MessageCircle size={18} aria-hidden="true" /> Escribir al {gym.whatsapp}
        <span className="sr-only"> (abre WhatsApp en otra pestaña)</span>
      </a>
      <p className="assistant-address">
        <MapPin size={16} aria-hidden="true" />
        <span>
          También puedes visitarnos en <strong>{gym.branch}</strong>, {gym.address}.{' '}
          <a href={gym.mapsUrl} target="_blank" rel="noopener noreferrer">
            Cómo llegar <ArrowUpRight size={14} aria-hidden="true" />
            <span className="sr-only"> (abre Google Maps en otra pestaña)</span>
          </a>
        </span>
      </p>
    </BotRow>
  );
}

function BotMessage({ reply, onAsk }: { reply: Reply; onAsk: Ask }) {
  switch (reply.kind) {
    case 'greeting':
      return (
        <BotRow>
          <p>
            ¡Hola! <span aria-hidden="true">👋</span> Te damos la bienvenida a {gym.name}. Estoy
            aquí para ayudarte a encontrar la clase ideal para ti.
          </p>
          <p>¿Qué te gustaría hacer? Elige una opción abajo.</p>
        </BotRow>
      );
    case 'classes':
      return <ClassesAnswer onAsk={onAsk} />;
    case 'class-schedule':
      return <ClassScheduleAnswer classId={reply.classId} name={reply.name} />;
    case 'day-picker':
      return <DayPickerAnswer />;
    case 'day':
      return <DayAnswer day={reply.day} />;
    case 'booking':
      return <BookingAnswer />;
    case 'advisor':
      return <AdvisorAnswer />;
  }
}

function DayChips({ busy, onAsk, onBack }: { busy: boolean; onAsk: Ask; onBack: () => void }) {
  const { data } = useSessions();
  return (
    <div className="assistant-chips">
      <button type="button" className="assistant-chip back" onClick={onBack}>
        <ArrowLeft size={14} aria-hidden="true" /> Menú
      </button>
      {upcomingDays(data ?? []).map((s) => (
        <button
          key={s.id}
          type="button"
          className="assistant-chip"
          aria-disabled={busy}
          onClick={() => onAsk(dayChip(s.starts_at), { kind: 'day', day: dateKey(s.starts_at) })}
        >
          {dayChip(s.starts_at)}
        </button>
      ))}
    </div>
  );
}

/** Asistente guiado: opciones fijas, sin IA y sin enviar datos a terceros. */
export default function AssistantPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: 'bot', kind: 'greeting' }]);
  const [typing, setTyping] = useState(false);
  const [mode, setMode] = useState<'menu' | 'days'>('menu');
  const nextId = useRef(1);
  const timer = useRef<number | undefined>(undefined);
  const logRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const ask: Ask = (text, reply) => {
    if (typing) return;
    setMessages((m) => [...m, { id: nextId.current++, from: 'user', text }]);
    setTyping(true);
    timer.current = window.setTimeout(() => {
      setMessages((m) => [...m, { id: nextId.current++, from: 'bot', ...reply }]);
      setMode(reply.kind === 'day-picker' || reply.kind === 'day' ? 'days' : 'menu');
      setTyping(false);
    }, typingMs);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Al abrir, el foco va a la primera opción. Si la opción pulsada desaparece
  // (cambio de menú a días), el foco pasa a la primera opción nueva.
  useEffect(() => footerRef.current?.querySelector('button')?.focus(), []);
  useEffect(() => {
    if (!typing && document.activeElement === document.body)
      footerRef.current?.querySelector('button')?.focus();
  }, [mode, typing]);

  // Los mensajes suben como en un chat. Si la respuesta es más alta que la
  // ventana, se detiene en la pregunta para leerla desde el inicio.
  useLayoutEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const follow = () => {
      const users = log.querySelectorAll<HTMLElement>('.assistant-user');
      const last = users[users.length - 1];
      const bottom = log.scrollHeight - log.clientHeight;
      log.scrollTop = last ? Math.min(bottom, last.offsetTop - 12) : bottom;
    };
    follow();
    if (typeof ResizeObserver === 'undefined' || !log.firstElementChild) return;
    const observer = new ResizeObserver(follow);
    observer.observe(log.firstElementChild);
    return () => observer.disconnect();
  }, [messages, typing]);

  return (
    <section
      id={id}
      className="assistant-panel"
      role="dialog"
      aria-labelledby="assistant-title"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <header className="assistant-header">
        <img src="/assets/brands/titan-mark.png" width="32" height="32" alt="" />
        <div>
          <h2 id="assistant-title">Asistente TITAN</h2>
          <p>
            <span className="assistant-online" aria-hidden="true" /> Respuestas al instante
          </p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
      </header>
      <div className="assistant-log" ref={logRef} aria-live="polite" aria-relevant="additions">
        <div>
          {messages.map((m) =>
            m.from === 'user' ? (
              <p key={m.id} className="assistant-user">
                {m.text}
              </p>
            ) : (
              <BotMessage key={m.id} reply={m} onAsk={ask} />
            ),
          )}
          {typing && (
            <div className="assistant-row" aria-hidden="true">
              <img className="assistant-avatar" src="/assets/brands/titan-mark.png" alt="" />
              <div className="assistant-bubble assistant-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>
      </div>
      <div
        className="assistant-footer"
        ref={footerRef}
        role="group"
        aria-label="Respuestas rápidas"
      >
        {mode === 'menu' ? (
          <div className="assistant-menu">
            {topics.map(({ label, text, icon: Icon, reply }) => (
              <button
                key={label}
                type="button"
                aria-disabled={typing}
                onClick={() => ask(text, reply)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <DayChips busy={typing} onAsk={ask} onBack={() => setMode('menu')} />
        )}
      </div>
    </section>
  );
}
