import { beforeEach, describe, expect, it, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { resetWarnings } from '@evanion/widget';
import Widgets from './Widgets.astro';
import Probe from './__fixtures__/Probe.astro';
import Wrapper from './__fixtures__/Wrapper.astro';

/**
 * Renders `Widgets.astro` to a string through Astro's container API, which is
 * what makes a component testable outside a build.
 *
 * These cases run in the `@evanion/astro-widget:astro` project, for the reason
 * vitest.astro.config.ts gives.
 */
async function renderWidgets(props: Record<string, unknown>) {
  const container = await AstroContainer.create();
  return container.renderToString(Widgets, { props });
}

describe('Widgets.astro', () => {
  beforeEach(resetWarnings);

  it('spreads an item props into the widget', async () => {
    const html = await renderWidgets({
      registry: { hero: Probe },
      items: [{ id: 'h1', type: 'hero', props: { heading: 'Hello' } }],
    });

    expect(html).toContain('&quot;heading&quot;:&quot;Hello&quot;');
  });

  it('never spreads meta into the widget props', async () => {
    const html = await renderWidgets({
      registry: { hero: Probe },
      items: [
        {
          id: 'h1',
          type: 'hero',
          props: { heading: 'Hello' },
          meta: { column: 1 },
        },
      ],
    });

    expect(html).toContain('&quot;heading&quot;:&quot;Hello&quot;');
    expect(html).not.toContain('meta');
    expect(html).not.toContain('column');
  });

  it('hands meta to chrome.item, which is what positions the widget', async () => {
    const html = await renderWidgets({
      registry: { hero: Probe },
      chrome: { item: Wrapper },
      items: [
        {
          id: 'h1',
          type: 'hero',
          props: { heading: 'Hello' },
          meta: { column: 2 },
        },
      ],
    });

    expect(html).toContain('data-column="2"');
    expect(html).toContain('data-widget-type="hero"');
  });

  it('keeps a widget props out of its chrome', async () => {
    const html = await renderWidgets({
      registry: { hero: Probe },
      chrome: { item: Wrapper },
      items: [
        { id: 'h1', type: 'hero', props: { heading: 'Hello', column: 9 } },
      ],
    });

    // The chrome reads `meta.column` and this item carries none, so the widget
    // prop of the same name must not reach it.
    expect(html).not.toContain('data-column="9"');
  });

  it('hands nested items to the widget as data, not as rendered content', async () => {
    const html = await renderWidgets({
      registry: { hero: Probe },
      items: [
        {
          id: 'h1',
          type: 'hero',
          props: {},
          children: [{ id: 'c1', type: 'hero', props: { heading: 'Nested' } }],
        },
      ],
    });

    expect(html).toContain('&quot;id&quot;:&quot;c1&quot;');
  });

  it.each([
    'constructor',
    'toString',
    'valueOf',
    'hasOwnProperty',
    '__proto__',
  ])('skips a widget typed with the inherited key %s', async (type) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const html = await renderWidgets({
      registry: { hero: Probe },
      items: [{ id: 'x', type, props: {} }],
    });

    expect(html).not.toContain('probe');
    warn.mockRestore();
  });

  it('warns once for a type the registry does not hold, rather than skipping in silence', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const html = await renderWidgets({
      registry: { hero: Probe },
      items: [
        { id: 'x', type: 'missing', props: {} },
        { id: 'x', type: 'missing', props: {} },
      ],
    });

    expect(html).not.toContain('probe');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('Unknown widget type "missing"');
    warn.mockRestore();
  });

  it('renders nothing and warns when items is not a list', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const html = await renderWidgets({
      registry: { hero: Probe },
      items: 'nope',
    });

    expect(html).not.toContain('probe');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
