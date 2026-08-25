import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ComposeProvider, provider } from './index';
import type { ComposeProviderProps, LegacyComposeProviderProps } from './index';

/**
 * `ComposeProvider` is now generic and overloaded, so props built dynamically
 * (a union, or an object missing `providers` entirely) no longer resolve
 * against either overload -- which is the point. These tests exercise the
 * runtime guards for input a JavaScript consumer can still produce, so they go
 * through a deliberately loosened alias.
 */
const LooseComposeProvider = ComposeProvider as unknown as React.FC<
  Record<string, unknown>
>;

// Example provider components with different prop types
interface ThemeProviderProps {
  theme: 'light' | 'dark';
  primaryColor: string;
}

interface AuthProviderProps {
  user: { id: string; name: string };
  token: string;
}

const ThemeProvider: React.FC<React.PropsWithChildren<ThemeProviderProps>> = ({
  children,
  theme,
  primaryColor,
}) => (
  <div data-theme={theme} data-color={primaryColor}>
    {children}
  </div>
);

const AuthProvider: React.FC<React.PropsWithChildren<AuthProviderProps>> = ({
  children,
  user,
  token,
}) => (
  <div data-user={user.id} data-token={token}>
    {children}
  </div>
);

const SimpleProvider: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="simple">{children}</div>
);

