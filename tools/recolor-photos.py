"""Cambia las luces amarillas de las fotos a morado neón sin tocar los tonos de piel.

Solo se recolorean píxeles con tono amarillo/ámbar (≈38°–68°) y saturación alta, como los
tubos LED y las franjas de los equipos. La piel (≈5°–32°) y los grises quedan iguales.
Uso: python recolor.py <carpeta_origen> <carpeta_destino> [nombres...]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

TARGET_HUE = 268 / 360  # morado neón


def ramp(x, start, end):
    """0 antes de start, 1 después de end, lineal entre ambos."""
    return np.clip((x - start) / (end - start), 0, 1)


def recolor(img: Image.Image) -> Image.Image:
    hsv = np.asarray(img.convert('HSV'), dtype=np.float32) / 255.0
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    hue_deg = h * 360
    # Peso por tono: sube entre 34° y 40°, se mantiene hasta 66° y baja hasta 74°.
    w_hue = ramp(hue_deg, 34, 40) * (1 - ramp(hue_deg, 66, 74))
    # Solo colores intensos: la piel y la madera tienen menos saturación que un LED.
    w_sat = ramp(s, 0.38, 0.55)
    w_val = ramp(v, 0.12, 0.25)
    weight = (w_hue * w_sat * w_val)[..., None]

    recolored = np.stack([np.full_like(h, TARGET_HUE), np.minimum(s * 1.05, 1), v], axis=-1)
    recolored_rgb = np.asarray(
        Image.fromarray((recolored * 255).astype(np.uint8), 'HSV').convert('RGB'), dtype=np.float32
    )
    original_rgb = np.asarray(img.convert('RGB'), dtype=np.float32)
    out = original_rgb * (1 - weight) + recolored_rgb * weight
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    names = sys.argv[3:]
    dst.mkdir(parents=True, exist_ok=True)
    for name in names:
        img = Image.open(src / name)
        out = recolor(img)
        out.save(dst / name, quality=88, optimize=True, progressive=True)
        print(name, img.size, '->', (dst / name).stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
