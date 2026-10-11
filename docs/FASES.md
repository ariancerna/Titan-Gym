# Registro de fases

| Fase | Trabajo realizado y archivos principales | Comprobación y bloqueo |
| --- | --- | --- |
| 1 · Análisis | Repositorio inspeccionado: únicamente README vacío. Figma: seis frames y logo; Stitch: siete recursos. | Acceso Figma confirmado mediante contexto y screenshots; sin archivos de aplicación previos. |
| 2 · Sistema de diseño | `package.json`, lockfile, `vite.config.ts`, `tsconfig.json`, `src/styles/index.css`, UI/layout, `public/assets`, manifiesto de recursos. | Dependencias instaladas; recursos descargados; TypeScript y build aprobados al integrar las pantallas. |
| 3 · Pantallas | `src/pages`, `src/routes`, componentes de clases/reservas y app. | Navegación y flujo a 1440/768/390; capturas reales. Se corrigió el ancho del comprobante y la captura del detalle antes de que terminara de cargar. |
| 4 · Base de datos | `supabase/migrations/20261011213832_initial_schema.sql`, `supabase/seed.sql`, config y plantilla local de enlace. | Migración y seed ejecutados localmente y en el nuevo proyecto Supabase `cyufnolnnwaeacnyzpfy`; seis tablas con RLS. Docker local no pudo iniciar el motor. |
| 5 · Reservas | `src/features`, `src/lib/supabase`, AuthProvider, AuthGate, AuthCallbackPage y ReservationForm; RPC privada con wrapper público; `.env.local`. | Persistencia, aforo y RLS verificados también en SQL alojado con rollback. PostgREST real verificado. Acceso por enlace PKCE configurado sin pago; recepción de correo real pendiente con destinatario autorizado. |
| 6 · Calidad | `tests/unit`, `tests/integration`, `tests/e2e`, configuración Vitest/Playwright y `docs/PRUEBAS_APF2.md`. | 26 unitarias, 12 SQL y 51 de navegador aprobadas tras ajustar el acceso; cinco comprobaciones públicas y una negativa real de contraseña aprobadas. Creación/login positivo con contraseña alojada pendientes de entrada directa por propietario; fixtures no equivalen a esa validación. |
| 7 · Entrega | README, `.env.example`, arquitectura, backlog MoSCoW, despliegue, `vercel.json` y evidencia. | Build aprobado y auditoría de dependencias de producción sin vulnerabilidades reportadas. No hay URL pública verificada. |

Ningún proyecto existente fue modificado y no se enviaron mensajes a terceros. Se retiró un manifiesto de descarga duplicado creado durante esta implementación; el manifiesto utilizado permanece en `tools/assets-local.json` y los recursos descargados siguen disponibles.
