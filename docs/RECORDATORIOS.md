# Recordatorios por correo (HU07)

Cada socio recibe un correo **3 horas antes** de cada clase reservada, con la clase, el horario, la sala, su QR para recepción y un enlace para cancelar si no podrá asistir.

## Cómo funciona

1. `.github/workflows/recordatorios.yml` se ejecuta cada 15 minutos en GitHub Actions.
2. `tools/send-reminders.mjs` llama a `claim_reminders(3)`. La función devuelve las reservas confirmadas de clases que empiezan entre 15 minutos y 3 horas desde ese momento, y en la misma operación las marca con `reminder_sent_at`. Dos ejecuciones simultáneas nunca envían el mismo correo.
3. Se envía el correo por SMTP (Gmail) con el QR adjunto en línea. Si el envío falla, `release_reminder` deja la reserva pendiente para el siguiente intento.

No reciben recordatorio:
- las reservas canceladas;
- los socios que lo desactivaron en **Mis reservas → Recordatorio por correo**;
- los socios de demostración y los datos simulados de la exposición.

Las funciones solo pueden ejecutarse con la clave de servicio; socios y visitantes no tienen acceso. Los registros de GitHub Actions son públicos, por eso el script solo imprime cantidades: nunca nombres, correos ni códigos.

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
4. Desde ese momento la tarea envía sola. Para probar un envío real, reserva una clase que empiece dentro de las próximas 3 horas con una cuenta tuya y espera hasta 15–30 minutos, o ejecuta el flujo sin marcar "Prueba en seco".

## Medición

El dataset incluye la columna `recordatorio_enviado`, y el panel de administración compara la tasa de no-shows **con y sin recordatorio**. Así se puede comprobar si los recordatorios reducen las inasistencias, el indicador principal del proyecto.
