import { describe, it, expect } from 'vitest';
import * as React from 'react';
import * as pkg from './index.js';
import { createWidgets } from './index.js';

/**
 * Holds `@evanion/react-widget` to its promise of being importable from a React
 * Server Component.
 *
 * This file runs in the `@evanion/react-widget:react-server` vitest project,
 * which resolves react under its `react-server` export condition.
 * `react/package.json` maps that condition to `react.react-server.js`, which
 * exports no createContext, useContext, Component, PureComponent or stateful
 * hook, so an import of one is `undefined` and fails at module evaluation. No
 * other suite resolves that condition: the library build and the jsdom project
 * both get the default entry, where all of them exist.
 *
 * Rendering is driven by invoking the component functions and walking the
 * element tree they return, because there is no renderer to call --
 * `react-dom/server` resolves under this condition to a module whose only
 * statement throws "react-dom/server is not supported in React Server
 * Components". Walking the tree still executes every line of `renderWidget`,
 * since the recursion happens during render rather than lazily.
 */

type Element = React.ReactElement<Record<string, unknown>>;

/** `memo(fn)` is an object, not a callable; its `.type` is the render function. */
function renderMemo<P>(
  component: React.MemoExoticComponent<React.ComponentType<P>>,
  props: P,
): React.ReactNode {
  return (component.type as (props: P) => React.ReactNode)(props);
}

function flatten(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...flatten(element.props['children'] as React.ReactNode)];
}

const Leaf = ({ label }: { label: string }) => <span>{label}</span>;
const Box = ({ children }: { children?: React.ReactNode }) => (
  <div>{children}</div>
);

describe('the react-server export condition', () => {
  it('really is active, or every other test in this file proves nothing', () => {
    const react = React as unknown as Record<string, unknown>;
    expect(react['createContext']).toBeUndefined();
    expect(react['useContext']).toBeUndefined();
    expect(react['useState']).toBeUndefined();
    expect(react['Component']).toBeUndefined();
    expect(React.Suspense).toBeDefined();
    expect(React.memo).toBeDefined();
  });
});

describe('@evanion/react-widget under react-server', () => {
  it('evaluates without touching a client-only React export', () => {
    expect(pkg.createWidgets).toBeTypeOf('function');
    expect(pkg.validateItems).toBeTypeOf('function');
    expect(pkg.DefaultItem).toBeTypeOf('function');
    expect(pkg.DefaultWrapper).toBeTypeOf('function');
  });

  it('keeps internals and client-only shapes out of the published surface', () => {
    // A provider, a hook, a context and a class error boundary each need a
    // react export this condition omits, so none of them can be exported. The
    // render internals are absent for a different reason: nothing outside the
    // package may depend on them.
    const surface = pkg as unknown as Record<string, unknown>;
    expect(surface['WidgetsProvider']).toBeUndefined();
    expect(surface['useWidgets']).toBeUndefined();
    expect(surface['Output']).toBeUndefined();
    expect(surface['WidgetErrorBoundary']).toBeUndefined();
    // renderWidget is an internal, not part of the published surface.
    expect(surface['renderWidget']).toBeUndefined();
    expect(surface['NestedWidgetsContext']).toBeUndefined();
  });

  it('renders a nested tree without throwing', () => {
    const { Widgets } = createWidgets({ components: { box: Box, leaf: Leaf } });

    const tree = renderMemo(Widgets, {
      items: [
        {
          id: 'outer',
          type: 'box' as const,
          props: {},
          children: [{ id: 'inner', type: 'leaf' as const, props: { label: 'x' } }],
        },
      ],
    });

    const elements = flatten(tree);
    expect(elements.some((e) => e.type === Box)).toBe(true);
    expect(elements.some((e) => e.type === Leaf)).toBe(true);
    expect(elements.some((e) => e.type === React.Suspense)).toBe(true);
  });

  it('validates items without importing a renderer', () => {
    const { validateItems } = createWidgets({ components: { leaf: Leaf } });
    expect(validateItems([{ id: 'a', type: 'nope', props: {} }])).toHaveLength(1);
  });
});
