import type { ReactNode } from 'react';
import { EntryTable } from './EntryTable';
import { InlineCode } from './InlineCode';
import type { SceneDefinition } from './types';

/**
 * One section: a title, a lede, the problem and what the library does about
 * it, an optional "What you get" callout, then the demo with its caption
 * when the scene has one, and a link into the docs.
 */
export function Scene({
  scene,
  demo,
  code,
}: {
  scene: SceneDefinition;
  demo?: ReactNode;
  /** The scene's `sample` region, read at build time. */
  code?: string;
}) {
  return (
    <section id={scene.id} className="product__section">
      <h2>{scene.title}</h2>
      <p className="product__lede">{scene.lede}</p>
      <p>
        <InlineCode text={scene.why} />
      </p>
      <p>
        <InlineCode text={scene.how} />
      </p>
      {scene.entries && <EntryTable entries={scene.entries} />}
      {code && (
        <>
          {scene.sample?.install && (
            <pre className="code-view">
              <code>{scene.sample.install}</code>
            </pre>
          )}
          <pre className="code-view">
            <code>{code}</code>
          </pre>
        </>
      )}
      {scene.differs && (
        <aside className="product__differs">
          <p className="product__differs-title">What you get</p>
          <p>
            <InlineCode text={scene.differs} />
          </p>
        </aside>
      )}
      {demo && scene.demo && (
        <figure className="landing-proof">
          {demo}
          <figcaption className="landing-proof__caption">
            <InlineCode text={scene.demo.caption} />
          </figcaption>
        </figure>
      )}
      <a href={scene.howItWorks.href}>{scene.howItWorks.label} →</a>
      {scene.more && <a href={scene.more.href}>{scene.more.label} →</a>}
    </section>
  );
}
