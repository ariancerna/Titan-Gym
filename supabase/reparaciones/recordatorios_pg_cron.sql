-- Recordatorios puntuales: Supabase dispara la tarea de GitHub cada 10 minutos.
--
-- Por qué: el cron de GitHub Actions ("cada 15 minutos") se retrasa o se salta en repositorios
-- gratuitos; hubo huecos de hasta 5 horas y recordatorios que llegaron 1 h 20 min antes de la clase
-- en vez de 3 h. pg_cron corre dentro de la base de datos y es puntual; pg_net hace la llamada
-- a la API de GitHub (workflow_dispatch), que inicia la tarea en segundos.
--
-- No es una migración: depende de este proyecto alojado y de un token. Se ejecuta UNA vez en
-- Supabase → SQL Editor. Pasos completos en docs/RECORDATORIOS.md.
--
-- 1. Reemplaza PEGA_AQUI_EL_TOKEN por tu token de GitHub (empieza con github_pat_).
--    Hazlo SOLO en el SQL Editor: no guardes el token en este archivo ni en el repositorio.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- El token queda cifrado en Supabase Vault, no en texto plano en la tarea.
select vault.create_secret('PEGA_AQUI_EL_TOKEN', 'github_recordatorios_token',
  'Token de GitHub para disparar la tarea de recordatorios');

-- Si se vuelve a ejecutar, cron.schedule reemplaza la tarea con el mismo nombre.
select cron.schedule('recordatorios-cada-10-min', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://api.github.com/repos/ariancerna/Titan-Gym/actions/workflows/recordatorios.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'github_recordatorios_token'),
      'Accept', 'application/vnd.github+json',
      'Content-Type', 'application/json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'titan-gym-recordatorios'),
    body := '{"ref": "main", "inputs": {"dry_run": "false"}}'::jsonb
  );
$$);

-- ── Comprobar (unos minutos después) ────────────────────────────────────────────────────────
-- Respuestas de GitHub: 204 = tarea iniciada; 401 = token inválido; 403/404 = sin permiso.
--   select created, status_code, content from net._http_response order by created desc limit 5;
-- Ejecuciones de la tarea programada:
--   select start_time, status, return_message from cron.job_run_details
--   order by start_time desc limit 5;
--
-- ── Cambiar el token (por ejemplo, cuando venza) ────────────────────────────────────────────
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'github_recordatorios_token'), 'NUEVO_TOKEN');
--
-- ── Desactivar ──────────────────────────────────────────────────────────────────────────────
--   select cron.unschedule('recordatorios-cada-10-min');
