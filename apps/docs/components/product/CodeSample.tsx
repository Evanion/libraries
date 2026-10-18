import type { ProductPage } from './types';

/** A short snippet read from a tested region, with a link to its docs. */
export function CodeSample({
  sample,
  code,
}: {
  sample: ProductPage['codeSample'];
  code: string;
}) {
  return (
    <section id={sample.id} className="product__section">
      <h2>{sample.title}</h2>
      <p>{sample.lede}</p>
      <pre className="code-view">
        <code>{sample.install}</code>
      </pre>
      <pre className="code-view">
        <code>{code}</code>
      </pre>
      <a href={sample.link.href}>{sample.link.label} →</a>
    </section>
  );
}
