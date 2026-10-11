# Despliegue en Vercel y Supabase

Estado: Supabase creado, migrado y conectado; Vercel preparado, **no publicado**. El proyecto dedicado es `cyufnolnnwaeacnyzpfy`. Consulta [el registro real de configuración](SUPABASE.md). No se ha verificado una URL pública del frontend.

## Supabase

1. Ya existe un proyecto dedicado en Arian Dev: FitSmart Agenda TITAN GYM. Los pasos de migración y seed siguientes son solo para otro proyecto nuevo; no repetirlos en el existente.
2. Aplica la migración versionada desde SQL Editor. Alternativa CLI: `npx supabase login`, `npx supabase link --project-ref TU_REF` y `npx supabase db push`. Consulta `--help` de la versión instalada antes de usar flags adicionales. Revisa la lista de migraciones antes de aplicar cambios a una base existente.
3. Ejecuta `supabase/seed.sql` solo en una base de demostración vacía. No es idempotente: si ya se aplicó, no lo ejecutes otra vez ni borres datos para forzarlo. Las fechas se basan en el día de ejecución. Para una demostración posterior, programa nuevas sesiones mediante acceso administrativo.
4. En Data API deja expuesto `public`, mantén `private` sin exponer y habilita las RPC. La migración concede SELECT de catálogo a anon/authenticated, SELECT propio de reservas a authenticated y EXECUTE de la RPC de reserva solo a authenticated.
5. En Authentication, habilita Email y nuevas altas. Deshabilita Anonymous Sign-ins. Configura Site URL para la URL local/pública correcta.
6. Mantén la plantilla Magic Link predeterminada: la aplicación utiliza enlace mágico con PKCE. Site URL y redirección exacta `http://127.0.0.1:5173/auth/confirm` ya están guardadas. No habilites comodines amplios. La plantilla local usa `{{ .ConfirmationURL }}`; no es necesario subirla al proyecto gratuito.
7. Para una demostración sin pago, usa un correo ya autorizado del equipo. No invites socios/evaluadores a la organización para recibir correos: eso concede acceso administrativo ajeno al MVP. Para usuarios externos, configura SMTP propio. El servicio predeterminado tiene restricciones de destinatarios, tasa y entrega. Sigue la [documentación de SMTP](https://supabase.com/docs/guides/auth/auth-smtp) y [enlaces mágicos](https://supabase.com/docs/guides/auth/auth-email-passwordless).
8. Ejecuta los advisors de seguridad del proyecto. Comprueba RLS en las seis tablas y que no existan políticas/permisos adicionales heredados que otorguen escrituras.

La identidad se obtiene de Supabase Auth. No hay contraseñas de socios en el seed ni claves de servicio en React. Para desarrollo local con Docker, `supabase/config.toml` incluye puerto 5173, confirmación de correo y plantilla de enlace; Mailpit permite inspeccionar los correos locales.

## Variables del frontend

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL HTTPS del proyecto correcto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública publishable, o anon heredada |

Configúralas en `.env.local` para desarrollo y en Vercel para los entornos Preview/Production apropiados. Los valores VITE_ son públicos. Nunca pongas service_role, secret, contraseña PostgreSQL o tokens administrativos en esas variables. No compartas el proyecto de producción con el puente REST de pruebas.

## Vercel

1. Repositorio destinado al proyecto: https://github.com/ariancerna/Titan-Gym. Se inicializó Git independiente dentro de esta carpeta, sin incluir archivos del repositorio padre del escritorio. El código se prepara para subir por solicitud explícita del propietario. `.env.local`, cachés y capturas administrativas quedan excluidos; esas capturas permanecen solo como evidencia local.
2. Importa el repositorio en Vercel y selecciona el directorio del proyecto como raíz si procede.
3. Usa preset Vite, `npm run build` y salida `dist`. Selecciona una versión Node compatible (24.x fue la utilizada aquí).
4. Configura las dos variables antes de generar el build. Vite las incorpora al compilar, por lo que cambiar variables requiere un nuevo despliegue.
5. `vercel.json` configura rutas SPA y cabeceras básicas; los recursos `/assets/` conservan sus rutas propias.
6. Despliega y comprueba la URL que Vercel genere. Actualiza Site URL en Supabase y añade la redirección exacta `https://TU_HOST/auth/confirm`. Solicita y abre el enlace mágico en el mismo navegador/dispositivo. No compartas el enlace ni el código de la URL.

## Verificación desde ventana privada

Abre la URL real sin sesión previa. Verifica inicio, logotipo y fotografías; accede directamente a `/clases` y recarga esa ruta. Confirma cupos contra SQL. Solicita el enlace a un correo controlado autorizado y ábrelo en esa misma ventana privada (abrirlo en otro perfil pierde el verificador PKCE). Reserva una sesión abierta. Recarga el comprobante y verifica la fila en reservations. Comprueba el descuento de un cupo y Mis reservas.

Desde otra ventana privada y otra cuenta, intenta consultar el UUID de la primera reserva: no debe aparecer. Comprueba el bloqueo de una sesión llena. Revisa los tamaños 1440, 768 y 390 px y posibles errores en consola/red. Registra los resultados reales y la URL verificada en la evidencia académica; solo entonces declara el sitio publicado.

No se han ejecutado estos pasos contra una URL pública durante esta entrega.

## Contraseña de una cuenta existente

El proveedor Email ya está habilitado; no cambiar Confirm email ni Anonymous Sign-ins para admitir contraseñas. Una vez autenticado con Google/enlace, el propietario configura la contraseña dentro de Mis reservas, directamente y sin compartirla con el agente. Después prueba cerrar sesión e iniciar con el mismo correo y contraseña. El formulario de la app exige 12–128 caracteres; revisar aparte la política de servidor y reautenticación antes de producción. No hay signUp público ni recuperación por correo terminados. La protección de contraseñas filtradas del advisor permanece deshabilitada en Free; no se contrató Pro. Véase `ACCESO_CONTRASENA.md`.
