import { readFile, writeFile } from 'node:fs/promises';

// Normalización mecánica del informe, sin alterar resultados, fechas ni pruebas.
const path = 'docs/evidencias/playwright-results.json';
const raw = await readFile(path, 'utf8');
const original = JSON.parse(raw);
const root = process.cwd();
function sanitize(value) {
  if (typeof value === 'string') return value.replaceAll(root, '<workspace>').replaceAll(root.replaceAll('\\', '/'), '<workspace>');
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  return value;
}
// El informe original queda solo local, excluido del repositorio público.
await writeFile('docs/evidencias/playwright-results.private.json', raw);
await writeFile(path, JSON.stringify(sanitize(original), null, 2) + '\n');
console.log('Informe público normalizado: rutas personales sustituidas por <workspace>; resultados intactos.');
