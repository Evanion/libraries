# @evanion/urn

**Eliminate identifier ambiguity with RFC-compliant Uniform Resource Names.**

Stop passing raw IDs like `123` or `abc-789` across your system and wondering, "Is this a product ID, a category ID, or a user ID?" `@evanion/urn` allows you to create self-describing identifiers that carry their own context, ensuring that your IDs are meaningful, unique, and valid across any service.

## The Problem: The "Ambiguous ID" Trap

In large systems, raw identifiers are a liability. When you see a string like `order-2026-0042`, you _assume_ it's an order, but your code has to _guess_ or rely on the variable name. This leads to:

- **Type Confusion**: Passing a `productId` into a function that expects a `categoryId`.
- **Collision Risks**: Two different entities in different databases sharing the same numeric ID.
- **Fragile Parsing**: Using `.split('-')` to guess what a string represents, which breaks the moment your ID format changes.

## The Solution: Uniform Resource Names (URNs)

A URN is a standardized way to identify a resource using a namespace. Instead of `order-2026-0042`, you use `urn:order:order-2026-0042`. Now, the ID itself tells you exactly what it is and where it comes from.

`@evanion/urn` provides a simple, JSON-inspired API to mint, parse, and validate these identifiers according to the RFC 8141 specification.

### Core Concept: Namespace-Specific IDs

To generate a URN, use a class that carries its NID into every call. The `stringify` function mints the URN and throws an `InvalidError` if the NSS violates the RFC 8141 grammar. The following block runs in the package's test suite, with each `// ->` comment indicating the expression's value.

<!-- #region basic-usage -->

```ts @import.meta.vitest
import { URN, InvalidError } from '@evanion/urn';

class GameURN extends URN {
  static override readonly nid = 'game';
}

const id = GameURN.stringify('brass-birmingham');
id; // -> 'urn:game:brass-birmingham'

let refused = '';
try {
  GameURN.stringify('brass birmingham');
} catch (error) {
  if (error instanceof InvalidError) refused = error.message;
}
refused; // -> "NSS contains invalid character ' ' in 'brass birmingham'"
```

<!-- #endregion basic-usage -->

## Key Features

- 🛡️ **RFC Compliance**: Under the default `:` separator, the NID, the NSS, and the three optional components are checked against RFC 8141, while the scheme is checked against RFC 3986, allowing schemes other than `urn` to parse.
- 🔍 **Safe Parsing**: Convert URN strings into structured components (`urn`, `nid`, `nss`) without guessing.
- ⚖️ **Case-Insensitive Equivalence**: Compare URNs correctly according to the spec (scheme and NID are case-insensitive).
- 🛠️ **Customizable**: Easily override the scheme, separator, or namespace to support non-standard internal identifiers.
- 📦 **Lightweight**: The package is ESM only, requires Node 20 or newer, ships its own types, and has no runtime or peer dependencies. CommonJS projects can load it via `require()` on Node 20.19, 22.12, or newer.

## Installation

```bash
npm install @evanion/urn
```

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/urn](https://docs.evanion.com/urn/)**

## License

MIT
