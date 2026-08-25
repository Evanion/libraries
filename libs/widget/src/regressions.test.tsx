import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PropsWithChildren, useState } from 'react';

// Deliberately imported from the public barrel rather than the internal
// modules. Every other test file imports from './widget' or './widgets'
// directly, which is exactly why the missing `export * from './widgets'` went
// unnoticed.
import { createWidgets, DefaultItem, DefaultWrapper } from './index';

type OutputProp = { Output?: React.ComponentType };

const Box = ({ label, Output }: { label: string } & OutputProp) => (
  <div data-testid={`box-${label}`}>
    <span>{label}</span>
    {Output ? <Output /> : null}
  </div>
);

const Leaf = ({ label }: { label: string }) => (
  <span data-testid={`leaf-${label}`}>{label}</span>
);

/** A widget holding its own state, to detect remounts. */
const Counter = ({ Output }: OutputProp) => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button data-testid="inc" onClick={() => setCount((c) => c + 1)}>
        count:{count}
      </button>
      {Output ? <Output /> : null}
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
              type: 'box',
              props: { label: 'a' },
              children: [
                {
                  id: 'b',
                  type: 'box',
                  props: { label: 'b' },
                  children: [{ id: 'c', type: 'leaf', props: { label: 'c' } }],
                },
              ],
            },
          ]}
        />,
      );

      expect(screen.getByTestId('box-a')).toBeInTheDocument();
      expect(screen.getByTestId('box-b')).toBeInTheDocument();
      // This is the level that used to be silently dropped: Output rendered
      // grandchildren without passing an Output of their own.
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
              type: 'box',
              props: { label: '1' },
              children: [
                {
                  id: '2',
                  type: 'box',
                  props: { label: '2' },
                  children: [
                    {
                      id: '3',
                      type: 'box',
                      props: { label: '3' },
                      children: [
                        { id: '4', type: 'leaf', props: { label: '4' } },
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
              type: 'box',
              props: { label: 'p1' },
              children: [{ id: 'c1', type: 'leaf', props: { label: 'c1' } }],
            },
            {
              id: 'p2',
              type: 'box',
              props: { label: 'p2' },
              children: [{ id: 'c2', type: 'leaf', props: { label: 'c2' } }],
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

        // `type in components` walked the prototype chain and handed React
        // Object.prototype.toString, crashing instead of warning and skipping.
        expect(() =>
          render(<Widgets items={[{ id: 'x', type, props: {} }]} />),
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
          items={[{ id: 'ok', type: 'leaf', props: { label: 'ok' } }]}
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
              type: 'box',
              props: { label: 'a' },
              children: [{ id: 'b', type: 'leaf', props: { label: 'b' } }],
            },
          ]}
        />,
      );

      // Output used to fall back to the factory-level chrome, so nested items
      // silently lost the instance override.
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
          children: [{ id: 'inner', type: 'counter', props: {} }],
        },
      ];

      const { rerender } = render(<Widgets items={items} />);

      fireEvent.click(screen.getByTestId('inc'));
      fireEvent.click(screen.getByTestId('inc'));
      expect(screen.getByTestId('inc')).toHaveTextContent('count:2');

      // A fresh array identity forces Widgets to re-render. The injected Output
      // used to be a brand-new component type each time, so React remounted the
      // nested subtree and the counter reset to 0.
      rerender(<Widgets items={[...items]} />);

      expect(screen.getByTestId('inc')).toHaveTextContent('count:2');
    });
  });
});
