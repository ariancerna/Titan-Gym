"""Genera los recursos de marca de TITAN GYM a partir del logo original (casco blanco).

El original tiene un halo gris irregular alrededor del casco que a tamaño de favicon se ve
como manchas. Aquí se reconstruye una silueta limpia en blanco y se exportan:
  public/assets/brands/titan-mark.png  128 px, transparente (navegación, pie, correos)
  public/favicon.png                    48 px, casco blanco sobre cuadrado negro redondeado
  public/apple-touch-icon.png          180 px, fondo negro (pantalla de inicio de iPhone)
  public/og-image.png                  1200 × 630, vista previa al compartir el enlace
  branding/titan-logo-limpio.png       versión grande y limpia para otros usos

Uso: python tools/build-brand.py branding/titan-logo-original.png
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BLACK = (16, 17, 20, 255)  # #101114, fondo de la web


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


def share_image(logo: Image.Image, root: Path) -> Image.Image:
    """Imagen para WhatsApp/Facebook: logo, nombre, lema y sede con las fuentes del sitio."""
    fonts = root / 'node_modules/@fontsource'
    heading = lambda size: ImageFont.truetype(str(fonts / 'oswald/files/oswald-latin-700-normal.woff'), size)
    body = lambda size: ImageFont.truetype(str(fonts / 'space-grotesk/files/space-grotesk-latin-500-normal.woff'), size)
    image = Image.new('RGBA', (1200, 630), BLACK)
    glow = Image.new('L', (1200, 630), 0)
    ImageDraw.Draw(glow).ellipse((40, 60, 520, 570), fill=150)
    violet = Image.new('RGBA', (1200, 630), (124, 58, 237, 255))
    image.paste(violet, (0, 0), glow.filter(ImageFilter.GaussianBlur(90)))
    mark = fit(logo, 400)
    image.alpha_composite(mark, (280 - mark.width // 2, 315 - mark.height // 2))
    draw = ImageDraw.Draw(image)
    draw.text((540, 150), 'TITAN GYM', font=heading(124), fill=(255, 255, 255, 255))
    draw.text((546, 312), 'WAKE THE BEST', font=heading(52), fill=(167, 139, 250, 255))
    draw.text((546, 410), 'Reserva tus clases grupales en línea', font=body(32), fill=(199, 198, 204, 255))
    draw.text((546, 460), 'TITAN GYM QATUNA · Carabayllo', font=body(26), fill=(161, 161, 170, 255))
    return image


def main():
    root = Path(__file__).resolve().parent.parent
    original = Image.open(sys.argv[1])
    logo = white_logo(clean_silhouette(original))
    logo.save(root / 'branding' / 'titan-logo-limpio.png', optimize=True)
    centered(logo, 128, 0.06).save(root / 'public/assets/brands/titan-mark.png', optimize=True)
    # Supermuestreo: se dibuja a 4x y se reduce para bordes suaves en tamaños pequeños.
    centered(logo, 192, 0.16, BLACK, radius=40).resize((48, 48), Image.Resampling.LANCZOS).save(
        root / 'public/favicon.png', optimize=True
    )
    centered(logo, 180, 0.17, BLACK).save(root / 'public/apple-touch-icon.png', optimize=True)
    share_image(logo, root).convert('RGB').save(root / 'public/og-image.png', optimize=True)
    print('Recursos de marca generados a partir de', sys.argv[1])


if __name__ == '__main__':
    main()
