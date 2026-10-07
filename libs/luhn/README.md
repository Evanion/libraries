# @evanion/luhn

**Prevent mistyped identifiers from hitting your database.**

Stop performing expensive database lookups for IDs that are mathematically impossible. Whether it's an order number, a gift card, or a tracking ID, `@evanion/luhn` lets you add a check character to your identifiers, allowing you to reject typos locally.

## The Problem: The "Ghost Lookup" Bottleneck

When a user types an ID into a form, the standard approach is to send that ID to the server and query the database. But what happens when the user makes a simple typo?

1. **Wasted Resources**: Your database spends CPU and I/O searching for a record that cannot possibly exist.
2. **Poor Feedback**: The user gets a generic "Not Found" error, which doesn't tell them _why_ the ID is invalid—only that it isn't in the system.
3. **Infrastructure Stress**: At scale, millions of mistyped IDs can create a significant "ghost load" on your primary data store.

## The Solution: Check-Character Validation

By adding a single check character to the end of your identifier, you turn the ID into a self-validating string. Using a generalized Luhn algorithm, `@evanion/luhn` verifies the integrity of an identifier in memory, without a network call or a database query.

### Core Concept: The Local Gate

Because `generate` returns the check character without appending it, `orderCode` decides where it goes. To show validation in action, `validate` refuses the code whose last character was misread as a `1`. Each `// ->` comment gives the value of the expression on its line, and the block runs in the package's test suite.

<!-- #region round-trip -->

```ts @import.meta.vitest
import { Luhn } from '@evanion/luhn';

// 1. Generate a check character and append it to the order number
function orderCode(orderNumber: string): string {
  const { checksum } = Luhn.generate(orderNumber);
  return `${orderNumber}-${checksum}`;
}

const printed = orderCode('order-2026-0042'); // -> 'order-2026-0042-l'

// 2. Validate the code a customer reads back, locally
Luhn.validate(printed).isValid; // -> true
Luhn.validate('order-2026-0042-1').isValid; // -> false
```

<!-- #endregion round-trip -->

## Key Features

- 🌍 **Alphabet Agnostic**: Works over any alphabet with an even number of characters—numbers, letters, or custom symbols.
- 🛡️ **Typo-Resistant**: Detects all single-character substitutions and almost all adjacent swaps.
- ⚡ **Zero DB Overhead**: Reject mistyped input at the edge or in the middleware, before it ever reaches your data layer.
- ⚙️ **Customizable Moduli**: Support for standard Mod-10 (Credit Cards) or custom Mod-N alphabets.
- 📦 **Zero Dependencies**: The package has no runtime or peer dependencies and ships its own types. It is ESM only and needs Node 20 or newer.

## Installation

```bash
npm install @evanion/luhn
```

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/luhn](https://docs.evanion.com/luhn/)**

## License

MIT
