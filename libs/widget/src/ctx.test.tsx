import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import type { PropsWithChildren } from 'react';
import { createWidgets } from './widget.js';

type Ctx = { locale?: string };

const Label = ({ ctx }: { ctx?: Ctx }) => (
  <span data-testid="label">{ctx?.locale ?? 'none'}</span>
);

const Box = ({ children }: PropsWithChildren) => <div>{children}</div>;

const Nested = ({ ctx }: { ctx?: Ctx }) => (
  <span data-testid="nested">{ctx?.locale ?? 'none'}</span>
);

describe('ctx, the astro-widget parity prop', () => {
  beforeEach(() => cleanup());

  it('passes page-level data to every widget without a provider', () => {
    const { Widgets } = createWidgets({ components: { label: Label } });

    render(
      <Widgets
        ctx={{ locale: 'sv-SE' }}
        items={[{ id: 'a', type: 'label' as const, props: {} }]}
      />,
    );

    expect(screen.getByTestId('label')).toHaveTextContent('sv-SE');
  });

  it('reaches nested widgets too', () => {
    const { Widgets } = createWidgets({
      components: { box: Box, nested: Nested },
    });

    render(
      <Widgets
        ctx={{ locale: 'en-GB' }}
        items={[
          {
            id: 'outer',
            type: 'box' as const,
            props: {},
            children: [{ id: 'inner', type: 'nested' as const, props: {} }],
          },
        ]}
      />,
    );

    expect(screen.getByTestId('nested')).toHaveTextContent('en-GB');
  });

  it('is undefined when the caller supplies none', () => {
    const { Widgets } = createWidgets({ components: { label: Label } });

    render(<Widgets items={[{ id: 'a', type: 'label' as const, props: {} }]} />);

    expect(screen.getByTestId('label')).toHaveTextContent('none');
  });
});
