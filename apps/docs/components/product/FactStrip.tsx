import type { ProductPage } from './types';

/** The short statements of what the library is and is not, as a row of cards. */
export function FactStrip({ facts }: { facts: ProductPage['facts'] }) {
  return (
    <ul className="product__facts">
      {facts.map((fact) => (
        <li key={fact.title} className="product__fact">
          <p className="product__fact-title">{fact.title}</p>
          <p>{fact.text}</p>
          {fact.link && <a href={fact.link.href}>{fact.link.label} →</a>}
        </li>
      ))}
    </ul>
  );
}
