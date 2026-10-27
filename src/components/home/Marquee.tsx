/** Cinta animada con las disciplinas. Es decorativa: los lectores de pantalla la omiten. */
export function Marquee({ items }: { items: readonly string[] }) {
  const row = (
    <ul>
      {items.map((item) => (
        <li key={item} data-discipline={item}>
          {item}
          <span className="marquee-star">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-band">
        <div className="marquee-track">
          {row}
          {row}
        </div>
      </div>
    </div>
  );
}
