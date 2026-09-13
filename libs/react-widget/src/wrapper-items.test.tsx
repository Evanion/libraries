import { render, screen, cleanup } from '@testing-library/react';
import { Children } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWidgets } from './widget.js';
import { DefaultWrapper } from './widgets.js';
import type { RenderableWidgetItem, WidgetsWrapperComponent } from './types.js';

const Leaf = ({ label }: { label: string }) => <span>{label}</span>;

const seen: { items?: readonly RenderableWidgetItem[]; children: number }[] =
  [];

const Recorder: WidgetsWrapperComponent = ({ children, items }) => {
  seen.push({ items, children: Children.count(children) });
  return <div data-testid="region">{children}</div>;
};

const { Widgets, defineItems } = createWidgets({
  components: { leaf: Leaf },
  chrome: { wrapper: Recorder },
});

/** Items the type checker would reject; the renderer meets them at runtime. */
type LooseItems = Parameters<typeof Widgets>[0]['items'];

describe('chrome.wrapper items', () => {
  beforeEach(() => {
    cleanup();
    seen.length = 0;
  });

  it('hands the wrapper the region it is wrapped around', () => {
    render(
      <Widgets
        items={defineItems([
          { id: 'a', type: 'leaf', props: { label: 'A' }, meta: { lane: 1 } },
          { id: 'b', type: 'leaf', props: { label: 'B' } },
        ])}
      />,
    );

    expect(seen[0]?.items?.map((item) => item.id)).toEqual(['a', 'b']);
    expect(seen[0]?.items?.[0]?.meta).toEqual({ lane: 1 });
  });

  it('keeps items aligned with children when the renderer skips one', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <Widgets
        items={
          [
            { id: 'a', type: 'leaf', props: { label: 'A' } },
            { id: 'gone', type: 'nope', props: {} },
            { id: 'b', type: 'leaf', props: { label: 'B' } },
          ] as unknown as LooseItems
        }
      />,
    );

    // The skipped item is in neither list, so index 1 of `items` is still the
    // item that produced index 1 of `children`.
    expect(seen[0]?.items?.map((item) => item.id)).toEqual(['a', 'b']);
    expect(seen[0]?.children).toBe(2);
    warn.mockRestore();
  });

  it('lets a wrapper group the region by an item meta key', () => {
    const Lanes: WidgetsWrapperComponent = ({ children, items = [] }) => {
      const nodes = Children.toArray(children);
      const lanes = ['left', 'right'] as const;

      return (
        <div>
          {lanes.map((lane) => (
            <div data-testid={lane} key={lane}>
              {items.reduce<ReactNode[]>(
                (kept, item, index) =>
                  item.meta?.['lane'] === lane ? [...kept, nodes[index]] : kept,
                [],
              )}
            </div>
          ))}
        </div>
      );
    };

    render(
      <Widgets
        chrome={{ wrapper: Lanes }}
        items={defineItems([
          {
            id: 'a',
            type: 'leaf',
            props: { label: 'A' },
            meta: { lane: 'left' },
          },
          {
            id: 'b',
            type: 'leaf',
            props: { label: 'B' },
            meta: { lane: 'right' },
          },
          {
            id: 'c',
            type: 'leaf',
            props: { label: 'C' },
            meta: { lane: 'left' },
          },
        ])}
      />,
    );

    expect(screen.getByTestId('left')).toHaveTextContent('AC');
    expect(screen.getByTestId('right')).toHaveTextContent('B');
  });

  it('does not put items on the element DefaultWrapper renders', () => {
    render(
      <DefaultWrapper
        data-testid="wrapper"
        items={[{ id: 'a', type: 'leaf', props: {} }]}
      >
        <span>content</span>
      </DefaultWrapper>,
    );

    expect(screen.getByTestId('wrapper')).not.toHaveAttribute('items');
  });
});
