import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { AppRoutes } from '../routes/AppRoutes';
import { AssistantLauncher } from '../components/assistant/AssistantLauncher';
export function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <Navbar />
      <main id="main" tabIndex={-1}>
        <AppRoutes />
      </main>
      <Footer />
      <AssistantLauncher />
    </>
  );
}
