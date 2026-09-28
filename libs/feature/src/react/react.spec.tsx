import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { createFeatures, type Definitions } from '../lib/features.js';
import {
  createFeatureContext,
  FeatureProvider,
  useFeature,
  useFeatureEnabled,
  useFeatures,
  useVariant,
} from './index.js';

type Key = 'payments-v3' | 'checkout-v2' | 'checkout-express';

const definitions = [
  {
    key: 'payments-v3',
    enabled: true,
    rules: [
      {
        id: 'window-q4',
        when: [{ field: 'now', op: 'after', value: '2026-10-01T00:00:00Z' }],
      },
    ],
  },
  { key: 'checkout-v2', enabled: true, dependsOn: ['payments-v3'] },
  { key: 'checkout-express', enabled: true, dependsOn: ['checkout-v2'] },
] as const satisfies Definitions<Key>;

const inWindow = { now: new Date('2026-10-15T00:00:00Z') };
const outsideWindow = { now: new Date('2026-09-01T00:00:00Z') };

function Flag({ name }: { name: Key }) {
  const decision = useFeature(name);
  return (
    <span data-testid={name}>
      {decision.enabled ? 'on' : `off:${decision.reason}`}
    </span>
  );
}

describe('FeatureProvider', () => {
  it('exposes the resolved decision for every feature', () => {
    render(
      <FeatureProvider
        features={createFeatures(definitions)}
        context={inWindow}
      >
        <Flag name="payments-v3" />
        <Flag name="checkout-express" />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('payments-v3')).toHaveTextContent('on');
    expect(screen.getByTestId('checkout-express')).toHaveTextContent('on');
  });

  it('cascades through the provider, explanation included', () => {
    render(
      <FeatureProvider
        features={createFeatures(definitions)}
        context={outsideWindow}
      >
        <Flag name="checkout-express" />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('checkout-express')).toHaveTextContent(
      'off:dependency-off',
    );
  });

  it('resolves once per context rather than on every render', () => {
    const features = createFeatures(definitions);
    let resolves = 0;
    const counted = {
      ...features,
      resolve: (context?: Parameters<typeof features.resolve>[0]) => {
        resolves++;
        return features.resolve(context);
      },
    };

    function Rerender() {
      const [count, setCount] = useState(0);
      return (
        <FeatureProvider features={counted} context={inWindow}>
          <button onClick={() => setCount(count + 1)}>render {count}</button>
          <Flag name="checkout-v2" />
        </FeatureProvider>
      );
    }

    const { rerender } = render(<Rerender />);
    rerender(<Rerender />);
    rerender(<Rerender />);

    expect(resolves).toBe(1);
  });

  it('accepts decisions resolved elsewhere, such as a build snapshot', () => {
    const snapshot = createFeatures(definitions).resolve(inWindow);

    render(
      <FeatureProvider
        features={createFeatures(definitions)}
        decisions={snapshot}
        // A context that would resolve everything off, to prove the supplied
        // decisions are the ones used.
        context={outsideWindow}
      >
        <Flag name="checkout-express" />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('checkout-express')).toHaveTextContent('on');
  });
});

describe('useFeatureEnabled', () => {
  it('returns the boolean decision', () => {
    function Gate() {
      return <span>{useFeatureEnabled('checkout-v2') ? 'on' : 'off'}</span>;
    }

    render(
      <FeatureProvider
        features={createFeatures(definitions)}
        context={inWindow}
      >
        <Gate />
      </FeatureProvider>,
    );

    expect(screen.getByText('on')).toBeInTheDocument();
  });
});

describe('useFeatures', () => {
  it('returns every decision at once', () => {
    function All() {
      const decisions = useFeatures();
      return <span>{Object.keys(decisions).sort().join(',')}</span>;
    }

    render(
      <FeatureProvider
        features={createFeatures(definitions)}
        context={inWindow}
      >
        <All />
      </FeatureProvider>,
    );

    expect(
      screen.getByText('checkout-express,checkout-v2,payments-v3'),
    ).toBeInTheDocument();
  });
});

