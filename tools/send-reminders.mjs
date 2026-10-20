// Respaldo en GitHub Actions de los recordatorios por correo (.github/workflows/recordatorios.yml).
// El disparador principal es la función de Vercel /api/recordatorios; la lógica está en
// tools/reminders-job.mjs. Con --dry-run solo cuenta los pendientes: no envía ni los marca.
import { missingConfig, runReminders } from './reminders-job.mjs';

const dryRun = process.argv.includes('--dry-run');
const missing = missingConfig(process.env, dryRun);
if (missing.length) {
  // Sin configurar no es un error: evita una alerta de fallo en cada ejecución.
  console.log(`::warning::Recordatorios sin configurar. Faltan los secretos: ${missing.join(', ')}`);
  process.exit(0);
}
const { ok } = await runReminders({ env: process.env, dryRun });
process.exit(ok ? 0 : 1);
