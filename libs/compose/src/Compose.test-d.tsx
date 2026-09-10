import * as React from 'react';
import { describe, it, expectTypeOf } from 'vitest';
import { ComposeProvider, provider } from './index.js';
import type {
  PropsWithoutChildren,
  ProviderArray,
  ValidatedProviders,
  ValidateProvider,
} from './index.js';

const ThemeProvider = ({
  children,
}: React.PropsWithChildren<{
  theme: 'light' | 'dark';
  primaryColor: string;
}>) => <div>{children}</div>;

const SimpleProvider = ({ children }: React.PropsWithChildren) => (
  <div>{children}</div>
);

/** All props optional, so it is a "weak type" -- see the excess-prop case below. */
type OptProvider = (
  props: React.PropsWithChildren<{ a?: string }>,
) => React.JSX.Element;

/**
 * Applies exactly the check `ComposeProvider` applies to its `providers` prop.
 *
 * Some negative cases go through this rather than JSX: on a plain call the
 * error is always reported on the call itself, while in JSX it lands on
 * whichever attribute line the checker reaches first, which moves when the
 * formatter reflows the element. The JSX cases below cover the real call shape
 * (#21); these cover the same checks in a position that cannot drift.
 */
declare function acceptsProviders<const T extends ProviderArray>(
  providers: ValidatedProviders<T>,
): void;

describe('compose type inference', () => {
  it('strips children from a provider prop type', () => {
    expectTypeOf<PropsWithoutChildren<typeof ThemeProvider>>().toEqualTypeOf<{
      theme: 'light' | 'dark';
      primaryColor: string;
    }>();
  });

  it('accepts a bare component with no props', () => {
    acceptsProviders([SimpleProvider]);
  });

  it('accepts a correct tuple', () => {
    acceptsProviders([
      [ThemeProvider, { theme: 'dark', primaryColor: '#007acc' }],
    ]);
  });

  it('accepts the provider() helper', () => {
    acceptsProviders([
      SimpleProvider,
      provider(ThemeProvider, { theme: 'dark', primaryColor: '#007acc' }),
    ]);
  });

  it('rejects a tuple missing a required prop', () => {
    acceptsProviders([
      // @ts-expect-error primaryColor is required by ThemeProvider
      [ThemeProvider, { theme: 'dark' }],
    ]);
  });

  it('rejects a tuple with a wrong prop value', () => {
    acceptsProviders([
      // @ts-expect-error 'blue' is not assignable to 'light' | 'dark'
      [ThemeProvider, { theme: 'blue', primaryColor: '#fff' }],
    ]);
  });

  it('rejects an unknown prop on a tuple', () => {
    acceptsProviders([
      // @ts-expect-error `nope` is not a prop of ThemeProvider
      [ThemeProvider, { theme: 'dark', primaryColor: '#fff', nope: 1 }],
    ]);
  });

  it('rejects wrong props through the provider() helper too', () => {
    // @ts-expect-error primaryColor is required
    provider(ThemeProvider, { theme: 'dark' });
  });

  it('rejects a bare component that requires props', () => {
    acceptsProviders([
      // @ts-expect-error ThemeProvider requires props, so a bare component is invalid
      ThemeProvider,
    ]);
  });

  it('rejects a component placed in the props position of a tuple', () => {
    acceptsProviders([
      // @ts-expect-error the second tuple entry must be props, not another component
      [SimpleProvider, ThemeProvider],
    ]);
  });

  it('rejects excess props through provider() when passed as a variable', () => {
    const themeProps = { theme: 'dark', primaryColor: '#fff', typo: 1 };
    // @ts-expect-error `typo` is not a prop of ThemeProvider
    provider(ThemeProvider, themeProps);
  });
});

