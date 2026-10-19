import { InlineCode } from './InlineCode';
import type { ProductPage } from './types';

/** What the library does not do, as a quiet list of short statements. */
export function Limits({
  limits,
}: {
  limits: NonNullable<ProductPage['limits']>;
}) {
  return (
    <section className="product__limits" aria-labelledby="product-limits">
      <h2 id="product-limits" className="product__limits-heading">
        {limits.title}
      </h2>
      <ul className="product__limits-list">
        {limits.items.map((item) => (
          <li key={item.title} className="product__limit">
            <p className="product__limit-title">{item.title}</p>
            <p>
              <InlineCode text={item.text} />
            </p>
            {item.link && <a href={item.link.href}>{item.link.label} →</a>}
          </li>
        ))}
      </ul>
    </section>
  );
}
