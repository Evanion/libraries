import type { ProductPage } from './types';

/** Where to go after the page. */
export function NextSteps({ next }: { next: ProductPage['next'] }) {
  return (
    <section className="product__section">
      <h2>{next.title}</h2>
      <ul className="product__links">
        {next.links.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