describe('useVariant', () => {
  it('reads the assigned variant and its value', () => {
    const features = createFeatures([
      {
        key: 'cta',
        enabled: true,
        variants: [{ name: 'only', weight: 1, value: { label: 'Buy' } }],
      },
    ]);

    function Reader() {
      const { variant, value } = useVariant('cta');
      return (
        <span data-testid="cta">
          {`${String(variant)}:${String((value as { label: string }).label)}`}
        </span>
      );
    }

    render(
      <FeatureProvider features={features} context={{ targetingKey: 'u' }}>
        <Reader />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('only:Buy');
  });

  it('reads no variant from a feature that resolved off', () => {
    const features = createFeatures([
      { key: 'cta', enabled: false, variants: [{ name: 'only', weight: 1 }] },
    ]);

    function Reader() {
      const { variant } = useVariant('cta');
      return (
        <span data-testid="cta">
          {variant === undefined ? 'none' : variant}
        </span>
      );
    }

    render(
      <FeatureProvider features={features} context={{ targetingKey: 'u' }}>
        <Reader />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('none');
  });

  it('throws for a key the provider does not carry', () => {
    const features = createFeatures([{ key: 'cta', enabled: true }]);

    function Reader() {
      useVariant('nope' as 'cta');
      return null;
    }

    expect(() =>
      render(
        <FeatureProvider features={features}>
          <Reader />
        </FeatureProvider>,
      ),
    ).toThrow(/nope/);
  });
});

describe('misuse', () => {
  it('throws outside a provider', () => {
    function Orphan() {
      useFeatures();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(/FeatureProvider/);
  });

  describe('useFeature', () => {
    it('throws for a feature that is not configured', () => {
      function Unknown() {
        useFeature('nope' as Key);
        return null;
      }

      expect(() =>
        render(
          <FeatureProvider
            features={createFeatures(definitions)}
            context={inWindow}
          >
            <Unknown />
          </FeatureProvider>,
        ),
      ).toThrow(/nope/);
    });

    it.each([
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      '__proto__',
    ])(
      'throws for the inherited key %s rather than handing it back as a decision',
      (key) => {
        function Unknown() {
          useFeature(key as Key);
          return null;
        }

        expect(() =>
          render(
            <FeatureProvider
              features={createFeatures(definitions)}
              context={inWindow}
            >
              <Unknown />
            </FeatureProvider>,
          ),
        ).toThrow(new RegExp(key));
      },
    );
  });
});

describe('createFeatureContext', () => {
  const cta = createFeatures([
    {
      key: 'cta',
      enabled: true,
      variants: [{ name: 'only', weight: 1, value: { label: 'Buy' } }],
    },
  ]);

  it('renders the bound provider and answers its own hooks', () => {
    const bound = createFeatureContext(cta);

    function Reader() {
      const { variant, value } = bound.useVariant('cta');
      const enabled = bound.useFeatureEnabled('cta');
      return (
        <span data-testid="cta">
          {`${String(enabled)}:${String(variant)}:${String(
            (value as { label: string }).label,
          )}`}
        </span>
      );
    }

    render(
      <bound.FeatureProvider context={{ targetingKey: 'u' }}>
        <Reader />
      </bound.FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('true:only:Buy');
  });

  it('publishes to the package context, so the plain hooks read the same decisions', () => {
    const bound = createFeatureContext(cta);

    function Plain() {
      return (
        <span data-testid="plain">{String(useFeature('cta').variant)}</span>
      );
    }

    render(
      <bound.FeatureProvider context={{ targetingKey: 'u' }}>
        <Plain />
      </bound.FeatureProvider>,
    );

    expect(screen.getByTestId('plain')).toHaveTextContent('only');
  });

  it('resolves a store handed to the provider over the one the factory holds', () => {
    const bound = createFeatureContext(cta);
    const off = createFeatures([
      { key: 'cta', enabled: false, variants: [{ name: 'only', weight: 1 }] },
    ]);

    function Reader() {
      return (
        <span data-testid="cta">
          {bound.useFeatureEnabled('cta') ? 'on' : 'off'}
        </span>
      );
    }

    render(
      <bound.FeatureProvider features={off} context={{ targetingKey: 'u' }}>
        <Reader />
      </bound.FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('off');
  });

  it('keeps each factory reading its own store when two nest', () => {
    const outer = createFeatureContext(cta);
    const inner = createFeatureContext(
      createFeatures([{ key: 'banner', enabled: false }]),
    );

    function Reader() {
      const outerEnabled = outer.useFeatureEnabled('cta');
      const innerEnabled = inner.useFeatureEnabled('banner');
      return (
        <span data-testid="both">{`${String(outerEnabled)}:${String(
          innerEnabled,
        )}`}</span>
      );
    }

    render(
      <outer.FeatureProvider context={{ targetingKey: 'u' }}>
        <inner.FeatureProvider>
          <Reader />
        </inner.FeatureProvider>
      </outer.FeatureProvider>,
    );

    expect(screen.getByTestId('both')).toHaveTextContent('true:false');
  });

  it('reads a feature keyed by a numeric enum', () => {
    // FeatureKey is string | number and types.ts:3-6 states the numeric case is
    // deliberate, so a numeric key reaches the hook and indexes the schema.
    enum Flag {
      Cta = 1,
    }
    const numeric = createFeatures([
      { key: Flag.Cta, enabled: true, variants: [{ name: 'only', weight: 1 }] },
    ]);
    const bound = createFeatureContext(numeric);

    function Reader() {
      return (
        <span data-testid="numeric">
          {String(bound.useVariant(Flag.Cta).variant)}
        </span>
      );
    }

    render(
      <bound.FeatureProvider context={{ targetingKey: 'u' }}>
        <Reader />
      </bound.FeatureProvider>,
    );

    expect(screen.getByTestId('numeric')).toHaveTextContent('only');
  });

  it('throws for a key the bound provider does not carry', () => {
    const bound = createFeatureContext(cta);

    function Reader() {
      bound.useFeature('nope' as 'cta');
      return null;
    }

    expect(() =>
      render(
        <bound.FeatureProvider>
          <Reader />
        </bound.FeatureProvider>,
      ),
    ).toThrow(/nope/);
  });
});
