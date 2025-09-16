import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  ComposeProvider,
  createProviderBuilder,
  createProvider,
} from './index';

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
      </ComposeProvider>
    );

    expect(getByText('Test content')).toBeInTheDocument();
    expect(container.querySelector('.simple')).toBeInTheDocument();
  });

  it('should render children with providers that have props', () => {
    const providers: any[] = [
      SimpleProvider,
      [ThemeProvider, { theme: 'dark', primaryColor: '#007acc' }],
    ];

    const { getByText, container } = render(
      <ComposeProvider providers={providers}>
        <div>Test content</div>
      </ComposeProvider>
    );

    expect(getByText('Test content')).toBeInTheDocument();
    const themeElement = container.querySelector('[data-theme]');
    expect(themeElement).toHaveAttribute('data-theme', 'dark');
    expect(themeElement).toHaveAttribute('data-color', '#007acc');
  });

  it('should work with createProvider helper', () => {
    const providers: any[] = [
      SimpleProvider,
      createProvider(ThemeProvider, {
        theme: 'light',
        primaryColor: '#ff0000',
      }),
    ];

    const { getByText, container } = render(
      <ComposeProvider providers={providers}>
        <div>Test content</div>
      </ComposeProvider>
    );

    expect(getByText('Test content')).toBeInTheDocument();
    const themeElement = container.querySelector('[data-theme]');
    expect(themeElement).toHaveAttribute('data-theme', 'light');
    expect(themeElement).toHaveAttribute('data-color', '#ff0000');
  });

  it('should work with ProviderBuilder', () => {
    const providers = createProviderBuilder()
      .add(SimpleProvider)
      .add(ThemeProvider, { theme: 'dark', primaryColor: '#00ff00' })
      .add(AuthProvider, { user: { id: '123', name: 'John' }, token: 'abc123' })
      .build();

    const { getByText, container } = render(
      <ComposeProvider providers={providers}>
        <div>Test content</div>
      </ComposeProvider>
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
    const components: any[] = [SimpleProvider];

    const { getByText } = render(
      <ComposeProvider components={components}>
        <div>Test content</div>
      </ComposeProvider>
    );

    expect(getByText('Test content')).toBeInTheDocument();
  });
});
