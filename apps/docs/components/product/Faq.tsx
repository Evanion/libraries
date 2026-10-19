import { InlineCode } from './InlineCode';
import type { ProductPage } from './types';

/** The questions a reader asks before adopting, each answered in the open. */
export function Faq({ faq }: { faq: ProductPage['faq'] }) {
  return (
    <section id="faq" className="product__section">
      <h2>Questions</h2>
      <dl className="product__faq">
        {faq.map((entry) => (
          <div key={entry.q} className="product__faq-entry">
            <dt>{entry.q}</dt>
            <dd>
              <InlineCode text={entry.a} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
