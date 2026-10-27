# Marca de TITAN GYM

- `titan-logo-original.png`: logo del casco proporcionado por el equipo como logo de TITAN GYM (PNG con transparencia). No se publica en la web.
- `titan-logo-limpio.png`: silueta en blanco sin el halo del original, generada por `tools/build-brand.py`.

Para regenerar todos los recursos (logo web, favicon, icono de iPhone e imagen para compartir):

```
python tools/build-brand.py branding/titan-logo-original.png
```

Los archivos generados son `public/assets/brands/titan-mark.png` (128 px), `public/favicon.svg` (transparente; blanco en tema oscuro y negro en tema claro), `public/favicon.png` (48 px, respaldo transparente con contorno), `public/apple-touch-icon.png` (180 px) y los íconos de la app instalable en `public/icons/` (192 y 512 px, más una versión con margen para Android).

La imagen para compartir el enlace (`public/og-image.png`, 1200 × 630) se genera con las tipografías y estilos de la web:

```
node tools/build-og-image.mjs
``` Para impresión o letreros conviene pedir al diseñador el logo en formato vectorial (SVG, AI o PDF).
