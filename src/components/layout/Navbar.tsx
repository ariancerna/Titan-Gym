import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../app/AuthProvider';
import { savedName } from '../../features/auth/profile';
import { requireSupabase } from '../../lib/supabase/client';
import { ButtonLink } from '../ui/Button';

const links = [
  ['/', 'Inicio'],
  ['/clases', 'Clases'],
  ['/mis-reservas', 'Mis reservas'],
] as const;

/** Nombre a mostrar: el del perfil (o Google) y, si no hay, la parte local del correo. */
function displayName(user: User) {
  return savedName(user).trim() || user.email?.split('@')[0] || 'Mi cuenta';
}
function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="nav-avatar" aria-hidden="true">
      {initials(name) || <UserRound size={16} />}
    </span>
  );
}

function AccountMenu({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const name = displayName(user);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div
      className="nav-account-menu"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="nav-user"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`Cuenta de ${name}`}
        onClick={() => setOpen(!open)}
      >
        <Avatar name={name} />
        <span className="nav-user-name">{name.split(/\s+/)[0]}</span>
        <ChevronDown size={16} aria-hidden="true" className="nav-chevron" />
      </button>
      {open && (
        <div className="nav-dropdown" id="account-menu">
          <div className="nav-dropdown-head">
            <strong>{name}</strong>
            <small>{user.email}</small>
          </div>
          <Link to="/perfil" onClick={() => setOpen(false)}>
            <UserRound size={18} aria-hidden="true" /> Mi perfil
          </Link>
          <Link to="/mis-reservas" onClick={() => setOpen(false)}>
            <CalendarDays size={18} aria-hidden="true" /> Mis reservas
          </Link>
          <button type="button" className="nav-signout" onClick={onSignOut}>
            <LogOut size={18} aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  async function signOut() {
    const { error } = await requireSupabase().auth.signOut();
    setError(Boolean(error));
    if (!error) setOpen(false);
  }
  return (
    <header className="navbar" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <div className="container nav-inner">
        <Link to="/" aria-label="TITAN GYM, inicio" className="brand">
          <img src="/assets/brands/titan-mark.png" alt="" width="36" height="36" />
          <span>
            TITAN <span className="accent">GYM</span>
          </span>
        </Link>
        <nav aria-label="Navegación principal" className="nav-links">
          {links.map(([to, text]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {text}
            </NavLink>
          ))}
        </nav>
        <div className="nav-actions">
          {loading ? (
            // Mientras se confirma la sesión guardada no se muestra «Ingresar»: parecería cerrada.
            <span className="nav-account pending" aria-hidden="true" />
          ) : user ? (
            <AccountMenu user={user} onSignOut={signOut} />
          ) : (
            <Link to="/mis-reservas" className="nav-account">
              <LogIn size={18} aria-hidden="true" />
              Ingresar
            </Link>
          )}
          <ButtonLink to="/clases" className="nav-cta">
            Reservar clase <ArrowRight size={16} />
          </ButtonLink>
          <button
            className="icon-button mobile-menu"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls="nav-panel"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <div className="nav-panel" id="nav-panel">
          <nav aria-label="Menú" className="container">
            {links.map(([to, text]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {text}
              </NavLink>
            ))}
          </nav>
          <div className="container nav-panel-account">
            {user ? (
              <>
                <div className="nav-panel-user">
                  <Avatar name={displayName(user)} />
                  <span>
                    <strong>{displayName(user)}</strong>
                    <small>{user.email}</small>
                  </span>
                </div>
                <NavLink to="/perfil">
                  <UserRound size={18} aria-hidden="true" /> Mi perfil
                </NavLink>
                <button type="button" className="nav-signout" onClick={signOut}>
                  <LogOut size={18} aria-hidden="true" /> Cerrar sesión
                </button>
              </>
            ) : (
              !loading && (
                <ButtonLink to="/mis-reservas" variant="secondary">
                  <LogIn size={18} /> Ingresar o crear cuenta
                </ButtonLink>
              )
            )}
            <ButtonLink to="/clases" className="nav-panel-cta">
              Reservar clase <ArrowRight size={16} />
            </ButtonLink>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="container field-error">
          No se pudo cerrar la sesión. Inténtalo de nuevo.
        </p>
      )}
    </header>
  );
}
