import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PropsWithChildren, useState } from 'react';

// Imported from the public barrel, unlike every other test file here, which
// reaches './widget.js' and './widgets.js' directly. Only this import path can
// tell that a re-export is missing from `src/index.ts`, which is what a
// consumer resolves.
import { createWidgets, DefaultItem, DefaultWrapper } from './index.js';

const Box = ({ label, children }: PropsWithChildren<{ label: string }>) => (
  <div data-testid={`box-${label}`}>
    <span>{label}</span>
    {children}
  </div>
);

const Leaf = ({ label }: { label: string }) => (
  <span data-testid={`leaf-${label}`}>{label}</span>
);

/** A widget holding its own state, to detect remounts. */
const Counter = ({ children }: PropsWithChildren) => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button data-testid="inc" onClick={() => setCount((c) => c + 1)}>
        count:{count}
      </button>
      {children}
    </div>
  );
};

describe('widget regressions', () => {
  beforeEach(() => cleanup());

  describe('public barrel', () => {
    it('exports the chrome components the docs tell people to import', () => {
      expect(DefaultWrapper).toBeTypeOf('function');
      expect(DefaultItem).toBeTypeOf('function');
    });
  });

  describe('nesting depth', () => {
    it('renders three levels deep, not just two', () => {
      const { Widgets } = createWidgets({
        components: { box: Box, leaf: Leaf },
      });

      render(
        <Widgets
          items={[
            {
              id: 'a',
              type: 'box' as const,
              props: { label: 'a' },
              children: [
                {
                  id: 'b',
                  type: 'box' as const,
                  props: { label: 'b' },
                  children: [
                    { id: 'c', type: 'leaf' as const, props: { label: 'c' } },
                  ],
                },
              ],
            },
          ]}
        />,
      );

      expect(screen.getByTestId('box-a')).toBeInTheDocument();
      expect(screen.getByTestId('box-b')).toBeInTheDocument();
      // The grandchild is the assertion: `renderWidget` recurses through
      // `item.children` at every level, so a renderer that handles only the
      // first level renders a and b and drops c without warning.
      expect(screen.getByTestId('leaf-c')).toBeInTheDocument();
    });

    it('renders four levels deep', () => {
      const { Widgets } = createWidgets({
        components: { box: Box, leaf: Leaf },
      });

      render(
        <Widgets
          items={[
            {
              id: '1',
              type: 'box' as const,
              props: { label: '1' },
              children: [
                {
                  id: '2',
                  type: 'box' as const,
                  props: { label: '2' },
                  children: [
                    {
                      id: '3',
                      type: 'box' as const,
                      props: { label: '3' },
                      children: [
                        {
                          id: '4',
                          type: 'leaf' as const,
                          props: { label: '4' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ]}
        />,
      );

      expect(screen.getByTestId('leaf-4')).toBeInTheDocument();
    });

    it('scopes children to their own parent', () => {
      const { Widgets } = createWidgets({
        components: { box: Box, leaf: Leaf },
      });

      render(
        <Widgets
          items={[
            {
              id: 'p1',
              type: 'box' as const,
              props: { label: 'p1' },
              children: [
                { id: 'c1', type: 'leaf' as const, props: { label: 'c1' } },
              ],
            },
            {
              id: 'p2',
              type: 'box' as const,
              props: { label: 'p2' },
              children: [
                { id: 'c2', type: 'leaf' as const, props: { label: 'c2' } },
              ],
            },
          ]}
        />,
      );

      expect(screen.getByTestId('box-p1')).toContainElement(
        screen.getByTestId('leaf-c1'),
      );
      expect(screen.getByTestId('box-p2')).toContainElement(
        screen.getByTestId('leaf-c2'),
      );
      expect(screen.getByTestId('box-p1')).not.toContainElement(
        screen.getByTestId('leaf-c2'),
      );
    });
  });

  describe('untrusted widget types', () => {
    it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty'])(
      'refuses to render the inherited key %s',
      (type) => {
        const warn = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => undefined);
        const { Widgets } = createWidgets({ components: { leaf: Leaf } });

        // `in` walks the prototype chain, so a lookup written that way finds
        // these keys on Object.prototype and hands React a built-in function
        // as a component. Items are untrusted CMS data, so the renderer owes
        // the same warn-and-skip here as for any unknown type.
        expect(() =>
          render(
            <Widgets
              items={[
                { id: 'x', type, props: {} } as unknown as {
                  id: string;
                  type: 'leaf';
                  props: { label: string };
                },
              ]}
            />,
          ),
        ).not.toThrow();

        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining(`Unknown widget type "${type}"`),
        );
        warn.mockRestore();
      },
    );

    it('still renders known types normally', () => {
      const { Widgets } = createWidgets({ components: { leaf: Leaf } });
      render(
        <Widgets
          items={[{ id: 'ok', type: 'leaf' as const, props: { label: 'ok' } }]}
        />,
      );
      expect(screen.getByTestId('leaf-ok')).toBeInTheDocument();
    });
  });

  describe('instance chrome', () => {
    it('applies instance-level item chrome to nested widgets too', () => {
      const { Widgets } = createWidgets({
        components: { box: Box, leaf: Leaf },
      });

      const CustomItem = ({ children, ...rest }: PropsWithChildren) => (
        <div data-custom-item="yes" {...rest}>
          {children}
        </div>
      );

      const { container } = render(
        <Widgets
          chrome={{ item: CustomItem }}
          items={[
            {
              id: 'a',
              type: 'box' as const,
              props: { label: 'a' },
              children: [
                { id: 'b', type: 'leaf' as const, props: { label: 'b' } },
              ],
            },
          ]}
        />,
      );

      // Two, not one: `renderWidget` threads the resolved chrome through the
      // recursion, so the nested item is wrapped in the instance-level
      // override rather than falling back to the factory's.
      expect(
        container.querySelectorAll('[data-custom-item="yes"]'),
      ).toHaveLength(2);
    });
  });

  describe('nested subtree stability', () => {
    it('preserves nested widget state across a parent re-render', () => {
      const { Widgets } = createWidgets({
        components: { box: Box, counter: Counter },
      });

      const items = [
        {
          id: 'outer',
          type: 'box' as const,
          props: { label: 'outer' },
          children: [{ id: 'inner', type: 'counter' as const, props: {} }],
        },
      ];

      const { rerender } = render(<Widgets items={items} />);

      fireEvent.click(screen.getByTestId('inc'));
      fireEvent.click(screen.getByTestId('inc'));
      expect(screen.getByTestId('inc')).toHaveTextContent('count:2');

      // A fresh array identity defeats the `memo` and forces a re-render.
      // React remounts a subtree whenever the element type at that position
      // changes identity, so the renderer has to reuse the same component
      // references across renders rather than defining any of them per render;
      // the counter's state is what shows it does.
      rerender(<Widgets items={[...items]} />);

      expect(screen.getByTestId('inc')).toHaveTextContent('count:2');
    });
  });
});
