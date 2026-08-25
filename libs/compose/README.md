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

### Option 1: Using the `provider()` helper (recommended for best IntelliSense)

```tsx
import { ComposeProvider, provider } from '@evanion/compose';

const providers = [
  ErrorBoundary,
  provider(CacheProvider, { value: emotionCache }),
  provider(ThemeProvider, { theme }),
  provider(TranslationProvider, { locale, messages }),
  provider(StateProvider, { state: stateStore }),
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

✅ **Full IntelliSense autocomplete** while typing props  
✅ **Type errors** for missing or incorrect props  
✅ **Lightweight** - just a tiny helper function

### Option 2: Using tuple syntax with `as const`

```tsx
import { ComposeProvider } from '@evanion/compose';

const providers = [
  ErrorBoundary,
  [CacheProvider, { value: emotionCache }] as const,
  [ThemeProvider, { theme }] as const,
  [TranslationProvider, { locale, messages }] as const,
  [StateProvider, { state: stateStore }] as const,
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

✅ **No helper needed** - just arrays  
✅ **Type errors** for missing, wrong, or unknown props  
❌ **No IntelliSense autocomplete** - you need to know the prop names

## Key Features

- ✅ **Strong Type Safety**: Full TypeScript support with intelligent prop inference
- ✅ **Flexible API**: Choose between `provider()` helper (best IntelliSense) or tuple syntax (simpler)
- ✅ **Legacy Support**: Backward compatible with existing `components` prop
- ✅ **Zero Dependencies**: Lightweight with no external dependencies
- ✅ **Natural Reading Order**: Providers are applied in the order you list them (first provider is outermost, matching pyramid-of-doom reading order)

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

### `provider(component, props)`

Helper function that creates a type-safe provider tuple with full IntelliSense.

**Parameters:**

- `component`: Provider component
- `props`: Props object (autocompleted based on component type)

**Returns:** Readonly tuple `[component, props]`

**Example:**

```tsx
const p = provider(ThemeProvider, {
  theme: 'dark', // ← IntelliSense suggests available props
  primaryColor: '#007acc',
});
```

### Types

**`Provider`**: A provider component or `[component, props] as const` tuple

**`ProviderArray`**: Readonly array of providers

## TypeScript Usage

### Which Approach to Use?

**Use `provider()` helper when:**

- You want IntelliSense autocomplete for props
- You're not sure what props a component needs
- You prefer a more guided typing experience

**Use tuple syntax when:**

- You already know the prop names
- You want the most minimal syntax
- You don't mind typing props without autocomplete

### With `provider()` Helper

```tsx
import { provider } from '@evanion/compose';

const providers = [
  provider(ThemeProvider, {
    theme: // ← Cursor here: IntelliSense suggests 'light' | 'dark'
    primaryColor: // ← IntelliSense suggests string
  }),
];
```

✅ Full autocomplete as you type  
✅ Type errors for missing/wrong props  
✅ Best developer experience

### With Tuple Syntax

```tsx
<ComposeProvider
  providers={[[ThemeProvider, { theme: 'dark', primaryColor: '#007acc' }]]}
>
  <App />
</ComposeProvider>
```

❌ No autocomplete (you must know prop names)  
✅ Type errors for missing/wrong props  
✅ Most concise syntax

### Examples

**Both approaches catch errors:**

```tsx
// ❌ provider() is checked where you call it
provider(ThemeProvider, { theme: 'dark' }); // Error: missing 'primaryColor'
provider(ThemeProvider, { theme: 'blue', primaryColor: '#007acc' }); // Error: 'blue'

// ❌ Tuples are checked where the array is passed to ComposeProvider
<ComposeProvider providers={[[ThemeProvider, { theme: 'dark' }]]}>
  <App />
</ComposeProvider>; // Error: missing 'primaryColor'

<ComposeProvider
  providers={[[ThemeProvider, { theme: 'blue', primaryColor: '#fff' }]]}
>
  <App />
</ComposeProvider>; // Error: 'blue' is not assignable to 'light' | 'dark'

<ComposeProvider
  providers={[
    [ThemeProvider, { theme: 'dark', primaryColor: '#fff', typo: 1 }],
  ]}
>
  <App />
</ComposeProvider>; // Error: 'typo' is not a prop of ThemeProvider
```

> **Where the check happens matters.** A tuple only knows what it should be once
> it reaches `ComposeProvider`, so a bare `[ThemeProvider, { theme: 'dark' }]`
> sitting in a variable on its own will not error. Either write the array inline,
> or use `provider()`, which is checked at the point you call it.

> **Assigning to a variable first?** TypeScript widens the tuple and the check is
> lost. Use `provider()` for those entries, or annotate the array with
> `satisfies ProviderArray`.

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
