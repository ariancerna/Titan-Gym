import { readdir, copyFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
await mkdir('docs/evidencias',{recursive:true});
let count=0;
for(const dir of await readdir('test-results')) {
  const root=join('test-results',dir);
  if(!(await stat(root)).isDirectory())continue;
  const size=['desktop','tablet','mobile'].find(s=>dir.endsWith('-'+s));
  if(!size)continue;
  for(const file of await readdir(root))if(file.endsWith('.png')) {
    await copyFile(join(root,file),join('docs/evidencias',`${size}-${file}`));count++;
  }
}
console.log(`${count} capturas reales conservadas en docs/evidencias.`);
