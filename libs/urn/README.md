# @evanion/urn

**Eliminate identifier ambiguity with RFC-compliant Uniform Resource Names.**

Stop passing raw IDs across your system and wondering if a string is a product, category, or user ID. `@evanion/urn` allows you to create self-describing identifiers that carry their own context, ensuring your IDs are meaningful, unique, and valid across any service.

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

## Solving the "Ambiguous ID" Trap

In large systems, raw identifiers are a liability. When you see a string like `order-2026-0042`, your code must guess what it represents or rely on variable names. This leads to type confusion—such as passing a `productId` where a `categoryId` is expected—collision risks between different databases, and fragile parsing using `.split('-')` that breaks when formats change.

`@evanion/urn` solves this by implementing Uniform Resource Names (URNs), a standardized way to identify a resource using a namespace. Instead of `order-2026-0042`, you use `urn:order:order-2026-0042`. The package provides a JSON-inspired API to mint, parse, and validate these identifiers according to the RFC 8141 specification.

## Capability Map

The `@evanion/urn` package provides the following capabilities:

- **RFC Compliance**: Checks the NID, the NSS, and three optional components against RFC 8141 (under the default `:` separator) and the scheme against RFC 3986.
- **Safe Parsing**: Converts URN strings into structured components (`urn`, `nid`, `nss`) without guessing.
- **Case-Insensitive Equivalence**: Compares URNs correctly according to the spec, treating the scheme and NID as case-insensitive.
- **Customization**: Supports overriding the scheme, separator, or namespace for non-standard internal identifiers.
- **Lightweight Footprint**: ESM only for Node 20 or newer with no runtime or peer dependencies. CommonJS projects can load it via `require()` on Node 20.19, 22.12, or newer.

## Installation

```bash
npm install @evanion/urn
```

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/urn](https://docs.evanion.com/urn/)**

## License

MIT
