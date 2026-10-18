import { categoricalClass } from '@evanion/baize-ui/tokens';
import { packages } from '../../app/navigation';
import { CodeSample } from './CodeSample';
import { demos } from './demos';
import { InstallBlock } from './InstallBlock';
import { NextSteps } from './NextSteps';
import { ProductHero } from './ProductHero';
import { Scene } from './Scene';
import type { ProductPage } from './types';
import '../landing/landing.css';
import './product.css';

/** Any product page, from its definition. `code` is the code sample, read at build time. */
export function ProductPageView({
  page,
  code,
}: {
  page: ProductPage;
  code: string;
}) {
  const lead = packages.find((p) => p.name === page.packageName);
  const Hero = demos[page.hero.demo];
  return (
    <main
      className={`product docs-identity ${lead ? categoricalClass(lead.hue) : ''}`}
    >
      <ProductHero hero={page.hero} demo={<Hero />} />
      {page.scenes.map((scene) => {
        const Demo = demos[scene.demo];
        return <Scene key={scene.id} scene={scene} demo={<Demo />} />;
      })}
      <CodeSample sample={page.codeSample} code={code} />
      <InstallBlock install={page.install} />
      <NextSteps next={page.next} />
    </main>
  );
}
