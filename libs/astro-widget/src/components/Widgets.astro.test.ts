import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Widgets from './Widgets.astro';
import Probe from './__fixtures__/Probe.astro';
import Wrapper from './__fixtures__/Wrapper.astro';

async function renderWidgets(props: Record<string, unknown>) {
  const container = await AstroContainer.create();
  return container.renderToString(Widgets, { props });
}

describe('Widgets.astro', () => {
  it('passes a block its own fields as props', async () => {
    const html = await renderWidgets({
      registry: { hero: Probe },
      items: [{ type: 'hero', id: 'h1', heading: 'Hello' }],
    });

    expect(html).toContain('&quot;heading&quot;:&quot;Hello&quot;');
  });

  it('never spreads meta into the block props', async () => {
    const html = await renderWidgets({
      registry: { hero: Probe },
      items: [
        { type: 'hero', id: 'h1', heading: 'Hello', meta: { column: 1 } },
      ],
    });

    expect(html).toContain('&quot;heading&quot;:&quot;Hello&quot;');
    expect(html).not.toContain('meta');
    expect(html).not.toContain('column');
  });

  it('hands meta to chrome.item, which is what positions the block', async () => {
    const html = await renderWidgets({
      registry: { hero: Probe },
      chrome: { item: Wrapper },
      items: [
        { type: 'hero', id: 'h1', heading: 'Hello', meta: { column: 2 } },
      ],
    });

    expect(html).toContain('data-column="2"');
  });

  it('skips a block whose type is not in the registry', async () => {
    const html = await renderWidgets({
      registry: { hero: Probe },
      items: [{ type: 'missing', id: 'x' }],
    });

    expect(html).not.toContain('probe');
  });
});
