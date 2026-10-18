# @evanion/luhn

**Prevent mistyped identifiers from hitting your database.**

When users type IDs into forms, a simple typo often triggers a "ghost lookup": your database spends CPU and I/O searching for a record that cannot possibly exist. This wastes resources and provides poor feedback to the user. `@evanion/luhn` solves this by adding a check character to your identifiers, allowing you to reject mathematically impossible IDs locally.

To see how this works, consider an order number. By generating a checksum and appending it to the ID, you create a self-validating string that `@evanion/luhn` can verify in memory without a network call.

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

## Capabilities of @evanion/luhn

The package provides a generalized Luhn algorithm to secure your identifiers:

- **Zero DB Overhead**: Reject mistyped input at the edge or in the middleware, before it ever reaches your data layer.
- **Typo-Resistant**: Detects all single-character substitutions and almost all adjacent swaps.
- **Alphabet Agnostic**: Works over any alphabet with an even number of characters—numbers, letters, or custom symbols.
- **Customizable Moduli**: Support for standard Mod-10 (Credit Cards) or custom Mod-N alphabets.
- **Zero Dependencies**: The package has no runtime or peer dependencies and ships its own types. It is ESM only and needs Node 20 or newer.

## Installation

```bash
npm install @evanion/luhn
```

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[libs.evanion.com/docs/luhn](https://libs.evanion.com/docs/luhn/)**

## License

MIT
