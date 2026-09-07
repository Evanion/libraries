import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { createContext } from 'react';
import { createWidgets } from './widget.js';

const DefaultLeaf = ({ label }: { label: string }) => (
  <span data-testid={`default-leaf-${label}`}>{label}</span>
);

const OverrideLeaf = ({ label }: { label: string }) => (
  <span data-testid={`override-leaf-${label}`}>{label}</span>
);

describe('WidgetsProvider value is not shadowed by Widgets', () => {
  beforeEach(() => cleanup());

  it('uses inherited context components when no factory default exists', () => {
    type LeafMap = { leaf: typeof DefaultLeaf };
    const LeafContext = createContext<LeafMap>({ leaf: DefaultLeaf });

    const DifferentDefault = ({ label }: { label: string }) => (
      <span data-testid={`different-default-${label}`}>{label}</span>
    );

    const { Widgets, WidgetsProvider } = createWidgets<LeafMap>({
      components: {} as unknown as LeafMap,
      context: LeafContext as unknown as React.Context<LeafMap>,
    });

    render(
      <LeafContext.Provider value={{ leaf: OverrideLeaf }}>
        <WidgetsProvider value={{ leaf: DifferentDefault }}>
          <Widgets
            items={[{ id: 'a', type: 'leaf', props: { label: 'a' } }]}
          />
        </WidgetsProvider>
      </LeafContext.Provider>,
    );

    expect(screen.getByTestId('different-default-a')).toBeInTheDocument();
    expect(screen.queryByTestId('default-leaf-a')).not.toBeInTheDocument();
  });

  it('factory defaults still override inherited context', () => {
    type LeafMap = { leaf: typeof DefaultLeaf };
    const LeafContext = createContext<LeafMap>({ leaf: DefaultLeaf });

    const { Widgets, WidgetsProvider } = createWidgets<LeafMap>({
      components: { leaf: DefaultLeaf },
      context: LeafContext,
    });

    render(
      <LeafContext.Provider value={{ leaf: OverrideLeaf }}>
        <WidgetsProvider value={{ leaf: DefaultLeaf }}>
          <Widgets
            items={[{ id: 'a', type: 'leaf', props: { label: 'a' } }]}
          />
        </WidgetsProvider>
      </LeafContext.Provider>,
    );

    expect(screen.getByTestId('default-leaf-a')).toBeInTheDocument();
    expect(screen.queryByTestId('override-leaf-a')).not.toBeInTheDocument();
  });

  it('instance components override factory defaults and inherited context', () => {
    type LeafMap = { leaf: typeof DefaultLeaf };
    const LeafContext = createContext<LeafMap>({ leaf: DefaultLeaf });

    const { Widgets, WidgetsProvider } = createWidgets<LeafMap>({
      components: { leaf: DefaultLeaf },
      context: LeafContext,
    });

    const InstanceLeaf = ({ label }: { label: string }) => (
      <span data-testid={`instance-leaf-${label}`}>{label}</span>
    );

    render(
      <LeafContext.Provider value={{ leaf: OverrideLeaf }}>
        <WidgetsProvider value={{ leaf: DefaultLeaf }}>
          <Widgets
            items={[{ id: 'a', type: 'leaf', props: { label: 'a' } }]}
            components={{ leaf: InstanceLeaf }}
          />
        </WidgetsProvider>
      </LeafContext.Provider>,
    );

    expect(screen.getByTestId('instance-leaf-a')).toBeInTheDocument();
  });
});
