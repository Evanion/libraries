import type { ReactNode } from 'react';
import type { ProductPage } from './types';

/** The promise, its supporting lines, the actions, the install command and the hero demo. */
export function ProductHero({
  hero,
  demo,
}: {
  hero: ProductPage['hero'];
  demo: ReactNode;
}) {
  return (
    <header className="product__hero">
      <h1>{hero.promise}</h1>
      <p>{hero.line}</p>
      {hero.sub && <p>{hero.sub}</p>}
      <p className="product__actions">
        {hero.actions.map((action, i) => (
          <a
            key={action.href}
            href={action.href}
            className="product__action"
            data-primary={i === 0 ? '' : undefined}
          >
            {action.label}
          </a>
        ))}
      </p>
      <pre className="code-view product__install">
        <code>{hero.install}</code>
      </pre>
      <figure className="landing-proof">{demo}</figure>
    </header>
  );
}
