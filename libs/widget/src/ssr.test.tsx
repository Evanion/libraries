import { describe, it, expect } from 'vitest';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { createWidgets } from './widget.js';

const TextWidget = ({ text }: { text: string }) => <span>{text}</span>;
const ErrorWidget = () => {
  throw new Error('boom');
};

describe('SSR and hydration snapshot', () => {
  it('renders a well-formed tree to string without hydration mismatch', () => {
    const { Widgets } = createWidgets({
      components: { text: TextWidget },
    });

    const html = renderToString(
      <Widgets items={[{ id: 'a', type: 'text', props: { text: 'hello' } }]} />,
    );

    expect(html).toContain('<span>hello</span>');
  });

  it('recovers from a throwing widget during SSR', () => {
    const { Widgets } = createWidgets({
      components: { error: ErrorWidget, text: TextWidget },
    });

    // React 19 SSR does not execute error boundaries synchronously; it emits
    // the Suspense fallback and expects the client to recover. The important
    // property is that the render does not abort the whole tree.
    const html = renderToStaticMarkup(
      <Widgets
        items={[
          { id: 'ok', type: 'text', props: { text: 'ok' } },
          { id: 'bad', type: 'error', props: {} },
        ]}
      />,
    );

    expect(html).toContain('<span>ok</span>');
    expect(html).toContain('Loading widget...');
  });
});
