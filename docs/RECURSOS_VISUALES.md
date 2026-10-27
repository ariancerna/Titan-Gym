# Recursos visuales · renovación solicitada

Fecha: 11 de octubre de 2026. El propietario pidió nuevas imágenes por pixelación, un logo nuevo y favicon. Esto sustituye explícitamente el requisito inicial de utilizar siempre el logo/fotografías de Figma. Se mantienen la paleta oscura/amarilla, Oswald, Space Grotesk y la estructura visual del diseño.

Se utilizó la herramienta integrada de generación de imágenes, no la CLI ni una clave API propia. Se generó cada imagen de forma independiente y se inspeccionaron los resultados. Las fotografías son ilustrativas: no muestran instalaciones, entrenadores ni socios reales de TITAN GYM. Su procedencia se conserva en esta documentación; a petición del propietario no se muestra un aviso en el frontend. Los recursos originales de Figma permanecen en el repositorio.

## Archivos finales

| Recurso | Archivo | Dimensiones |
| --- | --- | --- |
| Fondo de inicio | `public/assets/generated/hero.jpg` | 1672 × 941 |
| Spinning | `public/assets/generated/spinning.jpg` | 1672 × 941 |
| HIIT | `public/assets/generated/hiit.jpg` | 1672 × 941 |
| Funcional | `public/assets/generated/funcional.jpg` | 1672 × 941 |
| Zumba | `public/assets/generated/zumba.jpg` | 1672 × 941 |
| Yoga | `public/assets/generated/yoga.jpg` | 1672 × 941 |
| Cross Training | `public/assets/generated/cross-training.jpg` | 1672 × 941 |
| Logo original de TITAN GYM | `branding/titan-logo-original.png` (no se publica) | 1083 × 1452 |
| Logo de navegación, pie y correos | `public/assets/brands/titan-mark.png` | 128 × 128 |
| Favicon | `public/favicon.png` | 48 × 48 |
| Icono de pantalla de inicio (iPhone) | `public/apple-touch-icon.png` | 180 × 180 |
| Imagen para compartir el enlace | `public/og-image.png` | 1200 × 630 |

Actualización: el logo generado con IA (casco amarillo) se reemplazó por el logo de TITAN GYM proporcionado por el equipo. Los recursos se generan con `tools/build-brand.py` (ver `branding/LEEME.md`) y los archivos fuente del logo anterior se retiraron de `public/`.

Los fondos anteriores de inicio/detalle tenían 512 × 279 px. No se ampliaron artificialmente: fueron reemplazados por generaciones nuevas de mayor resolución. Aunque los prompts solicitaron tamaños mayores, la salida real fue 1672 × 941; no se presenta como 4K.

Las fotos se codificaron a JPEG con calidad 90 conservando dimensiones y composición, entre 269679 y 364457 bytes cada una. `tools/encode-photo.ps1` documenta esa conversión. `tools/resize-brand.ps1` deriva los tamaños web del mismo logo, preservando el canal alfa. El favicon final pesa 2426 bytes y la marca web 9733 bytes. Se verificó alfa 0 en las esquinas de ambos: son transparentes, no vectoriales. La fuente de fondo oscuro anterior se conserva como variante, pero no se utiliza en la interfaz.

La migración `refresh_visual_assets` actualiza únicamente las imágenes conocidas de las seis clases académicas. Si un operador ya personalizó una imagen, la conserva. El seed incorpora las nuevas rutas para instalaciones vacías; nunca se volvió a ejecutar sobre la base alojada. Las reservas y los roles no se modificaron.

## Ajuste de color a la identidad de la sede

Las seis fotografías de disciplinas tenían iluminación amarilla, el color del prototipo. Para alinearlas con la sede real (iluminación morada), `tools/recolor-photos.py` cambia a morado solo los píxeles de tono amarillo/ámbar y alta saturación (luces LED y franjas de equipos). La piel, el cabello y la ropa no se modifican. Tamaño (1672 × 941 px) y nombres de archivo se conservan, así que no hace falta cambiar la base de datos; los originales están en el historial de Git. La foto de la portada no tiene personas y usa un filtro CSS (`hue-rotate`).

