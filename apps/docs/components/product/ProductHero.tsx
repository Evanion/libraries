import type { ReactNode } from 'react';
import { InlineCode } from './InlineCode';
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
      {hero.definition && (
        <p className="product__definition">
          <InlineCode text={hero.definition} />
        </p>
      )}
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
      {hero.installs ? (
        <dl className="product__installs">
          {hero.installs.map((entry) => (
            <div key={entry.label} className="product__installs-row">
              <dt>{entry.label}</dt>
              <dd>
                <pre className="code-view product__install">
                  <code>{entry.command}</code>
                </pre>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <pre className="code-view product__install">
          <code>{hero.install}</code>
        </pre>
      )}
      {hero.demoLabel && (
        <p className="product__demo-label">{hero.demoLabel}</p>
      )}
      <figure className="landing-proof">{demo}</figure>
    </header>
  );
}
