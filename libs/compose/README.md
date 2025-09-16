[![Known Vulnerabilities](https://snyk.io/test/github/Evanion/compose/badge.svg)](https://snyk.io/test/github/Evanion/compose)
![npm (scoped)](https://img.shields.io/npm/v/@evanion/compose)

# @evanion/compose

A React component that allows you to clean up your provider nesting with **strong type safety** and **intelligent prop inference**.

## The Problem

Raise your hand if your `App.tsx` looks like this:

```tsx
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <CacheProvider value={emotionCache}>
        <ThemeProvider theme={theme}>
          <TranslationProvider locale={locale} messages={messages}>
            <StateProvider state={stateStore}>
              <CoffeeProvider>
                <SanityProvider>
                  <Routes />
                </SanityProvider>
              </CoffeeProvider>
            </StateProvider>
          </TranslationProvider>
        </ThemeProvider>
      </CacheProvider>
    </ErrorBoundary>
  );
};
```

## The Solution

This package lets you clean this up with **full TypeScript support**:

### Basic Usage

```tsx
import { ComposeProvider } from '@evanion/compose';

const providers = [
  ErrorBoundary,
  [CacheProvider, { value: emotionCache }],
  [ThemeProvider, { theme }],
  [TranslationProvider, { locale, messages }],
  [StateProvider, { state: stateStore }],
  CoffeeProvider,
  SanityProvider,
];

const App: React.FC = () => {
  return (
    <ComposeProvider providers={providers}>
      <Routes />
    </ComposeProvider>
  );
};
```

### Type-Safe Provider Creation

Use the `createProvider` helper for better type inference:

```tsx
import { ComposeProvider, createProvider } from '@evanion/compose';

const providers = [
  ErrorBoundary,
  createProvider(CacheProvider, { value: emotionCache }),
  createProvider(ThemeProvider, { theme }),
  createProvider(TranslationProvider, { locale, messages }),
  createProvider(StateProvider, { state: stateStore }),
  CoffeeProvider,
  SanityProvider,
];

const App: React.FC = () => {
  return (
    <ComposeProvider providers={providers}>
      <Routes />
    </ComposeProvider>
  );
};
```

### Fluent Builder API

For complex scenarios, use the `ProviderBuilder` for a fluent, type-safe API:

```tsx
import { ComposeProvider, createProviderBuilder } from '@evanion/compose';

const providers = createProviderBuilder()
  .add(ErrorBoundary)
  .add(CacheProvider, { value: emotionCache })
  .add(ThemeProvider, { theme })
  .add(TranslationProvider, { locale, messages })
  .add(StateProvider, { state: stateStore })
  .add(CoffeeProvider)
  .add(SanityProvider)
  .build();

const App: React.FC = () => {
  return (
    <ComposeProvider providers={providers}>
      <Routes />
    </ComposeProvider>
  );
};
```

## Key Features

- ✅ **Strong Type Safety**: Full TypeScript support with intelligent prop inference
- ✅ **Multiple APIs**: Choose between array syntax, helper functions, or builder pattern
- ✅ **Legacy Support**: Backward compatible with existing `components` prop
- ✅ **Zero Dependencies**: Lightweight with no external dependencies
- ✅ **Provider Order**: Providers are applied in reverse order (last provider wraps first)

## Type Safety Benefits

The improved type system provides:

- **Prop Validation**: TypeScript will catch missing or incorrect props at compile time
- **IntelliSense**: Full autocomplete support for provider props
- **Refactoring Safety**: Rename props and get compile-time errors if usage is incorrect
- **Documentation**: Types serve as inline documentation for expected props

## Installation

```bash
npm install @evanion/compose
```

## API Reference

### `ComposeProvider`

The main component that renders providers in the correct order.

**Props:**

- `providers`: Array of providers (preferred)
- `components`: Array of providers (legacy, deprecated)
- `children`: React children to wrap

### `createProvider(component, props)`

Helper function that creates a type-safe provider tuple.

**Parameters:**

- `component`: Provider component
- `props`: Props object (type-checked against component)

**Returns:** `[component, props]` tuple

### `createProviderBuilder()`

Creates a new `ProviderBuilder` instance for fluent API.

**Returns:** `ProviderBuilder` instance

### `ProviderBuilder`

Fluent API for building provider arrays.

**Methods:**

- `add(component)`: Add a provider without props
- `add(component, props)`: Add a provider with props
- `build()`: Build the final provider array

## Migration Guide

### From v1.x

The API is backward compatible. You can continue using the existing syntax:

```tsx
// This still works
const providers = [
  ErrorBoundary,
  [CacheProvider, { value: emotionCache }],
  // ...
];
```

### To v2.x (Recommended)

For better type safety, use the new helpers:

```tsx
// Recommended approach
const providers = [
  ErrorBoundary,
  createProvider(CacheProvider, { value: emotionCache }),
  // ...
];
```

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
