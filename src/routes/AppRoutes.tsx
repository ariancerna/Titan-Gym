import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { LoadingState, EmptyState } from '../components/ui/States';
const Home = lazy(() => import('../pages/HomePage'));
const Catalog = lazy(() => import('../pages/CatalogPage'));
const Detail = lazy(() => import('../pages/DetailPage'));
const Booking = lazy(() => import('../pages/BookingPage'));
const Confirmation = lazy(() => import('../pages/ConfirmationPage'));
const Reservations = lazy(() => import('../pages/MyReservationsPage'));
const AuthCallback = lazy(() => import('../pages/AuthCallbackPage'));
const Admin = lazy(() => import('../pages/AdminPage'));
export function AppRoutes() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); document.querySelector<HTMLElement>('#main')?.focus({ preventScroll: true }); }, [location.pathname]);
  return <Suspense fallback={<LoadingState/>}><Routes><Route path="/" element={<Home/>}/><Route path="/clases" element={<Catalog/>}/><Route path="/clases/:id" element={<Detail/>}/><Route path="/reservar/:id" element={<Booking/>}/><Route path="/reserva-confirmada/:id" element={<Confirmation/>}/><Route path="/mis-reservas" element={<Reservations/>}/><Route path="/auth/confirm" element={<AuthCallback/>}/><Route path="/admin" element={<Admin/>}/><Route path="*" element={<EmptyState title="Página no encontrada" message="Esta dirección no existe en FitSmart Agenda." action/>}/></Routes></Suspense>;
}
