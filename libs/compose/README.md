[![npm version](https://img.shields.io/npm/v/@evanion/compose)](https://www.npmjs.com/package/@evanion/compose)
[![npm downloads](https://img.shields.io/npm/dm/@evanion/compose)](https://www.npmjs.com/package/@evanion/compose)
[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# @evanion/compose

Flatten nested React providers into a single, readable list, with each entry's
props checked against its own component.

Full documentation: [docs.evanion.com/compose](https://docs.evanion.com/compose).

## The problem

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

## The solution

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

The first entry ends up outermost, so the list reads in the same order as the
pyramid it replaces.

## Installation

```bash
npm install @evanion/compose
```

React 18 or 19 is the only peer dependency, and the package has no runtime
dependencies of its own.

The package is ESM only. There is no `require` condition, so CommonJS
consumers -- Jest without `transform`/ESM support, or a `require()` call in a
CJS file -- hit `ERR_REQUIRE_ESM`.

`ComposeProvider` uses no hooks, no context and no class component, so it is
importable from a React Server Component graph -- a Next.js `app/layout.tsx`
included -- without a `'use client'` boundary.

## Two ways to write an entry

A provider with no props is the component itself. A provider with props is
either a `provider()` call or a `[component, props] as const` tuple.

```tsx
provider(ThemeProvider, { theme }); // checked where you write it
[ThemeProvider, { theme }] as const; // checked where the array is passed
```

They type-check identically. The difference is where the check happens, and
therefore whether you get autocomplete:

|                                 | `provider()`          | tuple                                        |
| ------------------------------- | --------------------- | -------------------------------------------- |
| IntelliSense while typing props | yes                   | no -- you must know the prop names           |
| Errors reported at              | the `provider()` call | the `<ComposeProvider>` that takes the array |
| An entry held in a variable     | still checked         | widened, and the check is lost               |

That last row is the one that bites. TypeScript widens a bare tuple assigned to
a variable, so `const entry = [ThemeProvider, { theme: 'dark' }]` sitting on its
own will not error. Write the array inline, annotate it with
`satisfies ProviderArray`, or use `provider()` for those entries.

## Changing the array remounts the subtree

React reconciles by position, so
`providers={[...(isAuthed ? [AuthProvider] : []), ThemeProvider]}` unmounts and
remounts everything below it on login, losing all state in it. Keep the array a
fixed length and let the providers themselves handle the conditional case.

## What the type errors look like

```tsx
// provider() is checked where you call it
provider(ThemeProvider, { theme: 'dark' }); // Error: missing 'primaryColor'
provider(ThemeProvider, { theme: 'blue', primaryColor: '#007acc' }); // Error: 'blue'

// Tuples are checked where the array is passed to ComposeProvider
<ComposeProvider providers={[[ThemeProvider, { theme: 'dark' }]]}>
  <App />
</ComposeProvider>; // Error: missing 'primaryColor'

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

## API reference

### `ComposeProvider`

| Prop        | Meaning                              |
| ----------- | ------------------------------------ |
| `providers` | the providers, first entry outermost |
| `children`  | what they wrap                       |

`ComposeProvider` is a generic function, not a `React.FC`. It infers the
providers array as a literal tuple (`const T`), which is what lets it check each
entry against its own component.

It throws a `TypeError` naming the prop when `providers` is not an array, which
only a caller outside TypeScript can reach, and warns once in development when
the array is empty.

### `provider(component, props)`

Returns the readonly tuple `[component, props]`, with `props` checked and
autocompleted against `component`.

```tsx
const p = provider(ThemeProvider, {
  theme: 'dark', // <- IntelliSense suggests available props
  primaryColor: '#007acc',
});
```

### Types

`Provider` -- a provider component or a `[component, props] as const` tuple.

`ProviderArray` -- a readonly array of those.

`ValidatedProviders<T>` -- the type of the `providers` prop. For a literal
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
