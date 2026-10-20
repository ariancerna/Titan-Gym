-- Recordatorios puntuales: Supabase llama cada 10 minutos a la función de Vercel que envía los
-- correos (api/recordatorios.js).
--
-- Por qué: el cron de GitHub Actions ("cada 15 minutos") se retrasa o se salta en repositorios
-- gratuitos; hubo huecos de hasta 5 horas y un recordatorio llegó 1 h 20 min antes de la clase
-- en vez de 3 h. pg_cron corre dentro de la base de datos y es puntual; pg_net hace la llamada.
-- No usa cuentas ni tokens personales: solo una clave secreta del proyecto que genera este script.
--
-- No es una migración: depende del proyecto alojado. Se ejecuta UNA vez en Supabase → SQL Editor
-- y no hay que editar nada. Pasos completos en docs/RECORDATORIOS.md.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Clave secreta aleatoria (64 caracteres), guardada cifrada en Supabase Vault. Si ya existe,
-- se conserva la anterior para no desconfigurar Vercel.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'recordatorios_cron_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'recordatorios_cron_secret',
      'Clave que Supabase presenta a /api/recordatorios (CRON_SECRET en Vercel)');
  end if;
end $$;

-- Si se vuelve a ejecutar, cron.schedule reemplaza la tarea con el mismo nombre.
select cron.schedule('recordatorios-cada-10-min', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://titan-gym-tau.vercel.app/api/recordatorios',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'recordatorios_cron_secret'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);

-- Copia este valor en Vercel como CRON_SECRET (paso 2 de docs/RECORDATORIOS.md).
select decrypted_secret as cron_secret_para_vercel
from vault.decrypted_secrets where name = 'recordatorios_cron_secret';

-- ── Comprobar (unos minutos después) ────────────────────────────────────────────────────────
-- Respuestas de Vercel: 200 = correcto; 401 = CRON_SECRET distinto; 503 = faltan variables en
-- Vercel o falta volver a desplegar; 500 = falló el envío (revisa los registros de Vercel).
--   select created, status_code, content from net._http_response order by created desc limit 5;
--
-- ── Desactivar ──────────────────────────────────────────────────────────────────────────────
--   select cron.unschedule('recordatorios-cada-10-min');
