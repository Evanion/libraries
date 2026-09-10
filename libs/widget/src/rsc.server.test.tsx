import { describe, it, expect } from 'vitest';
import * as React from 'react';
import * as pkg from './index.js';
import { createWidgets } from './index.js';

/**
 * This file runs in the `@evanion/react-widget:react-server` vitest project,
 * which resolves react under its `react-server` export condition. That build
 * omits createContext, useContext, Component, PureComponent and every stateful
 * hook, so any of them creeping back into the package fails here at module
 * evaluation -- which is exactly the failure mode that shipped as #22 and that
 * the `'use client'` directive was papering over.
 *
 * There is no DOM renderer under this condition (`react-dom/server` throws
 * outright), so rendering is driven by invoking the component functions and
 * walking the element tree they return. That still executes every line of
 * `renderWidget`, because the recursion happens during render, not lazily.
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

  it('no longer exports the context-based surface', () => {
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