describe('compose error carriers', () => {
  it('names the missing-props case in the carrier key', () => {
    expectTypeOf<ValidateProvider<typeof ThemeProvider>>().toEqualTypeOf<{
      readonly 'ComposeError: this component requires props — use provider(Component, props) or a [Component, props] tuple': never;
    }>();
  });

  it('names the offending prop in the carrier key', () => {
    expectTypeOf<
      ValidateProvider<readonly [typeof SimpleProvider, { typo: number }]>
    >().toEqualTypeOf<{
      readonly "ComposeError: unknown prop 'typo'": never;
    }>();
  });

  // #20's headline case. A component whose props are all optional is a "weak
  // type", so an object of only unknown keys is not assignable to it -- which
  // used to route this through the repaired-shape branch and, from there, into
  // a structural comparison of `Array.prototype.every`. The excess-key check
  // has to run first for the prop to get named.
  it('names an excess prop on an all-optional-props component', () => {
    expectTypeOf<
      ValidateProvider<readonly [OptProvider, { b: number }]>
    >().toEqualTypeOf<{
      readonly "ComposeError: unknown prop 'b'": never;
    }>();
  });

  it('names the component-in-props-slot case in the carrier key', () => {
    expectTypeOf<
      ValidateProvider<readonly [typeof SimpleProvider, typeof SimpleProvider]>
    >().toEqualTypeOf<{
      readonly 'ComposeError: second tuple element must be props, not another component': never;
    }>();
  });

  it('leaves a widened ProviderArray unvalidated', () => {
    expectTypeOf<
      ValidatedProviders<ProviderArray>
    >().toEqualTypeOf<ProviderArray>();
  });
});

describe('ComposeProvider in JSX', () => {
  it('compiles an inline literal array', () => {
    const el = (
      <ComposeProvider
        providers={[
          SimpleProvider,
          [ThemeProvider, { theme: 'dark', primaryColor: '#007acc' }],
        ]}
      >
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });

  it('compiles a provider() mix', () => {
    const el = (
      <ComposeProvider
        providers={[
          SimpleProvider,
          provider(ThemeProvider, { theme: 'dark', primaryColor: '#007acc' }),
        ]}
      >
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });

  it('compiles a bare component with no required props', () => {
    const el = (
      <ComposeProvider providers={[SimpleProvider]}>
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });

  it('compiles an empty array', () => {
    const el = (
      <ComposeProvider providers={[]}>
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });

  // #19: a value already typed as `ProviderArray` has lost its element
  // identity, so there is nothing left to validate element-wise. It must still
  // be forwardable, which is the whole point of exporting the type.
  it('compiles a widened ProviderArray forwarded through a wrapper', () => {
    function AppProviders({
      providers,
      children,
    }: {
      providers: ProviderArray;
      children: React.ReactNode;
    }) {
      return (
        <ComposeProvider providers={providers}>{children}</ComposeProvider>
      );
    }
    expectTypeOf(AppProviders).toBeFunction();
  });

  it('rejects a tuple missing a required prop', () => {
    const el = (
      <ComposeProvider
        // @ts-expect-error primaryColor is required by ThemeProvider
        providers={[[ThemeProvider, { theme: 'dark' }]]}
      >
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });

  it('rejects a tuple with a wrong prop value', () => {
    const el = (
      <ComposeProvider
        // @ts-expect-error 'blue' is not assignable to 'light' | 'dark'
        providers={[[ThemeProvider, { theme: 'blue', primaryColor: '#fff' }]]}
      >
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });

  it('rejects an unknown prop on a tuple', () => {
    const el = (
      <ComposeProvider
        providers={[
          // @ts-expect-error `typo` is not a prop of ThemeProvider
          [ThemeProvider, { theme: 'dark', primaryColor: '#fff', typo: 1 }],
        ]}
      >
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });

  it('rejects excess props reaching JSX through a provider() variable', () => {
    const themeProps = { theme: 'dark', primaryColor: '#fff', typo: 1 };
    // @ts-expect-error `typo` is not a prop of ThemeProvider
    const bad = provider(ThemeProvider, themeProps);
    const el = (
      <ComposeProvider providers={[bad]}>
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });

  it('rejects a bare component that requires props', () => {
    const el = (
      <ComposeProvider
        // @ts-expect-error ThemeProvider requires props, so a bare component is invalid
        providers={[ThemeProvider]}
      >
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });

  it('rejects a component in the props slot of a tuple', () => {
    const el = (
      <ComposeProvider
        // @ts-expect-error the second tuple entry must be props, not another component
        providers={[[SimpleProvider, ThemeProvider]]}
      >
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });

  it('rejects the removed components prop', () => {
    const el = (
      <ComposeProvider
        // @ts-expect-error `components` was removed in v2.0; `providers` is required
        components={[SimpleProvider]}
      >
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });
});
