import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, UserCircle, ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { requireSupabase } from '../../lib/supabase/client';
import { ButtonLink } from '../ui/Button';
export function Navbar() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const { user } = useAuth();
  async function signOut() {
    const { error } = await requireSupabase().auth.signOut();
    setError(Boolean(error));
  }
  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link
          to="/"
          aria-label="TITAN GYM, inicio"
          className="brand"
          onClick={() => setOpen(false)}
        >
          <img src="/assets/brands/titan-mark.png" alt="" width="36" height="36" />
          <span>
            TITAN <span className="yellow">GYM</span>
          </span>
        </Link>
        <nav aria-label="Navegación principal" className={open ? 'nav-links open' : 'nav-links'}>
          {[
            ['/', 'Inicio'],
            ['/clases', 'Clases'],
            ['/mis-reservas', 'Mis reservas'],
          ].map(([to, text]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
              {text}
            </NavLink>
          ))}
        </nav>
        <div className="nav-actions">
          {user ? (
            <button className="nav-account" onClick={signOut}>
              <LogOut size={18} aria-hidden="true" />
              <span className="nav-account-text">Cerrar sesión</span>
            </button>
          ) : (
            <Link to="/mis-reservas" className="nav-account">
              <UserCircle size={18} aria-hidden="true" />
              <span className="nav-account-text">Ingresar</span>
            </Link>
          )}
          <ButtonLink to="/clases" className="nav-cta">
            Reservar clase <ArrowRight size={16} />
          </ButtonLink>
          <button
            className="icon-button mobile-menu"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="container field-error">
          No se pudo cerrar la sesión. Inténtalo de nuevo.
        </p>
      )}
    </header>
  );
}
