// Genera public/og-image.png (1200 × 630), la vista previa al compartir el enlace por WhatsApp,
// Facebook o X. Dibuja una página con las mismas tipografías y estilos de la web y la captura.
// Uso: node tools/build-og-image.mjs
// Si Chromium no está en la ruta por defecto de Playwright: PW_CHROMIUM=/ruta/a/chrome node …
import { chromium } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const file = (p) => pathToFileURL(join(root, p)).href;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@font-face{font-family:Anton;src:url(${file('node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2')})}
@font-face{font-family:ArchivoNarrow;font-weight:400 700;src:url(${file('node_modules/@fontsource-variable/archivo-narrow/files/archivo-narrow-latin-wght-normal.woff2')})}
@font-face{font-family:Archivo;font-weight:100 900;src:url(${file('node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2')})}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;background:#0a0a0c;color:#f4f1ea;font-family:Archivo,sans-serif;position:relative}
.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 40%;
  filter:hue-rotate(215deg) saturate(1.2) contrast(1.12) brightness(.55)}
.shade{position:absolute;inset:0;background:
  radial-gradient(55% 75% at 85% 30%,#8b3dff55 0%,transparent 70%),
  linear-gradient(90deg,#0a0a0cf5 0%,#0a0a0cc0 50%,#0a0a0c40 100%)}
.content{position:absolute;left:72px;top:64px;right:72px}
.kicker{display:flex;gap:14px;align-items:center;font:600 22px ArchivoNarrow;letter-spacing:.2em;text-transform:uppercase}
.kicker b{background:#8b3dff;color:#fff;padding:5px 12px;font-weight:600}
.kicker span{color:#a3a1a8}
h1{font:400 172px/.9 Anton;text-transform:uppercase;margin-top:26px}
h1 .best{display:block;color:#8b3dff;filter:drop-shadow(0 0 40px #8b3dff88)}
p{margin-top:22px;font-size:30px;color:#d9d6de;max-width:640px}
.logo{position:absolute;right:84px;top:118px;width:250px;opacity:.95}
.band{position:absolute;left:-40px;right:-40px;bottom:30px;height:66px;background:#8b3dff;transform:rotate(-1.6deg);
  display:flex;align-items:center;gap:30px;padding-left:80px;font:400 34px Anton;text-transform:uppercase;color:#fff;white-space:nowrap}
.band i{font-style:normal;color:#0a0a0c;font-size:22px}
</style></head><body>
<img class="photo" src="${file('public/assets/generated/hero.jpg')}" alt="">
<div class="shade"></div>
<img class="logo" src="${file('branding/titan-logo-limpio.png')}" alt="">
<div class="content">
  <div class="kicker"><b>TITAN GYM QATUNA</b><span>Carabayllo · Lima Norte</span></div>
  <h1>Wake the<span class="best">Best</span></h1>
</div>
<div class="band">${['Spinning', 'HIIT', 'Funcional', 'Cross Training', 'Zumba', 'Yoga', 'Spinning'].map((d) => `${d}<i>✦</i>`).join('')}</div>
</body></html>`;

const dir = await mkdtemp(join(tmpdir(), 'og-'));
const page = join(dir, 'og.html');
await writeFile(page, html);
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await tab.goto(pathToFileURL(page).href);
await tab.evaluate(() => document.fonts.ready);
await tab.screenshot({ path: join(root, 'public/og-image.png') });
await browser.close();
await rm(dir, { recursive: true });
// WhatsApp a veces omite vistas previas de más de ~300 KB: se reduce a 256 colores con Pillow.
try {
  execFileSync('python3', [
    '-c',
    "import sys;from PIL import Image as I;p=sys.argv[1];I.open(p).convert('RGB').quantize(256,method=I.Quantize.MEDIANCUT,dither=I.Dither.FLOYDSTEINBERG).save(p,optimize=True)",
    join(root, 'public/og-image.png'),
  ]);
} catch {
  console.warn('No se pudo comprimir (falta python3 con Pillow); la imagen queda sin reducir.');
}
console.log('public/og-image.png generada');
