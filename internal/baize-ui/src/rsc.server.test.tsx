import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { AvailabilityPill, Card, Stat, StatLine, Title } from './index.js';

/**
 * Evidence that the consequence of statelessness holds in a real resolver.
 *
 * This file runs in the `@evanion/baize-ui:react-server` vitest project, which
 * resolves react under its `react-server` export condition.
 * `react/package.json` maps that condition to `react.react-server.js`, which
 * exports no createContext, useContext, Component or stateful hook, so an import
 * of one is `undefined` and fails at module evaluation.
 *
 * It is explicitly not the contract. `useMemo` exists under this condition, so
 * this project would pass a library that memoises -- which is not stateless and is
 * not what this package promises. `react-imports.test.ts` is the contract.
 *
 * Rendering is by invoking the component functions and walking the tree they
 * return, because `react-dom/server` resolves under this condition to a module
 * whose only statement throws.
 */
type Element = React.ReactElement<Record<string, unknown>>;

function flatten(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...flatten(element.props['children'] as React.ReactNode)];
}

describe('the react-server export condition', () => {
  it('really is active, or every other test in this file proves nothing', () => {
    const react = React as unknown as Record<string, unknown>;

    expect(react['createContext']).toBeUndefined();
    expect(react['useContext']).toBeUndefined();
    expect(react['useState']).toBeUndefined();
    expect(react['useEffect']).toBeUndefined();
    expect(react['Component']).toBeUndefined();
  });
});

describe('@evanion/baize-ui under react-server', () => {
  it('renders a card of primitives', () => {
    const tree = Card({
      head: Title({ children: 'Wingspan', complexity: 3 }),
      foot: AvailabilityPill({ availability: 'inStock', label: 'in stock' }),
      children: StatLine({
        children: [
          Stat({ figure: '1–5', label: 'players' }),
          Stat({ figure: '40–70 min', label: 'playtime' }),
        ],
      }),
    });

    const classes = flatten(tree)
      .map((element) => element.props['className'])
      .filter((value): value is string => typeof value === 'string');

    expect(classes).toContain('baize-card');
    expect(classes).toContain('baize-statline baize-statline--size-base');
    expect(classes.join(' ')).toContain('baize-ladder-3');
  });
});
