import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { gym } from '../../content/gym';

export function Footer() {
  const { user } = useAuth();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-about">
          <Link to="/" className="footer-brand" aria-label="TITAN GYM, inicio">
            <img src="/assets/brands/titan-mark.png" width="40" height="40" alt="" loading="lazy" />
            <strong>
              TITAN <span className="accent">GYM</span>
            </strong>
          </Link>
          <p>
            Reserva tus clases grupales en línea, revisa los cupos antes de ir y cancela si no
            puedes asistir.
          </p>
        </div>

        <div>
          <h2 className="footer-title">Sede</h2>
          <p className="footer-address">
            <MapPin size={16} aria-hidden="true" />
            <span>
              <strong>{gym.branch}</strong>
              {gym.address}
            </span>
          </p>
          <a
            className="footer-link-external"
            href={gym.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Cómo llegar <ArrowUpRight size={14} aria-hidden="true" />
            <span className="sr-only"> (abre Google Maps en otra pestaña)</span>
          </a>
        </div>

        <nav aria-labelledby="footer-classes">
          <h2 className="footer-title" id="footer-classes">
            Clases
          </h2>
          <ul>
            <li>
              <Link to="/">Inicio</Link>
            </li>
            <li>
              <Link to="/clases">Horarios y clases</Link>
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-account">
          <h2 className="footer-title" id="footer-account">
            Tu cuenta
          </h2>
          <ul>
            <li>
              <Link to="/mis-reservas">{user ? 'Mis reservas' : 'Ingresar o crear cuenta'}</Link>
            </li>
            {user && (
              <li>
                <Link to="/perfil">Mi perfil</Link>
              </li>
            )}
            <li>
              <Link to="/admin">Acceso del personal</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="container footer-bottom">
        <p>
          © {new Date().getFullYear()} {gym.name} · FitSmart Agenda, proyecto académico UTP.
        </p>
        <Link to="/privacidad">Política de privacidad</Link>
      </div>
    </footer>
  );
}