Uso: `python tools/recolor-photos.py <origen> <destino> spinning.jpg hiit.jpg …`

## Prompts finales

Los textos siguientes son instrucciones reales de generación. Se conservan en inglés tal como se utilizaron; no son textos de la interfaz.

### Fondo principal

```text
Use case: photorealistic-natural. Asset type: wide website hero background for TITAN GYM. Original premium training gym interior, matte charcoal black strength machines and free weight racks, orderly black rubber flooring, clean modern industrial architecture, restrained warm yellow #FACC15 LED strips and highlights. Photorealistic professional architectural sports photography, crisp high-resolution material detail, realistic proportions, strong depth. Wide 16:9 landscape, ideally 3840x2160. Central area is calm dark negative space for centered website headline, interesting equipment at sides, no close-up foreground obstruction. Moody cinematic lighting but clearly visible equipment. No people, no text, no logos, no watermark, no grain, no blur, no pixelation.
```

### Spinning, HIIT y Funcional

Prefijo común, seguido del texto de cada disciplina:

```text
Use case: photorealistic-natural. Asset type: high-resolution wide landscape class photograph for the TITAN GYM website. Professional sports editorial photography, crisp natural anatomy, realistic skin and equipment, black and charcoal gym with restrained yellow accents matching #FACC15. Cinematic side lighting with visible detail, no grain, no blur, no pixelation. Landscape 16:9 composition ideally 2560x1440, keep the activity centered with breathing room for responsive crops. No text, no logos, no watermarks.
```

```text
Spinning: Scene: indoor cycling studio. Three adult athletes on properly proportioned stationary spinning bicycles, foreground woman in black sportswear hands naturally on handlebars, two others behind, dynamic focused training, warm yellow light strips, technically plausible pedaling.
HIIT: Scene: adult athletic woman doing a battle rope exercise in a modern training gym, feet grounded in balanced athletic stance, two clearly separated rope waves, natural hands and anatomy, dark rubber flooring, yellow equipment details, energetic but sharp frozen action.
Funcional: Scene: adult male athlete performing a controlled kettlebell goblet squat, both hands correctly holding the handle of one matte black kettlebell at chest level, natural athletic stance, coach in background, tidy functional training area, yellow accent lighting.
```

### Zumba, Yoga y Cross Training

Prefijo común, seguido del texto de cada disciplina:

```text
Use case: photorealistic-natural. Asset type: high-resolution wide class photo for the TITAN GYM website. Professional sports editorial photography, sharp natural anatomy, realistic skin and equipment. Consistent premium gym interior: charcoal surfaces, black sportswear, restrained yellow #FACC15 accent lights and equipment, natural photographic lighting. Landscape 16:9, ideally 2560x1440, activity centered with breathing room for responsive crops. No text, no logos, no watermark, no grain, no pixelation.
```

```text
Zumba: An adult woman instructor leading a joyful dance fitness class with three adult students of varied appearance, coordinated simple upright dance steps, naturally formed hands, spacious clean mirrored studio, dynamic but frozen sharp action, inviting energy.
Yoga: An adult woman practicing a balanced standing warrior-two yoga pose on a black yoga mat, naturally aligned arms stretched horizontally and front knee bent, full body visible, peaceful uncluttered indoor studio with soft natural light and subtle yellow architectural accents. Calm recovery atmosphere.
Cross Training: An adult male athlete performing a controlled barbell deadlift in a functional training zone, full body and both ends of the barbell visible, hands correctly grip the bar, feet grounded, realistic unbranded black bumper plates, strong steady athletic stance, clear athletic action.
```

### Logo y favicon

```text
Use case: logo-brand. Asset type: compact gym logo and favicon. Create a BRAND NEW extremely clean graphic symbol for TITAN GYM, not a photograph or product mockup. A bold symmetrical angular Greek titan helmet, simplified into just a few chunky shapes, with a straight barbell integrated across its brow. Flat 2D vector-style graphic, pure uniform yellow #FACC15 silhouette, broad clean negative spaces, perfectly crisp smooth edges. On a completely uniform solid near-black #101114 square background. The emblem fills 75% of the square and must read at 32 pixels. No text, no gradients, no lighting, no metallic effects, no shadows, no texture, no noise, no scratches, no distressed edges, no tiny particles, no watermark. Only two solid colors: #FACC15 and #101114.
```

