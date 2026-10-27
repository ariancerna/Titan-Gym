"""Genera los recursos de marca de TITAN GYM a partir del logo original (casco blanco).

El original tiene un halo gris irregular alrededor del casco que a tamaño de favicon se ve
como manchas. Aquí se reconstruye una silueta limpia en blanco y se exportan:
  public/assets/brands/titan-mark.png  128 px, transparente (navegación, pie, correos)
  public/favicon.svg                    casco transparente que cambia de color con el tema
                                        (blanco en tema oscuro, negro en tema claro)
  public/favicon.png                    48 px de respaldo: casco blanco con contorno oscuro
  public/apple-touch-icon.png          180 px, fondo negro (pantalla de inicio de iPhone)
  public/icons/icon-192.png            192 px, fondo negro (app instalada en Android)
  public/icons/icon-512.png            512 px, fondo negro (pantalla de bienvenida de la app)
  public/icons/icon-maskable-512.png   512 px con margen amplio: Android lo recorta en círculo
  branding/titan-logo-limpio.png       versión grande y limpia para otros usos

Uso: python tools/build-brand.py branding/titan-logo-original.png

La imagen para compartir (public/og-image.png) se genera aparte con tools/build-og-image.mjs,
que usa las mismas tipografías y estilos de la web.
"""
import base64
import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

BLACK = (10, 10, 12, 255)  # #0a0a0c, fondo de la web


def clean_silhouette(original: Image.Image) -> Image.Image:
    """Máscara del casco sin halo: blanco y opaco en el original, con el relieve rellenado."""
    rgba = np.asarray(original.convert('RGBA')).astype(np.float32)
    luminance = rgba[..., :3].mean(axis=-1)
    solid = (rgba[..., 3] > 128) & (luminance > 165)
    mask = Image.fromarray((solid * 255).astype(np.uint8), 'L')
    mask = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))  # cierra el relieve
    mask = mask.filter(ImageFilter.MedianFilter(9))  # elimina las motas del halo
    mask = mask.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))  # quita restos finos
    # Suaviza el contorno: desenfoque + umbral elimina las irregularidades pequeñas del borde,
    # y un desenfoque leve final deja el borde antialiasado.
    mask = mask.filter(ImageFilter.GaussianBlur(6)).point(lambda v: 255 if v > 128 else 0)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    return mask.crop(mask.getbbox())


def white_logo(mask: Image.Image) -> Image.Image:
    logo = Image.new('RGBA', mask.size, (255, 255, 255, 0))
    logo.putalpha(mask)
    return logo


def fit(logo: Image.Image, box: int) -> Image.Image:
    """Escala el logo para que entre en un cuadrado de `box` px manteniendo la proporción."""
    scale = box / max(logo.size)
    size = (max(1, round(logo.size[0] * scale)), max(1, round(logo.size[1] * scale)))
    return logo.resize(size, Image.Resampling.LANCZOS)


def centered(logo: Image.Image, size: int, padding: float, background=None, radius=0) -> Image.Image:
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    if background:
        tile = Image.new('L', (size, size), 0)
        ImageDraw.Draw(tile).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
        canvas.paste(Image.new('RGBA', (size, size), background), (0, 0), tile)
    inner = fit(logo, round(size * (1 - 2 * padding)))
    canvas.alpha_composite(inner, ((size - inner.width) // 2, (size - inner.height) // 2))
    return canvas


def outlined(logo: Image.Image, size: int, padding: float, outline: int) -> Image.Image:
    """Casco blanco con contorno oscuro: visible sobre pestañas claras y oscuras."""
    inner = fit(logo, round(size * (1 - 2 * padding)))
    alpha = inner.getchannel('A')
    border = alpha.filter(ImageFilter.MaxFilter(outline * 2 + 1))
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    offset = ((size - inner.width) // 2, (size - inner.height) // 2)
    dark = Image.new('RGBA', inner.size, BLACK)
    dark.putalpha(border)
    canvas.alpha_composite(dark, offset)
    canvas.alpha_composite(inner, offset)
    return canvas


def adaptive_svg(logo: Image.Image) -> str:
    """Favicon SVG transparente: el navegador elige blanco o negro según su tema."""
    buffer = io.BytesIO()
    centered(logo, 64, 0.04).save(buffer, format='PNG', optimize=True)
    data = base64.b64encode(buffer.getvalue()).decode()
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<style>image{filter:brightness(0)}'
        '@media (prefers-color-scheme: dark){image{filter:none}}</style>'
        f'<image width="64" height="64" href="data:image/png;base64,{data}"/></svg>'
    )


def main():
    root = Path(__file__).resolve().parent.parent
    original = Image.open(sys.argv[1])
    logo = white_logo(clean_silhouette(original))
    logo.save(root / 'branding' / 'titan-logo-limpio.png', optimize=True)
    centered(logo, 128, 0.06).save(root / 'public/assets/brands/titan-mark.png', optimize=True)
    (root / 'public/favicon.svg').write_text(adaptive_svg(logo), encoding='utf-8')
    # Supermuestreo: se dibuja a 4x y se reduce para bordes suaves en tamaños pequeños.
    outlined(logo, 192, 0.06, outline=5).resize((48, 48), Image.Resampling.LANCZOS).save(
        root / 'public/favicon.png', optimize=True
    )
    centered(logo, 180, 0.17, BLACK).save(root / 'public/apple-touch-icon.png', optimize=True)
    icons = root / 'public/icons'
    icons.mkdir(exist_ok=True)
    centered(logo, 192, 0.16, BLACK).save(icons / 'icon-192.png', optimize=True)
    centered(logo, 512, 0.16, BLACK).save(icons / 'icon-512.png', optimize=True)
    # Zona segura de los íconos adaptables: el 80 % central. El casco queda dentro con holgura.
    centered(logo, 512, 0.26, BLACK).save(icons / 'icon-maskable-512.png', optimize=True)
    print('Recursos de marca generados a partir de', sys.argv[1])


if __name__ == '__main__':
    main()
