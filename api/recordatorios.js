// Función de Vercel: envía los recordatorios y avisos por correo pendientes.
// Supabase la llama cada 10 minutos con pg_cron (supabase/reparaciones/recordatorios_pg_cron.sql).
// Solo responde a quien presenta CRON_SECRET; la respuesta trae cantidades, nunca datos personales.
import { timingSafeEqual } from 'node:crypto';
import { missingConfig, runReminders } from '../tools/reminders-job.mjs';

/** Compara en tiempo constante para no filtrar el secreto por el tiempo de respuesta. */
function sameSecret(given, expected) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createHandler(run = runReminders, env = process.env) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Usa POST.' });
    }
    const secret = env.CRON_SECRET;
    if (!secret || secret.length < 32) {
      return res.status(503).json({ error: 'Falta configurar CRON_SECRET en Vercel.' });
    }
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ') || !sameSecret(header.slice(7), secret)) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    const dryRun = req.query?.dry_run === '1';
    const missing = missingConfig(env, dryRun);
    if (missing.length) {
      return res.status(503).json({ error: `Faltan variables en Vercel: ${missing.join(', ')}` });
    }
    try {
      const { ok, summary } = await run({ env, dryRun });
      return res.status(ok ? 200 : 500).json(summary);
    } catch (error) {
      console.error('Recordatorios:', error instanceof Error ? error.message : error);
      return res.status(500).json({ error: 'Falló la tarea de recordatorios.' });
    }
  };
}

export default createHandler();
