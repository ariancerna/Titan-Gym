import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { LoadingState } from '../components/ui/States';
const Home = lazy(() => import('../pages/HomePage'));
const Catalog = lazy(() => import('../pages/CatalogPage'));
const Detail = lazy(() => import('../pages/DetailPage'));
const Booking = lazy(() => import('../pages/BookingPage'));
const Confirmation = lazy(() => import('../pages/ConfirmationPage'));
const Reservations = lazy(() => import('../pages/MyReservationsPage'));
const AuthCallback = lazy(() => import('../pages/AuthCallbackPage'));
const Admin = lazy(() => import('../pages/AdminPage'));
const ResetPassword = lazy(() => import('../pages/ResetPasswordPage'));
const Privacy = lazy(() => import('../pages/PrivacyPage'));
const NotFound = lazy(() => import('../pages/NotFoundPage'));
export function AppRoutes() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.querySelector<HTMLElement>('#main')?.focus({ preventScroll: true });
  }, [location.pathname]);
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/clases" element={<Catalog />} />
        <Route path="/clases/:id" element={<Detail />} />
        <Route path="/reservar/:id" element={<Booking />} />
        <Route path="/reserva-confirmada/:id" element={<Confirmation />} />
        <Route path="/mis-reservas" element={<Reservations />} />
        <Route path="/auth/confirm" element={<AuthCallback />} />
        <Route path="/restablecer-contrasena" element={<ResetPassword />} />
        <Route path="/privacidad" element={<Privacy />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
