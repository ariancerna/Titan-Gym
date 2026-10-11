import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
const assets = JSON.parse(await readFile(new URL('./assets-local.json', import.meta.url), 'utf8'));
for (const asset of assets) {
  await mkdir(dirname(asset.path), { recursive: true });
  try { if ((await stat(asset.path)).size) continue; } catch {}
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error(`${asset.path}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('Recurso vacío');
  await writeFile(asset.path, bytes);
}
console.log(`${assets.length} recursos originales descargados.`);
