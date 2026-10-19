import type { ImgHTMLAttributes } from 'react';

const generated = /^\/assets\/generated\/[\w-]+\.jpg$/;

/**
 * Fotos de /assets/generated: el navegador usa el .webp (menos de la mitad de peso) y el .jpg
 * queda como respaldo. La base de datos sigue guardando la ruta .jpg.
 */
export function Photo({ src, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  if (!generated.test(src)) return <img src={src} {...props} />;
  return (
    <picture className="photo">
      <source srcSet={src.replace(/\.jpg$/, '.webp')} type="image/webp" />
      <img src={src} {...props} />
    </picture>
  );
}
