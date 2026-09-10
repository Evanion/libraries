import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import { createWidgets } from './widget.js';
import type { WidgetItemComponent } from './types.js';

/** Records every prop it is handed, so props that must NOT arrive are visible. */
const spyProps = vi.fn();

const Leaf = (props: { label: string }) => {
  spyProps(props);
  return <span data-testid={`leaf-${props.label}`}>{props.label}</span>;
};

describe('item meta (#71)', () => {
  beforeEach(() => {
    cleanup();
    spyProps.mockClear();
  });

  it('forwards meta to chrome.item so a wrapper can place the widget', () => {
    const GridItem: WidgetItemComponent = ({ children, meta, ...rest }) => (
      <div
        {...rest}
        data-testid="grid-item"
        style={{
          gridColumn: `${meta?.['column']} / span ${meta?.['columnSpan']}`,
        }}
      >
        {children}
      </div>
    );

    const { Widgets } = createWidgets({
      components: { leaf: Leaf },
      chrome: { item: GridItem },
    });

    render(
      <Widgets
        items={[
          {
            id: 'a',
            type: 'leaf' as const,
            props: { label: 'a' },
            meta: { column: 1, columnSpan: 4 },
          },
        ]}
      />,
    );

    expect(screen.getByTestId('grid-item')).toHaveStyle(
      'grid-column: 1 / span 4',
    );
  });

  it('never spreads meta into the widget props', () => {
    const { Widgets } = createWidgets({ components: { leaf: Leaf } });

    render(
      <Widgets
        items={[
          {
            id: 'a',
            type: 'leaf' as const,
            props: { label: 'a' },
            meta: { column: 1 },
          },
        ]}
      />,
    );

    expect(spyProps).toHaveBeenCalledTimes(1);
    expect(spyProps.mock.calls[0]?.[0]).not.toHaveProperty('meta');
    expect(spyProps.mock.calls[0]?.[0]).not.toHaveProperty('column');
  });

  it('forwards meta to nested items too', () => {
    const seen: unknown[] = [];
    const RecordingItem: WidgetItemComponent = ({ children, meta }) => {
      seen.push(meta);
      return <div>{children}</div>;
    };
    const Box = ({ children }: PropsWithChildren) => <div>{children}</div>;

    const { Widgets } = createWidgets({
      components: { box: Box, leaf: Leaf },
      chrome: { item: RecordingItem },
    });

    render(
      <Widgets
        items={[
          {
            id: 'outer',
            type: 'box' as const,
            props: {},
            meta: { row: 1 },
            children: [
              {
                id: 'inner',
                type: 'leaf' as const,
                props: { label: 'x' },
                meta: { row: 2 },
              },
            ],
          },
        ]}
      />,
    );

    expect(seen).toEqual([{ row: 1 }, { row: 2 }]);
  });

  it('does not leak meta onto the DOM node of the default item chrome', () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { Widgets } = createWidgets({ components: { leaf: Leaf } });

    const { container } = render(
      <Widgets
        items={[
          {
            id: 'a',
            type: 'leaf' as const,
            props: { label: 'a' },
            meta: { column: 1 },
          },
        ]}
      />,
    );

    const wrapper = container.querySelector('[data-widget-id="a"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.hasAttribute('meta')).toBe(false);
    // React logs "Invalid value for prop" / unknown-attribute warnings through
    // console.error; a clean run proves meta never reached the DOM.
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('keeps the data-widget-* attributes on the default item chrome', () => {
    const { Widgets } = createWidgets({ components: { leaf: Leaf } });

    const { container } = render(
      <Widgets
        items={[{ id: 'a', type: 'leaf' as const, props: { label: 'a' } }]}
      />,
    );

    const wrapper = container.querySelector('[data-widget-id="a"]');
    expect(wrapper).toHaveAttribute('data-widget-type', 'leaf');
  });
});
