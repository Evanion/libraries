import type { ReactNode } from 'react';
import type { SceneDefinition } from './types';

/** One scene: a heading, a lede, the demo with its caption, and a link into the docs. */
export function Scene({
  scene,
  demo,
}: {
  scene: SceneDefinition;
  demo: ReactNode;
}) {
  return (
    <section id={scene.id} className="product__section">
      <h2>{scene.title}</h2>
      <p>{scene.lede}</p>
      <figure className="landing-proof">
        {demo}
        <figcaption className="landing-proof__caption">
          {scene.caption}
        </figcaption>
      </figure>
      <a href={scene.howItWorks.href}>{scene.howItWorks.label} →</a>
    </section>
  );
}
