# Administración y asistencia

El módulo `/admin` permite gestionar clases generales, sesiones, inscritos y asistencia. Mantiene la identidad visual y funciona en escritorio, tablet y móvil. Su acceso admite correo y contraseña o Google; el permiso se decide en PostgreSQL, no por el método de login.

## Primera cuenta administradora

No hay una cuenta predeterminada ni una contraseña publicada. El seed no asigna roles. La primera cuenta real está pendiente de identificación por el propietario.

1. El responsable indica qué cuenta verificada debe recibir el rol. Si todavía no existe, su titular debe iniciar sesión con Google y configurar su contraseña desde Mi perfil.
2. Un operador de confianza comprueba la cuenta en el editor SQL de Supabase. Sustituye el correo de ejemplo por el aprobado; no ejecutes estos comandos desde el frontend:

```sql
select id, email, email_confirmed_at
from auth.users
where lower(email) = lower('CORREO_APROBADO')
  and email_confirmed_at is not null
  and not coalesce(is_anonymous, false);
```

3. Tras verificar el resultado y su titular, asigna el UUID exacto aprobado:

```sql
insert into private.administrators(user_id)
values ('UUID_VERIFICADO')
on conflict (user_id) do nothing;
```

4. El titular accede a `/admin` con su correo y contraseña. No comparta la contraseña con el agente ni la guarde en el repositorio.
5. Para revocar el permiso desde el mismo entorno privilegiado:

```sql
delete from private.administrators where user_id = 'UUID_VERIFICADO';
```

La siguiente operación administrativa se rechaza inmediatamente; no depende de renovar claims del JWT. La interfaz puede conservar contenido ya visto hasta la próxima consulta o cambio de identidad, pero no puede ejecutar nuevas operaciones autorizadas.

## Gestión del catálogo

- **Nueva clase:** nombre, descripción, disciplina y fotografía del catálogo. Ahora incluye imágenes ilustrativas generadas a petición del propietario. No se implementó carga de imágenes nuevas desde el formulario.
- **Nueva sesión:** clase, instructor, sede, sala, fecha/hora de Lima, duración de 10–240 minutos, capacidad de 1–500 y publicación.
- Las reservas se abren 7 días antes de cada clase: el catálogo muestra solo las sesiones publicadas de los próximos 7 días y la base de datos rechaza reservas anteriores (`BOOKING_NOT_OPEN`). El panel muestra todas, para programar con anticipación.
- Las sesiones futuras publicadas aparecen en el catálogo con aforo calculado por SQL. Los borradores solo aparecen en administración.
- Las sesiones con reservas conservan clase, instructor, sede, sala, horario, duración y publicación. Solo se admite modificar la capacidad de una sesión futura, sin reducirla por debajo de las reservas activas.
- No se implementó borrado ni cancelación de sesiones. La interfaz no permite editar sesiones pasadas.
- La restricción de sala/horario evita inicios idénticos en una sala; no detecta solapamiento de intervalos.

## Registro de llegada con QR

Cada comprobante muestra un QR con el código corto de la reserva (`TG-` + 6 caracteres, sin 0/O ni 1/I). El QR no contiene nombre ni correo.

En `/admin`, la sección **Registrar llegada** abre la cámara del dispositivo (requiere HTTPS y permiso del navegador) o acepta el código escrito a mano. La función `admin_check_in`:

- solo funciona para administradores;
- acepta la llegada desde 1 hora antes del inicio hasta el final de la sesión;
- marca la asistencia como **Presente** con el mismo historial auditado que la lista de inscritos;
- si se escanea dos veces, responde "Ya estaba registrado" sin duplicar el historial;
- rechaza reservas canceladas y códigos inexistentes.

Fuera de ese horario, o para marcar **Ausente**, se usa **Ver inscritos**.

## Inscritos y asistencia

**Ver inscritos** consulta las reservas de una sesión, no un padrón general de membresías. Devuelve nombre, correo, código y estado exclusivamente al administrador autorizado.

