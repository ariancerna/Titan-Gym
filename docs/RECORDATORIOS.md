# Recordatorios por correo (HU07)

Cada socio recibe un correo **3 horas antes** de cada clase reservada, con la clase, el horario, la sala, su QR para recepción y un enlace para cancelar si no podrá asistir.

## Cómo funciona

1. Cada 10 minutos, Supabase (`pg_cron`) inicia la tarea `.github/workflows/recordatorios.yml` de GitHub Actions. La tarea también tiene un cron propio de GitHub, pero solo como respaldo (ver [Disparador puntual](#disparador-puntual-supabase-pg_cron)).
2. `tools/send-reminders.mjs` llama a `claim_reminders(3)`. La función devuelve las reservas confirmadas de clases que empiezan entre 15 minutos y 3 horas desde ese momento, y en la misma operación las marca con `reminder_sent_at`. Dos ejecuciones simultáneas nunca envían el mismo correo.
3. Se envía el correo por SMTP (Gmail) con el QR adjunto en línea. Si el envío falla, `release_reminder` deja la reserva pendiente para el siguiente intento.

No reciben recordatorio:
- las reservas canceladas;
- los socios que lo desactivaron en **Mi perfil → Recordatorio por correo**;
- los socios de demostración y los datos simulados de la exposición.

Las funciones solo pueden ejecutarse con la clave de servicio; socios y visitantes no tienen acceso. Los registros de GitHub Actions son públicos, por eso el script solo imprime cantidades: nunca nombres, correos ni códigos.

La misma tarea envía el aviso de **cupo asignado desde la lista de espera** (`claim_waitlist_notices`, ver [Lista de espera](LISTA_ESPERA.md)). Si esa migración todavía no está aplicada, deja una advertencia y no marca la ejecución como fallida.

También envía el aviso de **clase cancelada por el gimnasio** (`claim_cancellation_notices`, migración `20261023000000_panel_admin.sql`): un correo por reserva afectada con la clase, el horario y el motivo escrito por el administrador, sin QR. Se envía una sola vez por reserva y excluye los datos de demostración, igual que los recordatorios.

## Configuración (una sola vez)

1. Aplica `supabase/migrations/20261020000000_recordatorios.sql` en Supabase (SQL Editor) y regístrala en `supabase_migrations.schema_migrations`.
2. En GitHub → **Settings → Secrets and variables → Actions**, crea estos secretos:

| Secreto | Valor |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → clave `service_role` (o la clave *secret*). **No** la pongas en el código ni en `.env.local`. |
| `SMTP_USER` | El correo de Gmail que usa Supabase para enviar los correos. |
| `SMTP_PASS` | La contraseña de aplicación de esa cuenta: los 16 caracteres sin espacios. |

`SUPABASE_URL` ya existe (lo usa la tarea que mantiene activo Supabase).

3. Prueba en seco: GitHub → **Actions → Recordatorios de clases → Run workflow**, con "Prueba en seco" marcado. Muestra cuántos recordatorios hay pendientes, sin enviar nada.
4. Configura el [disparador puntual](#disparador-puntual-supabase-pg_cron).
5. Desde ese momento la tarea envía sola. Para probar un envío real, reserva una clase que empiece dentro de las próximas 3 horas con una cuenta tuya y espera hasta 10 minutos, o ejecuta el flujo sin marcar "Prueba en seco".

## Disparador puntual (Supabase pg_cron)

El cron de GitHub Actions no es confiable en repositorios gratuitos: GitHub retrasa o salta las ejecuciones programadas. El 20/10/2026 la tarea configurada «cada 15 minutos» corrió a las 12:52 y luego a las 16:09 (hora de Lima). Por eso el recordatorio de una clase de las 17:30 llegó a las 16:10, 1 h 20 min antes, en vez de 3 h antes. Hubo huecos de hasta 5 horas.

La solución es que Supabase dispare la tarea: `pg_cron` es puntual y `pg_net` llama a la API de GitHub (`workflow_dispatch`) cada 10 minutos. Así el correo sale entre 3 h y 2 h 50 min antes de la clase. No hace falta ningún servidor nuevo, y las ejecuciones manuales siguen funcionando.

1. **Token de GitHub:** GitHub → foto de perfil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - *Repository access:* **Only select repositories** → `ariancerna/Titan-Gym`.
   - *Permissions → Repository permissions → Actions:* **Read and write**. Nada más.
   - *Expiration:* hasta después de la evaluación (por ejemplo, 90 días).
   Este token solo puede iniciar o cancelar tareas de este repositorio; no puede cambiar el código.
2. **Supabase → SQL Editor:** pega [`supabase/reparaciones/recordatorios_pg_cron.sql`](../supabase/reparaciones/recordatorios_pg_cron.sql), reemplaza `PEGA_AQUI_EL_TOKEN` por el token y ejecútalo. El token queda cifrado en Supabase Vault. No lo guardes en el repositorio.
3. **Comprobar:** a los 10 minutos, en GitHub → **Actions → Recordatorios de clases** aparece una ejecución con el evento `workflow_dispatch`. En el SQL Editor, `select created, status_code from net._http_response order by created desc limit 5;` debe devolver `204`. Un `401` significa token inválido; un `403` o `404`, que le falta el permiso de Actions.

Al final del script están las consultas para cambiar el token cuando venza y para desactivar el disparador.

## Medición

El dataset incluye la columna `recordatorio_enviado`, y el panel de administración compara la tasa de no-shows **con y sin recordatorio**. Así se puede comprobar si los recordatorios reducen las inasistencias, el indicador principal del proyecto.
