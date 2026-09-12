import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import { createWidgets } from './index.js';

const Box = ({ label, children }: PropsWithChildren<{ label: string }>) => (
  <div data-testid={`box-${label}`}>
    <span>{label}</span>
    {children}
  </div>
);

const Leaf = ({ label }: { label: string }) => (
  <span data-testid={`leaf-${label}`}>{label}</span>
);

const { Widgets } = createWidgets({ components: { box: Box, leaf: Leaf } });

const items = [
  {
    id: 'a',
    type: 'box' as const,
    props: { label: 'a' },
    children: [{ id: 'b', type: 'leaf' as const, props: { label: 'b' } }],
  },
];

describe('server rendering', () => {
  beforeEach(() => cleanup());

  it('renders a well-formed tree to markup', () => {
    const html = renderToString(<Widgets items={items} />);

    expect(html).toContain('data-widget-id="a"');
    expect(html).toContain('data-widget-type="leaf"');
    expect(html).toContain('data-testid="leaf-b"');
  });

  it('hydrates that markup without a mismatch', async () => {
    const html = renderToString(<Widgets items={items} />);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    // React reports a hydration mismatch through console.error and then
    // repairs the DOM, so the rendered result looks correct either way and the
    // spy is the only thing that can tell the difference.
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await act(async () => {
      hydrateRoot(container, <Widgets items={items} />);
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="leaf-b"]')).not.toBeNull();

    errorSpy.mockRestore();
    container.remove();
  });
});
