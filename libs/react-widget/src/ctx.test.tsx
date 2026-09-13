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

    render(
      <Widgets items={[{ id: 'a', type: 'label' as const, props: {} }]} />,
    );

    expect(screen.getByTestId('label')).toHaveTextContent('none');
  });

  it('belongs to the renderer, so an item cannot supply one', () => {
    // `ctx` follows the spread in renderWidget. Items are untrusted input and
    // `ctx` is page-level data, so a payload naming a `ctx` prop does not get
    // to supply one -- and the renderer's absent `ctx` still wins.
    const { Widgets } = createWidgets({ components: { label: Label } });

    render(
      <Widgets
        items={[
          {
            id: 'a',
            type: 'label' as const,
            // Only reachable from data that never met the type checker:
            // WidgetDataProps omits `ctx`.
            props: { ctx: { locale: 'from-props' } } as unknown as Record<
              string,
              never
            >,
          },
        ]}
      />,
    );

    expect(screen.getByTestId('label')).toHaveTextContent('none');
  });

  it('reaches a widget that declares ctx as required', () => {
    // `WidgetDataProps` omits `ctx`, so the item does not have to repeat a
    // value the renderer supplies. Leaving it in was a TS2322 on every item.
    const Required = ({ ctx }: { ctx: Ctx }) => (
      <span data-testid="required">{ctx.locale ?? 'none'}</span>
    );

    const { Widgets } = createWidgets({ components: { required: Required } });

    render(
      <Widgets
        ctx={{ locale: 'nb-NO' }}
        items={[{ id: 'a', type: 'required' as const, props: {} }]}
      />,
    );

    expect(screen.getByTestId('required')).toHaveTextContent('nb-NO');
  });
});
