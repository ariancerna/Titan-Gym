# Supabase alojado · configuración real

Fecha: 11 de octubre de 2026.

Actualización administrativa: migración `20261011225309_admin_attendance` aplicada y RPC verificadas dentro de una transacción revertida. La versión local se alineó con el historial remoto para evitar duplicar su aplicación. Se conservaron las 89 reservas actuales. No hay todavía una cuenta administradora real asignada; requiere identificarla y autorizarla según [Administración](ADMINISTRACION.md). La asistencia y su historial de prueba no quedaron guardados en el proyecto alojado.

- Proyecto: FitSmart Agenda TITAN GYM.
- Organización: Arian Dev; referencia `cyufnolnnwaeacnyzpfy`.
- Región: `sa-east-1`, São Paulo. Plan Free; costo de creación informado y confirmado por el conector: US$0/mes.
- URL: https://cyufnolnnwaeacnyzpfy.supabase.co
- Panel: https://supabase.com/dashboard/project/cyufnolnnwaeacnyzpfy
- Migración remota registrada: `20261011213832_initial_schema`. El nombre del archivo local se alineó con esa versión para evitar aplicar otra vez el mismo esquema mediante db push.
- Seed cargado una sola vez: seis disciplinas, tres sedes, seis instructores, seis clases, ocho sesiones futuras y 88 reservas académicas. No son socios reales.
- RLS habilitado en las seis tablas; funciones privadas y wrappers públicos con permisos mínimos. No se modificaron los proyectos Nexo ni Donna.
- `.env.local` conectado usando la clave **publishable**, sin service_role ni contraseña administrativa. No se incluye en Git.

## Comprobado

PostgREST real devuelve las ocho sesiones y su aforo. Anon no puede leer reservas ni reservar. La configuración pública de Auth confirma Email y nuevas altas habilitados, confirmación de correo exigida y Anonymous Sign-ins deshabilitado.

Se verificaron persistencia, actualización de cupos, RLS, rechazo de duplicados y clase llena en una transacción SQL remota de prueba con rollback. El seed no se alteró. La prueba utilizó identidad académica asignada mediante acceso administrativo: no representa inicio de sesión OTP real.

Build de producción aprobado. `node tests/integration/hosted-public.mjs` permite repetir las comprobaciones públicas de solo lectura.

## Pendiente y bloqueos concretos

El propietario inició sesión en el panel. Se guardó y verificó Site URL `http://127.0.0.1:5173` y una redirección exacta a esa misma URL. Evidencia: `docs/evidencias/supabase-url-config.png`. El conector no modifica Auth/SMTP y la CLI no tiene access token; se utilizó la interfaz autenticada sin extraer credenciales.

El panel confirmó un bloqueo vigente del plan Free: sin SMTP propio, subject/body de Magic Link son de solo lectura. La plantilla predeterminada envía un enlace de acceso; el frontend fue adaptado para recibirlo. Según el [cambio del 3 de junio de 2026](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier), proyectos Free nuevos con SMTP predeterminado ya no pueden personalizar plantillas. No se activó SMTP vacío, no se contrataron planes ni se deshabilitó la confirmación de correo.

El propietario eligió adaptar el acceso al enlace mágico gratuito. Implementado: solicitud mediante signInWithOtp (nombre de API que también envía enlaces), flujo PKCE y `/auth/confirm` con exchangeCodeForSession y verificación getUser; retorno limitado a `/mis-reservas` o `/reservar/UUID`. Se limpia el código de URL/historial y no se registra. Redirección exacta `http://127.0.0.1:5173/auth/confirm` añadida y verificada en el panel; evidencia actualizada en `docs/evidencias/supabase-url-config.png`.

No se requiere SMTP propio para la demostración con el correo autorizado del propietario. Sigue pendiente comprobar recepción y acceso real con ese correo: los tests del protocolo usan fixtures, no envío real. Debe abrirse el enlace en el mismo navegador/dispositivo donde se pidió. Para socios externos hace falta SMTP propio; el servicio predeterminado tiene restricciones de destinatarios y tasa. No se añadieron socios a la organización, no se ampliaron privilegios, no se contrataron servicios y no se desactivó la verificación. Consulta la [documentación de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Advisors

El propietario informó acceso Google exitoso. La consulta de solo lectura confirmó una cuenta con identidad email y una reserva, y otra con identidad Google verificada y cero reservas; los correos son diferentes. No se registraron sus direcciones ni se fusionaron identidades. Se añadió login con contraseña y configuración de contraseña autenticada, sin cambios SQL ni de credenciales del propietario. La prueba negativa contra Auth alojado rechazó credenciales aleatorias sin conceder sesión. Ver `docs/ACCESO_CONTRASENA.md`.

El propietario informó que el enlace mágico funciona y después completó las credenciales Google directamente en el panel. La configuración pública real confirmó Google habilitado y la aplicación redirigió al selector oficial de cuentas. Falta que el propietario elija cuenta y complete consentimiento para verificar sesión/JWT y acceso externo. Se reutilizó el cliente Web de Nexo con nombre interno `Nexo · TITAN GYM` y ambos callbacks conservados. Ver `docs/GOOGLE_AUTH.md`. El agente no creó ni revocó secretos ni los guardó en código.

Seguridad: una advertencia de **Leaked Password Protection Disabled**. El producto utiliza enlace mágico, no contraseñas, pero debe revisarse si se agrega acceso con contraseña; ver [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No se activó un plan de pago para resolverla.

Rendimiento: seis avisos informativos de índices sin uso en un proyecto recién creado. Se conservaron los índices de propietarios, horarios y claves foráneas; no es evidencia suficiente para eliminarlos. [Explicación del advisor](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

No se ha publicado el frontend en Vercel ni verificado una URL pública de la aplicación.
