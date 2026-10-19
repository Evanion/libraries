import type { ProductPage } from './types';

/** The hero's promise again, with the actions to start. */
export function Closing({ closing }: { closing: ProductPage['closing'] }) {
  return (
    <section className="product__section product__closing">
      <h2>{closing.title}</h2>
      <p>{closing.text}</p>
      <p className="product__actions">
        {closing.actions.map((action, i) => (
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
    </section>
  );
}
