# @evanion/urn

**Eliminate identifier ambiguity with RFC-compliant Universal Resource Names.**

Stop passing raw IDs like `123` or `abc-789` across your system and wondering, "Is this a product ID, a category ID, or a user ID?" `@evanion/urn` allows you to create self-describing identifiers that carry their own context, ensuring that your IDs are meaningful, unique, and valid across any service.

## The Problem: The "Ambiguous ID" Trap

In large systems, raw identifiers are a liability. When you see a string like `order-2026-0042`, you *assume* it's an order, but your code has to *guess* or rely on the variable name. This leads to:
- **Type Confusion**: Passing a `productId` into a function that expects a `categoryId`.
- **Collision Risks**: Two different entities in different databases sharing the same numeric ID.
- **Fragile Parsing**: Using `.split('-')` to guess what a string represents, which breaks the moment your ID format changes.

## The Solution: Universal Resource Names (URNs)

A URN is a standardized way to identify a resource using a namespace. Instead of `order-2026-0042`, you use `urn:order:order-2026-0042`. Now, the ID itself tells you exactly what it is and where it comes from.

`@evanion/urn` provides a simple, JSON-inspired API to mint, parse, and validate these identifiers according to the RFC 8141 specification.

### Core Concept: Namespace-Specific IDs

The best way to use URNs is to create a class for each of your namespaces. This gives you a dedicated type for each kind of ID and ensures that your identifiers are always valid.

```ts @import.meta.vitest
import { URN, InvalidError } from '@evanion/urn';

// Define a namespace for games
class GameURN extends URN {
  static override readonly nid = 'game';
}

// Mint a URN: 'urn:game:brass-birmingham'
const id = GameURN.stringify('brass-birmingham');

// Validation is built-in: a space in the ID will throw an InvalidError
try {
  GameURN.stringify('brass birmingham');
} catch (error) {
  if (error instanceof InvalidError) {
    console.log(error.message); // "NSS contains invalid character ' ' in 'brass birmingham'"
  }
}
```

## Key Features

- 📜 **RFC 8141 Compliant**: Full support for the URN specification, including correct grammar for schemes, NIDs, and NSS.
- 🔍 **Safe Parsing**: Convert URN strings into structured components (`urn`, `nid`, `nss`) without guessing.
- ⚖️ **Case-Insensitive Equivalence**: Compare URNs correctly according to the spec (scheme and NID are case-insensitive).
- 🛠️ **Customizable**: Easily override the scheme, separator, or namespace to support non-standard internal identifiers.
- 🪶 **Zero Dependencies**: Lightweight and fast, with no external requirements.

## Installation

```bash
npm install @evanion/urn
```

## Beyond the Basics

URNs are more than just strings; they are a structural way to handle identity. Our documentation covers advanced usage, including:

- **Component Parsing**: Handling optional r-components, q-components, and f-components (fragments).
- **Percent-Encoding**: Safely encoding special characters in your identifiers using `encodeNss`.
- **Namespace Validation**: Using `belongsToNamespace` to filter mixed lists of identifiers.
- **Type-Safe Literals**: Using the `IFullURN` type to enforce URN formats at the TypeScript level.

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/urn](https://docs.evanion.com/urn)**

## License
MIT
