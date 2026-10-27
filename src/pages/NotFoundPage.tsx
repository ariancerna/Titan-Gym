import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <section className="container page not-found">
      <p className="not-found-code" aria-hidden="true">
        404
      </p>
      <h1>Página no encontrada</h1>
      <p>Esta dirección no existe en TITAN GYM. Puede que el enlace esté mal escrito.</p>
      <div className="hero-buttons">
        <ButtonLink to="/clases">
          Ver horarios <ArrowRight size={18} />
        </ButtonLink>
        <ButtonLink to="/" variant="secondary">
          Ir al inicio
        </ButtonLink>
      </div>
    </section>
  );
}
