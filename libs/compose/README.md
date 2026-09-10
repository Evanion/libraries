[![Known Vulnerabilities](https://snyk.io/test/github/Evanion/libraries/badge.svg)](https://snyk.io/test/github/Evanion/libraries)
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

The package is ESM only. There is no `require` condition, so CommonJS
consumers -- Jest without `transform`/ESM support, or a `require()` call in a
CJS file -- hit `ERR_REQUIRE_ESM`.

## API Reference

### `ComposeProvider`

The main component that renders providers in the correct order.

**Props:**

- `providers`: Array of providers
- `children`: React children to wrap

`ComposeProvider` is a generic function, not a `React.FC`. It infers the
providers array as a literal tuple (`const T`), which is what lets it check each
entry against its own component.

> **Changing the length or order of the array remounts everything below it.**
> React reconciles by position, so
> `providers={[...(isAuthed ? [AuthProvider] : []), ThemeProvider]}` unmounts and
> remounts the whole subtree on login, losing all state in it. Keep the array a
> fixed length and let the providers themselves handle the conditional case.

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

**`ValidatedProviders<T>`**: The type of the `providers` prop. For a literal
tuple it validates entry by entry; for an already-widened `ProviderArray` it
resolves to `ProviderArray`, so a value of that type can be forwarded through a
wrapper component:

```tsx
function AppProviders({
  providers,
  children,
}: {
  providers: ProviderArray;
  children: React.ReactNode;
}) {
  return <ComposeProvider providers={providers}>{children}</ComposeProvider>;
}
```

The entries are unchecked at that boundary -- a `ProviderArray` has already lost
the identity of its elements, so there is nothing left to check. Build the array
where the components are known if you want the per-entry errors.

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
</ComposeProvider>; // Error: 'blue' is not one of 'light' | 'dark'

<ComposeProvider
  providers={[
    [ThemeProvider, { theme: 'dark', primaryColor: '#fff', typo: 1 }],
  ]}
>
  <App />
</ComposeProvider>; // Error: ComposeError: unknown prop 'typo'

<ComposeProvider providers={[ThemeProvider]}>
  <App />
</ComposeProvider>; // Error: ComposeError: this component requires props ...
```

Failures that are not just a wrong value carry the explanation in a property
name, so TypeScript prints it in the first line rather than under a structural
walk:

```
Property '"ComposeError: unknown prop 'typo'"' is missing in type
'[ThemeProvider, { theme: "dark"; primaryColor: "#fff"; typo: 1; }]'
but required in type 'ComposeError<"unknown prop 'typo'">'.
```

> **Where the check happens matters.** A tuple only knows what it should be once
> it reaches `ComposeProvider`, so a bare `[ThemeProvider, { theme: 'dark' }]`
> sitting in a variable on its own will not error. Either write the array inline,
> or use `provider()`, which is checked at the point you call it.

> **Assigning to a variable first?** TypeScript widens the tuple and the check is
> lost. Use `provider()` for those entries, or annotate the array with
> `satisfies ProviderArray`.

## Migrating from 1.x

| Before                                                  | After                                 |
| ------------------------------------------------------- | ------------------------------------- |
| `<ComposeProvider components={[...]}>`                  | `<ComposeProvider providers={[...]}>` |
| `LegacyComposeProviderProps`                            | removed                               |
| `AnyComposeProviderProps`                               | removed                               |
| forwarding a `ProviderArray` variable failed to compile | compiles, unchecked at that boundary  |

The deprecated `components` prop is gone from the type surface entirely. A
JavaScript caller that still passes it gets a named error rather than silent
acceptance:

```
TypeError: ComposeProvider: `components` was removed in v2.0 — rename it to `providers`.
```

Keeping it as a second overload is what produced the unreadable diagnostics in
1.x: every error on a `providers` call carried a second half about the legacy
overload that could never match.

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../LICENSE) for details.