La asistencia se habilita al comenzar la sesión: **Pendiente**, **Presente** o **Ausente**. No se admite para reservas canceladas. Cada corrección agrega estado anterior, nuevo estado, `auth.uid()` del administrador y timestamp al historial. Repetir el mismo estado no duplica el historial.

La asistencia se guarda en `public.attendance`, separada de `reservations.status`: una ausencia no cancela reservas ni libera artificialmente cupos. El historial vive en `private.attendance_history`. No se implementaron recordatorios ni estadísticas de inasistencia.

## Correo, SMTP y altas manuales

Correo/contraseña y enlace por correo son métodos de autenticación de una cuenta, no roles distintos. SMTP es el servicio que entrega enlaces, invitaciones y recuperación: [documentación oficial](https://supabase.com/docs/guides/auth/auth-smtp).

Crear una cuenta manualmente en **Authentication → Users** no le concede el rol de esta aplicación. Añadirla al equipo de la organización Supabase tampoco: ese equipo administra el proyecto y no debe utilizarse como padrón de empleados del gimnasio solo para eludir restricciones de correo.

Recomendación: socios mediante Google; administradores elegidos explícitamente, con correo/contraseña para su entrada. Las contraseñas existentes de socios no se convierten en privilegios. Para automatizarlo, una futura operación protegida del servidor puede crear la cuenta mediante [Auth Admin](https://supabase.com/docs/reference/javascript/auth-admin-createuser) y asignar el rol tras verificar el titular. Esa automatización todavía no está implementada; no se modificaron roles existentes.

Para la demostración sin contratar SMTP, el administrador puede verificar su cuenta con Google una vez, configurar su propia contraseña y recibir la asignación de rol aprobada. Para invitaciones y recuperación por correo a otros destinatarios se necesita envío configurado.

## Protección del módulo

La migración `20261011225309_admin_attendance.sql` incorpora:

- `private.administrators`, sin privilegios del navegador; verificación de usuario confirmado y no anónimo en `private.is_admin()`.
- RPC `admin_snapshot`, `admin_roster`, `admin_save_class`, `admin_save_session` y `admin_set_attendance`. Sus implementaciones privilegiadas viven en `private`, con `search_path=''`, verificación de rol en cada llamada y fachadas públicas invoker.
- RLS en las nuevas tablas y prohibición de escrituras directas del cliente. El actor se obtiene del servidor.
- Caché administrativa por usuario, eliminada al cambiar la identidad.

No se autoriza mediante `user_metadata`, roles enviados por React ni claves service_role del frontend. Un socio con contraseña sigue siendo socio. Un administrador autorizado que ya tenga una sesión Google conserva su rol: el proveedor no reemplaza la autorización.

## Verificación

La última ejecución incluye 31 unitarias, 25 comprobaciones PostgreSQL y 78 de navegador en tres tamaños, además de build y auditoría de producción. Se verifican creación/publicación/persistencia, rechazo de socios y anónimos, metadata falsificada, aforo, asistencia futura bloqueada, historial, actor, revocación, cierre de sesión, recursos y sede única.

La migración se aplicó al Supabase alojado. Una transacción sobre una identidad académica comprobó rol, clase/sesión/reserva, inscritos, dos cambios de asistencia, actor y revocación. Tras rollback quedaron 89 reservas, ningún administrador, ningún registro de asistencia ni historial de prueba. No se cambiaron credenciales ni reservas reales.

El navegador utiliza Auth de fixture y SQL real independiente; no acredita un login administrativo real por contraseña. Ese control queda pendiente de autorizar la cuenta elegida y de que su titular introduzca sus credenciales.

Advisors alojados: sin errores; advertencia existente de [protección de contraseñas filtradas deshabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Dos [avisos informativos de RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) corresponden deliberadamente a tablas privadas sin acceso del navegador. Los índices iniciales sin uso se conservan para claves foráneas e historial.
