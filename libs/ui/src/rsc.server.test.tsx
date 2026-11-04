import * as React from 'react';
import { describe, expect, it } from 'vitest';

import {
  Alert,
  Badge,
  Card,
  CodeBlock,
  CopyValue,
  Dialog,
  Field,
  PageHeader,
  Switch,
} from './index.js';

/**
 * Runs in the `@evanion/ui:react-server` project, where React resolves to the
 * build that exports no hook, context or class component. A component that
 * reached for one would be `undefined` at the call and throw here.
 *
 * `react-dom/server` throws under this condition, so the components are
 * called as functions and their trees walked.
 */
type Element = React.ReactElement<Record<string, unknown>>;

function flatten(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  const expanded =
    typeof element.type === 'function'
      ? flatten(
          (element.type as (props: unknown) => React.ReactNode)(element.props),
        )
      : [];
  return [
    element,
    ...expanded,
    ...flatten(element.props['children'] as React.ReactNode),
  ];
}

describe('the react-server export condition', () => {
  it('really is active, or the next test proves nothing', () => {
    const react = React as unknown as Record<string, unknown>;

    expect(react['useState']).toBeUndefined();
    expect(react['createContext']).toBeUndefined();
    expect(react['Component']).toBeUndefined();
  });
});

describe('@evanion/ui under react-server', () => {
  it('renders every component', () => {
    const tree = Card({
      title: 'Flags',
      children: [
        PageHeader({ title: 'Flags' }),
        Field({ id: 'slug', label: 'Slug', hint: 'Lowercase' }),
        Switch({ checked: true, label: 'checkout-v2' }),
        Badge({ tone: 'positive', children: 'On' }),
        Alert({ children: 'Failed' }),
        CopyValue({ value: 'v1', copyLabel: 'Copy', copiedLabel: 'Copied' }),
        CodeBlock({ code: 'x', label: 'Shell', copyLabel: 'Copy' }),
        Dialog({ id: 'd', title: 'T', closeLabel: 'Close', children: 'x' }),
      ],
    });

    const classes = flatten(tree)
      .map((element) => element.props['className'])
      .filter((value): value is string => typeof value === 'string');

    expect(classes).toEqual(
      expect.arrayContaining([
        'card',
        'page-header',
        'field',
        'switch',
        'badge',
        'alert',
        'copy-value',
        'code-block',
        'dialog',
      ]),
    );
  });
});
