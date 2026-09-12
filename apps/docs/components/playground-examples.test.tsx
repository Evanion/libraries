import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { LiveError, LivePreview, LiveProvider } from 'react-live';
import { createWidgets } from '@evanion/react-widget';
import { examples } from './playground-examples';
import { playgroundScope } from './playground-scope';

/**
 * What `@evanion/react-widget` renders for each shipped snippet.
 *
 * These are properties of the library rather than of the snippet: `chrome.item`
 * defaults to a `<div>` carrying `data-widget-id` and `data-widget-type`, and
 * `chrome.wrapper` defaults to a `<section>`. A snippet that declares its own
 * `chrome.wrapper` names the text that wrapper renders; the rest expect the
 * default. Nothing but the real library produces this output, which is what
 * makes the documented preview the output of the documented code.
 */
const expectations: Record<
  keyof typeof examples,
  { wrapperText?: string; items: Array<[id: string, type: string]> }
> = {
  basic: {
    items: [
      ['userinfo', 'userInfo'],
      ['news1', 'news'],
    ],
  },
  ecommerce: {
    wrapperText: 'Featured Products',
    items: [
      ['banner1', 'banner'],
      ['product1', 'productCard'],
      ['product2', 'productCard'],
    ],
  },
  dashboard: {
    wrapperText: 'Admin Dashboard',
    items: [
      ['stats1', 'statCard'],
      ['stats2', 'statCard'],
      ['action1', 'actionButton'],
    ],
  },
};

/**
 * Evaluates a snippet exactly as WidgetPlayground does -- react-live, the
 * playground's own scope, `noInline` -- and hands back the resulting DOM.
 *
 * LiveProvider transpiles in an effect and resolves a promise, so the preview is
 * empty on the first paint.
 */
async function renderSnippet(code: string) {
  const { container, queryByTestId } = render(
    <LiveProvider code={code} scope={playgroundScope} noInline={true}>
      <LivePreview />
      <LiveError data-testid="live-error" />
    </LiveProvider>,
  );

  await waitFor(() => {
    const failure = queryByTestId('live-error')?.textContent;
    expect(failure ?? null).toBeNull();
    expect(container.querySelector('[data-widget-id]')).not.toBeNull();
  });

  return container;
}

describe('playground snippets', () => {
  it('evaluates them against the library itself, not a stand-in', () => {
    expect(playgroundScope.createWidgets).toBe(createWidgets);
  });

  it('expects an output for every snippet the docs ship', () => {
    expect(Object.keys(expectations).sort()).toEqual(
      Object.keys(examples).sort(),
    );
  });

  describe.each(Object.keys(examples) as Array<keyof typeof examples>)(
    '%s',
    (name) => {
      const { wrapperText, items } = expectations[name];

      it('renders the chrome the snippet asks for', async () => {
        const container = await renderSnippet(examples[name].code);

        if (wrapperText === undefined) {
          expect(container.querySelector('section')).not.toBeNull();
        } else {
          expect(container.textContent).toContain(wrapperText);
        }
      });

      it('renders every item through the library item chrome', async () => {
        const container = await renderSnippet(examples[name].code);

        expect(
          Array.from(container.querySelectorAll('[data-widget-id]')).map(
            (element) => [
              element.getAttribute('data-widget-id'),
              element.getAttribute('data-widget-type'),
            ],
          ),
        ).toEqual(items);
      });
    },
  );
});
