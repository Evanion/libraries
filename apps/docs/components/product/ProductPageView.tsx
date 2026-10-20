import { categoricalClass } from '@evanion/baize-ui/tokens';
import { packages } from '../../app/navigation';
import { FactStrip } from './FactStrip';
import { CodeSample } from './CodeSample';
import { demos } from './demos';
import { Closing } from './Closing';
import { Faq } from './Faq';
import { Limits } from './Limits';
import { ProductHero } from './ProductHero';
import { Scene } from './Scene';
import type { ProductPage } from './types';
import '../landing/landing.css';
import './product.css';

/** Any product page, from its definition. `code` is the code sample, read at build time. */
export function ProductPageView({
  page,
  code,
  samples = {},
}: {
  page: ProductPage;
  code: string;
  /** Each scene's `sample` region by scene id, read at build time. */
  samples?: Record<string, string>;
}) {
  const lead = packages.find((p) => p.name === page.packageName);
  const Hero = demos[page.hero.demo];
  return (
    <main
      className={`product docs-identity ${lead ? categoricalClass(lead.hue) : ''}`}
    >
      <ProductHero hero={page.hero} demo={<Hero />} />
      <FactStrip facts={page.facts} />
      {page.scenes.map((scene) => {
        const Demo = scene.demo ? demos[scene.demo.id] : undefined;
        return (
          <Scene
            key={scene.id}
            scene={scene}
            demo={Demo ? <Demo /> : undefined}
            code={samples[scene.id]}
          />
        );
      })}
      {page.limits && <Limits limits={page.limits} />}
      <CodeSample sample={page.codeSample} code={code} />
      <Faq faq={page.faq} />
      <Closing closing={page.closing} />
    </main>
  );
}