Se descartaron dos variantes transparentes iniciales. Se eligió una variante de fondo oscuro y, por petición posterior del propietario, se extrajo su fondo usando de nuevo la herramienta integrada. El resultado transparente se utiliza con TITAN GYM renderizado como texto accesible. La salida raster contiene pequeñas variaciones tonales; no se afirma que reproduzca literalmente dos colores planos.

### Extracción final del fondo

```text
Use case: background-extraction. Edit target: the provided TITAN GYM yellow helmet-and-barbell emblem. Remove ONLY the near-black background, including the dark areas inside all the helmet and barbell negative-space cutouts, and replace those areas with genuine fully transparent alpha. Preserve the yellow emblem's exact silhouette, proportions, position, colors and crisp smooth edges. Do not redesign, recolor, add texture, add outlines, add shadows, add glow, add text or crop the emblem. Keep square composition and existing generous margins. Return a clean transparent PNG cutout, NOT a checkerboard painted into the image.
```

## Optimización (19/10/2026)

Cada foto de `public/assets/generated` tiene una versión `.webp` generada desde el mismo `.jpg` con calidad 78 y el mismo tamaño (1672 × 941): 851 KB en total frente a 1972 KB. La web la sirve con el componente `Photo` y conserva el `.jpg` como respaldo, así que las rutas guardadas en la base de datos no cambian. La diferencia media por canal frente al original es de unos 2/255.

Los 116 recursos exportados de Figma que la aplicación no usa se movieron de `public/assets` a `design/figma`: ya no se publican. `tools/assets-local.json` conserva su procedencia con la nueva ruta. Se mantienen en `public/assets` los que usan la base de datos, el seed y las pruebas.


## Rediseño de la interfaz (octubre de 2026)

El propietario pidió que la web dejara de verse genérica. Cambios principales:

- **Tipografías:** Anton para titulares grandes y Archivo / Archivo Narrow para texto, botones y etiquetas (empaquetadas con `@fontsource`, sin CDN). Reemplazan a Oswald y Space Grotesk.
- **Paleta:** negro `#0a0a0c`, hueso `#f4f1ea` y morado neón `#8b3dff` (blanco encima: contraste 4.99, AA). El verde lima `#c6ff3d` solo marca "en vivo" y cupos libres. Cada disciplina tiene un color propio (`[data-discipline]` en `src/styles/index.css`) para leer la agenda de un vistazo.
- **Portada:** titular gigante con relleno animado, tablero "en vivo" con cuenta regresiva a la próxima clase, cinta animada de disciplinas, fichas de disciplinas que filtran la agenda (`/clases?disciplina=…`), reglas de la casa, sede con el mapa de Google Maps incrustado (oscurecido con CSS para combinar con la página; `vercel.json` lo permite con `frame-src`) y botón de WhatsApp.
- **Agenda:** agrupada por día, con la hora en grande y la ocupación como un segmento por cupo.
- **Fotos:** grano de película y tratamiento de color en CSS para que las imágenes generadas se vean menos "de banco de imágenes". Todas las animaciones respetan `prefers-reduced-motion`.

Los estilos nuevos están en `src/styles/brand.css`.

### Pendiente: fotos reales de la sede

Las fotos siguen siendo las generadas. Para usar fotos reales (por ejemplo, las del perfil de Google Maps de TITAN GYM QATUNA, siempre que sean del propio gimnasio o se tenga permiso del autor), basta con reemplazar los archivos de `public/assets/generated/` manteniendo el nombre y el formato 16:9 (≥ 1600 px de ancho), y regenerar el `.webp` de cada una. Al cambiar `hero.jpg` por una foto real con luz morada, quitar el `hue-rotate` de `.hero-photo` en `src/styles/brand.css`.
