# FitSmart Agenda · TITAN GYM

Aplicación React para consultar sesiones, visualizar cupos y reservar con identidad verificada. Implementa las seis pantallas del MVP APF2 y usa los recursos originales consultados en Figma.

## Estado real de la entrega

Frontend conectado al proyecto Supabase **FitSmart Agenda TITAN GYM**, referencia `cyufnolnnwaeacnyzpfy`, organización Arian Dev, región São Paulo y plan gratuito. Migración, RLS y seed aplicados; ocho sesiones y 88 reservas académicas iniciales. `.env.local` contiene únicamente URL y clave pública y queda excluido de Git. **No publicado en Vercel.** El proyecto incluye `vercel.json`, build de producción y [pasos de despliegue](docs/DESPLIEGUE.md).

Acceso: correo y contraseña como primera opción; debajo, Google con logotipo oficial y PKCE. También se conserva enlace mágico. El propietario activó Google con el cliente OAuth de Nexo e informó acceso real exitoso por Google y correo; se verificaron configuración alojada, redirección e identidad Google confirmada. El envío de enlaces gratuitos está restringido al equipo y Audience Google requiere revisión antes de afirmar acceso público. Instrucciones: [Google Auth](docs/GOOGLE_AUTH.md).

«Crear contraseña» está en Mis reservas para cuentas autenticadas. No se fusionaron cuentas con correos diferentes ni cambiaron credenciales del propietario; la reserva anterior sigue guardada. La prueba real positiva de contraseña requiere su entrada directa en la aplicación; los casos positivos automáticos usan fixtures. Uso y límites: [Acceso con contraseña](docs/ACCESO_CONTRASENA.md).

Las pruebas de integración usan PostgreSQL 17.6 real en un clúster temporal independiente. Las pruebas de navegador usan el mismo SQL mediante un puente REST exclusivo de pruebas, con identidades de fixture. Ese puente no forma parte del build y no reemplaza Supabase Auth en producción. Los tests del enlace usan respuestas Auth controladas; no acreditan entrega real de correo.

Última ejecución: 26 unitarias, 12 SQL y 51 pruebas de navegador aprobadas; build aprobado y auditoría de producción con 0 vulnerabilidades reportadas. La evidencia pública omite rutas personales; las capturas administrativas se conservan solo localmente. Detalles y límites en `docs/PRUEBAS_APF2.md`.

## Inicio rápido

Requiere Node.js compatible con Vite 8 (se verificó con Node 24.18.0) y npm. Las versiones exactas están fijadas en `package.json` y `package-lock.json`.

```powershell
npm ci
# Solo en una instalación nueva: copia .env.example a .env.local y configura las variables.
# En este workspace .env.local ya existe: no lo sobrescribas.
npm run dev
```

Abre `http://127.0.0.1:5173`. La clave `VITE_SUPABASE_PUBLISHABLE_KEY` también admite una clave pública anon de un proyecto existente. Nunca uses service_role o una clave secret como variable VITE_.

## Conectar Supabase

1. Elige un proyecto dedicado a este MVP.
2. En un proyecto nuevo, aplica `supabase/migrations/20261011213832_initial_schema.sql` desde el editor SQL o mediante la CLI vinculada a ese proyecto. Ya está aplicada en el proyecto creado; no repetirla.
3. En una base de demostración vacía, ejecuta `supabase/seed.sql`. Incluye seis disciplinas, tres sedes, seis instructores, ocho sesiones futuras y ocupación real mediante reservas de identidades `.invalid` sin contraseñas. No ejecutes el seed en una base de socios reales.
4. Habilita el proveedor de correo y altas de usuarios. Mantén deshabilitado el acceso anónimo.
5. Mantén la plantilla predeterminada Magic Link. Configura Site URL y redirección exacta `http://127.0.0.1:5173/auth/confirm` (ya guardadas en este proyecto). Para demostrar sin gasto usa únicamente tu correo autorizado del equipo; para socios externos configura SMTP propio. Abre el enlace en el mismo navegador y dispositivo donde lo solicitaste.
6. Añade la URL y clave pública a `.env.local` y reinicia Vite.
7. Comprueba el recorrido de reserva y el aislamiento entre cuentas antes de usar datos reales.

Con Docker operativo también puedes ejecutar `npx supabase start` y consultar `npx supabase status`. En esta sesión Docker no pudo iniciar su motor; las pruebas SQL se ejecutaron con PostgreSQL independiente.

## Rutas

| Ruta | Función |
| --- | --- |
| `/` | Inicio y clases destacadas obtenidas del catálogo |
| `/clases` | Sesiones, búsqueda, filtros y ocupación |
| `/clases/:id` | Detalle de una sesión programada |
| `/reservar/:id` | Acceso verificado y formulario de reserva |
| `/reserva-confirmada/:id` | Comprobante consultado bajo RLS |
| `/mis-reservas` | Reservas propias y sección de historial |
| `/auth/confirm` | Intercambio PKCE y retorno seguro a reserva o cuenta |

Los parámetros `:id` de clases/reservar corresponden a **class_sessions.id**. El identificador de confirmación corresponde a **reservations.id**. Las clases generales están separadas de sus sesiones.

## Comprobaciones

```powershell
npm test
npm run test:db
npx playwright install chromium
npm run test:e2e
npm run build
npm audit --omit=dev
```

`test:db` inicializa su propio clúster temporal y no modifica proyectos alojados. `test:e2e` inicia un puente de pruebas en 54331 y Vite en 5173; ambos puertos deben estar libres. Las identidades de fixture son exclusivas de esas pruebas y nunca se usan al ejecutar `npm run dev` normalmente.

Resultados y límites: [Pruebas APF2](docs/PRUEBAS_APF2.md). Diseño y decisiones: [Arquitectura](docs/ARQUITECTURA.md). Alcance: [Product Backlog](docs/PRODUCT_BACKLOG.md). Configuración y publicación: [Despliegue](docs/DESPLIEGUE.md).

Comprobaciones públicas alojadas, sin escrituras ni envío de correo: `node tests/integration/hosted-public.mjs`. La prueba espera el seed original de ocho sesiones. Detalles de configuración: [Supabase alojado](docs/SUPABASE.md).

## Referencias visuales inspeccionadas

- [Figma original](https://www.figma.com/design/IdpjhkmQsR4wAKCOLNcfpG/Sin-t%C3%ADtulo?node-id=0-1): seis pantallas, logotipo, Oswald y Space Grotesk; fotografías y vectores descargados localmente.
- [Stitch](https://stitch.withgoogle.com/projects/2251858017399190487): siete recursos consultados, incluyendo las seis pantallas y el logo.

Las fotografías se mantienen en `public/assets`. `tools/assets-local.json` registra su procedencia y `tools/download-assets.mjs` permite repetir la descarga mientras las URLs temporales sigan vigentes. El sitio utiliza rutas locales, sin depender de esas URLs temporales.