describe('ComposeProvider', () => {
  it('should render children with simple providers', () => {
    const providers = [SimpleProvider];

    const { getByText, container } = render(
      <ComposeProvider providers={providers}>
        <div>Test content</div>
      </ComposeProvider>,
    );

    expect(getByText('Test content')).toBeInTheDocument();
    expect(container.querySelector('.simple')).toBeInTheDocument();
  });

  it('should render children with providers that have props (tuple syntax)', () => {
    const providers = [
      SimpleProvider,
      [ThemeProvider, { theme: 'dark', primaryColor: '#007acc' }] as const,
    ];

    const { getByText, container } = render(
      <ComposeProvider providers={providers}>
        <div>Test content</div>
      </ComposeProvider>,
    );

    expect(getByText('Test content')).toBeInTheDocument();
    const themeElement = container.querySelector('[data-theme]');
    expect(themeElement).toHaveAttribute('data-theme', 'dark');
    expect(themeElement).toHaveAttribute('data-color', '#007acc');
  });

  it('should render children with providers using provider() helper', () => {
    const providers = [
      SimpleProvider,
      provider(ThemeProvider, { theme: 'light', primaryColor: '#ff0000' }),
    ];

    const { getByText, container } = render(
      <ComposeProvider providers={providers}>
        <div>Test content</div>
      </ComposeProvider>,
    );

    expect(getByText('Test content')).toBeInTheDocument();
    const themeElement = container.querySelector('[data-theme]');
    expect(themeElement).toHaveAttribute('data-theme', 'light');
    expect(themeElement).toHaveAttribute('data-color', '#ff0000');
  });

  it('should work with multiple providers with props', () => {
    const providers = [
      SimpleProvider,
      [ThemeProvider, { theme: 'dark', primaryColor: '#00ff00' }] as const,
      [
        AuthProvider,
        { user: { id: '123', name: 'John' }, token: 'abc123' },
      ] as const,
    ];

    const { getByText, container } = render(
      <ComposeProvider providers={providers}>
        <div>Test content</div>
      </ComposeProvider>,
    );

    expect(getByText('Test content')).toBeInTheDocument();
    const themeElement = container.querySelector('[data-theme]');
    const authElement = container.querySelector('[data-user]');
    expect(themeElement).toHaveAttribute('data-theme', 'dark');
    expect(themeElement).toHaveAttribute('data-color', '#00ff00');
    expect(authElement).toHaveAttribute('data-user', '123');
    expect(authElement).toHaveAttribute('data-token', 'abc123');
  });

  it('should support legacy components prop', () => {
    const components = [SimpleProvider];

    const { getByText } = render(
      <ComposeProvider components={components}>
        <div>Test content</div>
      </ComposeProvider>,
    );

    expect(getByText('Test content')).toBeInTheDocument();
  });

  it('should handle deep nesting with 5+ providers', () => {
    const Provider1: React.FC<React.PropsWithChildren<{ id: string }>> = ({
      children,
      id,
    }) => (
      <div data-provider="1" data-id={id}>
        {children}
      </div>
    );
    const Provider2: React.FC<React.PropsWithChildren<{ id: string }>> = ({
      children,
      id,
    }) => (
      <div data-provider="2" data-id={id}>
        {children}
      </div>
    );
    const Provider3: React.FC<React.PropsWithChildren<{ id: string }>> = ({
      children,
      id,
    }) => (
      <div data-provider="3" data-id={id}>
        {children}
      </div>
    );
    const Provider4: React.FC<React.PropsWithChildren<{ id: string }>> = ({
      children,
      id,
    }) => (
      <div data-provider="4" data-id={id}>
        {children}
      </div>
    );
    const Provider5: React.FC<React.PropsWithChildren<{ id: string }>> = ({
      children,
      id,
    }) => (
      <div data-provider="5" data-id={id}>
        {children}
      </div>
    );

    const providers = [
      [Provider1, { id: 'first' }] as const,
      [Provider2, { id: 'second' }] as const,
      [Provider3, { id: 'third' }] as const,
      [Provider4, { id: 'fourth' }] as const,
      [Provider5, { id: 'fifth' }] as const,
    ];

    const { container } = render(
      <ComposeProvider providers={providers}>
        <div>Deep content</div>
      </ComposeProvider>,
    );

    // Verify provider order: first provider should be outermost
    const provider1 = container.querySelector('[data-provider="1"]');
    const provider5 = container.querySelector('[data-provider="5"]');

    expect(provider1).toBeInTheDocument();
    expect(provider5).toBeInTheDocument();
    expect(provider1).toHaveAttribute('data-id', 'first');
    expect(provider5).toHaveAttribute('data-id', 'fifth');

    // Provider1 should contain Provider5 (outermost contains innermost)
    expect(provider1).toContainElement(provider5 as HTMLElement);
  });

  it('should handle mixed providers with and without props', () => {
    const providers = [
      SimpleProvider,
      [ThemeProvider, { theme: 'dark', primaryColor: '#007acc' }] as const,
      SimpleProvider,
      [
        AuthProvider,
        { user: { id: '456', name: 'Jane' }, token: 'xyz789' },
      ] as const,
    ];

    const { getByText } = render(
      <ComposeProvider providers={providers}>
        <div>Mixed content</div>
      </ComposeProvider>,
    );

    expect(getByText('Mixed content')).toBeInTheDocument();
  });

  it('should handle empty provider array without crashing', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const { getByText } = render(
      <ComposeProvider providers={[]}>
        <div>No providers</div>
      </ComposeProvider>,
    );

    expect(getByText('No providers')).toBeInTheDocument();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'ComposeProvider: Empty provider array. No providers will be applied.',
    );

    consoleWarnSpy.mockRestore();
  });

  it('should handle single provider', () => {
    const providers = [SimpleProvider];

    const { getByText, container } = render(
      <ComposeProvider providers={providers}>
        <div>Single provider</div>
      </ComposeProvider>,
    );

    expect(getByText('Single provider')).toBeInTheDocument();
    expect(container.querySelector('.simple')).toBeInTheDocument();
  });

  it('should apply providers in correct order (pyramid-of-doom reading order)', () => {
    // Create providers that show their nesting order
    const OuterProvider: React.FC<
      React.PropsWithChildren<{ name: string }>
    > = ({ children, name }) => (
      <div data-level="outer" data-name={name}>
        {children}
      </div>
    );
    const MiddleProvider: React.FC<
      React.PropsWithChildren<{ name: string }>
    > = ({ children, name }) => (
      <div data-level="middle" data-name={name}>
        {children}
      </div>
    );
    const InnerProvider: React.FC<
      React.PropsWithChildren<{ name: string }>
    > = ({ children, name }) => (
      <div data-level="inner" data-name={name}>
        {children}
      </div>
    );

    const providers = [
      [OuterProvider, { name: 'outer' }] as const,
      [MiddleProvider, { name: 'middle' }] as const,
      [InnerProvider, { name: 'inner' }] as const,
    ];

    const { container } = render(
      <ComposeProvider providers={providers}>
        <div>Content</div>
      </ComposeProvider>,
    );

    const outer = container.querySelector('[data-level="outer"]');
    const middle = container.querySelector('[data-level="middle"]');
    const inner = container.querySelector('[data-level="inner"]');

    // Verify nesting: outer contains middle, middle contains inner
    expect(outer).toContainElement(middle as HTMLElement);
    expect(middle).toContainElement(inner as HTMLElement);
    expect(outer).toHaveAttribute('data-name', 'outer');
    expect(middle).toHaveAttribute('data-name', 'middle');
    expect(inner).toHaveAttribute('data-name', 'inner');
  });

  it('should show deprecation warning for components prop', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const components = [SimpleProvider];

    render(
      <ComposeProvider components={components}>
        <div>Legacy</div>
      </ComposeProvider>,
    );

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'ComposeProvider: The "components" prop is deprecated. Please use "providers" instead.',
    );

    consoleWarnSpy.mockRestore();
  });
  it('should warn only once per mount, not on every render', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const providers: never[] = [];
    const { rerender } = render(
      <ComposeProvider providers={providers}>
        <div>Content</div>
      </ComposeProvider>,
    );

    const afterFirstRender = consoleWarnSpy.mock.calls.length;

    // Same array identity across re-renders -> the effect must not re-run.
    rerender(
      <ComposeProvider providers={providers}>
        <div>Content</div>
      </ComposeProvider>,
    );
    rerender(
      <ComposeProvider providers={providers}>
        <div>Content</div>
      </ComposeProvider>,
    );

    expect(consoleWarnSpy).toHaveBeenCalledTimes(afterFirstRender);
    consoleWarnSpy.mockRestore();
  });

  it('should warn when both providers and components are supplied', () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const bothProps = {
      providers: [SimpleProvider],
      components: [ThemeProvider],
      children: <div>Both</div>,
    };

    render(<LooseComposeProvider {...bothProps} />);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'ComposeProvider: Received both "providers" and "components". "providers" takes precedence and "components" is ignored.',
    );

    consoleWarnSpy.mockRestore();
  });

  it('should throw a named error when no providers prop is supplied', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    // What a JavaScript consumer (or an `any`-typed call site) can do.
    const noProps = {
      children: <div>Orphan</div>,
    };

    expect(() => render(<LooseComposeProvider {...noProps} />)).toThrow(
      /expected `providers` to be an array, received undefined/,
    );

    consoleErrorSpy.mockRestore();
  });

  it('should throw a named error when providers is not an array', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const badProps = {
      providers: 'nope',
      children: <div>Orphan</div>,
    };

    expect(() => render(<LooseComposeProvider {...badProps} />)).toThrow(
      /expected `providers` to be an array, received string/,
    );

    consoleErrorSpy.mockRestore();
  });

  it('should expose the prop types on the public surface', () => {
    // Compile-time only: these must be importable by consumers.
    const withProviders: ComposeProviderProps = {
      providers: [SimpleProvider],
      children: null,
    };
    const withComponents: LegacyComposeProviderProps = {
      components: [SimpleProvider],
      children: null,
    };
    expect(withProviders.providers).toHaveLength(1);
    expect(withComponents.components).toHaveLength(1);
  });
});
