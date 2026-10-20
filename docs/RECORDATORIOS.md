# Recordatorios por correo (HU07)

Cada socio recibe un correo **3 horas antes** de cada clase reservada, con la clase, el horario, la sala, su QR para recepción y un enlace para cancelar si no podrá asistir.

## Cómo funciona

1. Cada 10 minutos, Supabase (`pg_cron`) llama a la función de Vercel `/api/recordatorios`. La tarea `.github/workflows/recordatorios.yml` de GitHub Actions hace lo mismo como respaldo (ver [Disparador puntual](#disparador-puntual-supabase-pg_cron--vercel)).
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
4. Configura el [disparador puntual](#disparador-puntual-supabase-pg_cron--vercel).
5. Desde ese momento la tarea envía sola. Para probar un envío real, reserva una clase que empiece dentro de las próximas 3 horas con una cuenta tuya y espera hasta 10 minutos, o ejecuta el flujo sin marcar "Prueba en seco".

## Disparador puntual (Supabase pg_cron + Vercel)

El cron de GitHub Actions no es confiable en repositorios gratuitos: GitHub retrasa o salta las ejecuciones programadas. El 20/10/2026 la tarea configurada «cada 15 minutos» corrió a las 12:52 y luego a las 16:09 (hora de Lima). Por eso el recordatorio de una clase de las 17:30 llegó a las 16:10, 1 h 20 min antes, en vez de 3 h antes. Hubo huecos de hasta 5 horas.

Ahora el envío lo hace la función de Vercel [`api/recordatorios.js`](../api/recordatorios.js), que se despliega junto con la web, y Supabase la llama cada 10 minutos con `pg_cron` y `pg_net`, que son puntuales. Así el correo sale entre 3 h y 2 h 50 min antes de la clase. La función solo responde a quien presenta la clave secreta `CRON_SECRET` y devuelve cantidades, nunca datos personales. No usa cuentas ni tokens personales. La lógica de envío es la misma ([`tools/reminders-job.mjs`](../tools/reminders-job.mjs)) y GitHub Actions sigue como respaldo; como cada reserva se marca al reclamarla, no hay correos duplicados.

1. **Supabase → SQL Editor:** ejecuta [`supabase/reparaciones/recordatorios_pg_cron.sql`](../supabase/reparaciones/recordatorios_pg_cron.sql) tal cual. Activa `pg_cron` y `pg_net`, genera la clave secreta, la guarda cifrada en Vault, programa la llamada cada 10 minutos y al final muestra la clave (`cron_secret_para_vercel`).
2. **Vercel → proyecto → Settings → Environment Variables** (entorno *Production*). Agrega:

| Variable | Valor |
| --- | --- |
| `CRON_SECRET` | La clave que mostró el paso 1. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` (o la clave *secret*). **Sin** el prefijo `VITE_`: con ese prefijo quedaría expuesta en la web. |
| `SMTP_USER` | El Gmail que envía los correos. |
| `SMTP_PASS` | Su contraseña de aplicación (16 caracteres, sin espacios). |

   `VITE_SUPABASE_URL` ya existe en Vercel y la función la reutiliza.
3. **Vercel → Deployments → el último → Redeploy.** Las variables nuevas solo se aplican en un despliegue nuevo.
4. **Comprobar** a los 10 minutos en el SQL Editor: `select created, status_code, content from net._http_response order by created desc limit 5;`. Un `200` con las cantidades es correcto; `401` = la clave de Vercel no coincide; `503` = falta una variable o el redespliegue.

Para desactivarlo: `select cron.unschedule('recordatorios-cada-10-min');`.

## Medición

El dataset incluye la columna `recordatorio_enviado`, y el panel de administración compara la tasa de no-shows **con y sin recordatorio**. Así se puede comprobar si los recordatorios reducen las inasistencias, el indicador principal del proyecto.
