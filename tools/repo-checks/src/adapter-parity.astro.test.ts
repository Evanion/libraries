import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import AstroWidgets from '@evanion/astro-widget/components/Widgets.astro';
import { createWidgets } from '@evanion/react-widget';
import { resetWarnings, type AnyWidgetItem } from '@evanion/widget';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Probe from './__fixtures__/Probe.astro';
import Wrapper from './__fixtures__/Wrapper.astro';

/**
 * One item array, rendered through every adapter.
 *
 * The docs site says the two packages are the same model in two runtimes. Until
 * the item shapes were unified that was editorial rather than true: an array
 * authored for one did not render through the other at all. This is what makes
 * the claim checkable, and it is the test a new adapter has to pass before it
 * ships -- which is what keeps the family from diverging again.
 *
 * It lives here rather than in either package because it is the one assertion
 * neither of them can make alone: an Astro library must not carry React in its
 * project graph, and a React one must not carry Astro.
 */
const items: AnyWidgetItem[] = [
  { id: 'a', type: 'hero', props: { heading: 'One' }, meta: { column: 1 } },
  { id: 'skipped', type: 'gone', props: {} },
  { id: 'b', type: 'prose', props: { heading: 'Two' } },
];

/** The order a region's widgets appear in, by type. */
function typeSequence(html: string): string[] {
  return [...html.matchAll(/data-widget-type="([^"]+)"/g)].map(
    (match) => match[1] as string,
  );
}

async function renderThroughAstro(): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(AstroWidgets, {
    props: {
      items,
      registry: { hero: Probe, prose: Probe },
      // Astro has no default chrome: an `.astro` component's children come
      // through `<slot />`, so a wrapper the library supplied would be markup
      // the consumer did not ask for. The fixture writes the attributes the
      // React adapter's own default chrome writes.
      chrome: { item: Wrapper },
    },
  });
}

function renderThroughReact(): string {
  const ReactProbe = ({ heading }: { heading?: string }) =>
    createElement('probe', null, heading);
  const { Widgets } = createWidgets({
    components: { hero: ReactProbe, prose: ReactProbe },
  });

  return renderToStaticMarkup(
    createElement(Widgets, { items: items as never }),
  );
}

describe('one item array through every adapter', () => {
  // Warnings are reported once per process, so one case's would silence the
  // next case that produces the same message.
  beforeEach(resetWarnings);

  it('renders the same widget types in the same order', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const astro = typeSequence(await renderThroughAstro());
    const react = typeSequence(renderThroughReact());

    expect(astro).toEqual(['hero', 'prose']);
    expect(react).toEqual(astro);
    warn.mockRestore();
  });

  it('skips the unknown type in both rather than throwing in either', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await renderThroughAstro()).not.toContain('gone');
    expect(renderThroughReact()).not.toContain('gone');
    // Once per distinct message, and the two runtimes raise the same one.
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
