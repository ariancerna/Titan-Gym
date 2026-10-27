import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './app/AuthProvider';
import { App } from './app/App';
import '@fontsource/anton/latin-400.css';
import '@fontsource-variable/archivo/index.css';
import '@fontsource-variable/archivo-narrow/index.css';
import './styles/index.css';
import './styles/brand.css';
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10000, retry: 1, refetchOnWindowFocus: true } },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
