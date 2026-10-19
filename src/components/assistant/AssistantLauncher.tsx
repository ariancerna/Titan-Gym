import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
const AssistantPanel = lazy(() => import('./AssistantPanel'));
// En el panel del personal y en el retorno de autenticación el asistente solo estorba.
const hiddenOn = ['/admin', '/auth/confirm'];
export function AssistantLauncher() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  if (hiddenOn.includes(pathname)) return null;
  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };
  return (
    <div className="assistant">
      {open && (
        <Suspense fallback={null}>
          <AssistantPanel id="assistant-panel" onClose={close} />
        </Suspense>
      )}
      <button
        ref={launcher}
        type="button"
        className="assistant-launcher"
        aria-expanded={open}
        aria-controls={open ? 'assistant-panel' : undefined}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente de TITAN GYM'}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? <X size={26} /> : <MessageCircle size={26} />}
      </button>
    </div>
  );
}
