import * as React from 'react';
import { describe, it, expectTypeOf } from 'vitest';
import { ComposeProvider, provider } from './index';
import type {
  PropsWithoutChildren,
  ProviderArray,
  ValidateProviders,
} from './index';

const ThemeProvider = ({
  children,
}: React.PropsWithChildren<{
  theme: 'light' | 'dark';
  primaryColor: string;
}>) => <div>{children}</div>;

const SimpleProvider = ({ children }: React.PropsWithChildren) => (
  <div>{children}</div>
);

/**
 * Applies exactly the check `ComposeProvider` applies to its `providers` prop.
 *
 * The negative cases go through this rather than JSX on purpose: inside JSX the
 * error is reported against whichever attribute line overload resolution lands
 * on, which moves whenever the formatter reflows the element -- so
 * `@ts-expect-error` silently stops covering the thing it was written for. On a
 * plain call the error is always on the call itself.
 */
declare function acceptsProviders<const T extends ProviderArray>(
  providers: T & ValidateProviders<T>,
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

  // Positive JSX cases, to prove the generic overloads still resolve in real use.
  it('compiles a correct ComposeProvider element', () => {
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

  it('compiles the deprecated components prop', () => {
    const el = (
      <ComposeProvider components={[SimpleProvider]}>
        <span />
      </ComposeProvider>
    );
    expectTypeOf(el).toMatchTypeOf<React.ReactElement>();
  });
});
