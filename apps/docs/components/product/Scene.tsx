import type { ReactNode } from 'react';
import { InlineCode } from './InlineCode';
import type { SceneDefinition } from './types';

/**
 * One section: a title, a lede, the problem and what the library does about
 * it, an optional "How it's different" callout, then the demo with its caption
 * when the scene has one, and a link into the docs.
 */
export function Scene({
  scene,
  demo,
}: {
  scene: SceneDefinition;
  demo?: ReactNode;
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
      {scene.differs && (
        <aside className="product__differs">
          <p className="product__differs-title">How it&rsquo;s different</p>
          <p>
            <InlineCode text={scene.differs} />
          </p>
        </aside>
      )}
      {demo && scene.demo && (
        <figure className="landing-proof">
          {demo}
          <figcaption className="landing-proof__caption">
            {scene.demo.caption}
          </figcaption>
        </figure>
      )}
      <a href={scene.howItWorks.href}>{scene.howItWorks.label} →</a>
    </section>
  );
}
