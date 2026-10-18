import type { ProductPage } from './types';

/** The install command. */
export function InstallBlock({ install }: { install: ProductPage['install'] }) {
  return (
    <section className="product__section">
      <h2>{install.title}</h2>
      <pre className="code-view">
        <code>{install.command}</code>
      </pre>
    </section>
  );
}
