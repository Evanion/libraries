# @evanion/luhn

**Prevent mistyped identifiers from hitting your database.**

Stop performing expensive database lookups for IDs that are mathematically impossible. Whether it's an order number, a gift card, or a tracking ID, `@evanion/luhn` lets you add a check character to your identifiers, allowing you to reject typos instantly and locally.

## The Problem: The "Ghost Lookup" Bottleneck

When a user types an ID into a form, the standard approach is to send that ID to the server and query the database. But what happens when the user makes a simple typo?
1. **Wasted Resources**: Your database spends CPU and I/O searching for a record that cannot possibly exist.
2. **Poor Feedback**: The user gets a generic "Not Found" error, which doesn't tell them *why* the ID is invalid—only that it isn't in the system.
3. **Infrastructure Stress**: At scale, millions of mistyped IDs can create a significant "ghost load" on your primary data store.

## The Solution: Check-Character Validation

By adding a single check character to the end of your identifier, you turn the ID into a self-validating string. Using a generalized Luhn algorithm, `@evanion/luhn` can verify the integrity of an identifier in a few microseconds of CPU time.

### Core Concept: The Local Gate

```ts @import.meta.vitest
import { Luhn } from '@evanion/luhn';

// 1. Generate a check character for a new ID
const { checksum } = Luhn.generate('order-2026-0042'); 
// checksum: 'l'

const printedCode = 'order-2026-0042-l';

// 2. Validate a user's input locally
Luhn.validate(printedCode).isValid; // -> true
Luhn.validate('order-2026-0042-1').isValid; // false (Typo!)
```

## Key Features

- 🌍 **Alphabet Agnostic**: Works over any alphabet you choose—numbers, letters, or custom symbols.
- 🛡️ ** typo-Resistant**: Detects all single-character substitutions and almost all adjacent swaps.
- ⚡ **Zero DB Overhead**: Reject mistyped input at the edge or in the middleware, before it ever reaches your data layer.
- ⚙️ **Customizable Moduli**: Support for standard Mod-10 (Credit Cards) or custom Mod-N alphabets.
- 🪶 **Zero Dependencies**: Lightweight, ESM-only, and runs on any modern JS runtime.

## Installation

```bash
npm install @evanion/luhn
```

## Beyond the Basics

Check characters are powerful when tuned to your specific needs. Our documentation covers advanced implementation details, including:

- **Custom Dictionaries**: How to create a "confusable-free" alphabet to prevent reading errors.
- **Modulo Bias**: Understanding the impact of dictionary size on sampling uniformity.
- **Filtering**: How to handle separators (hyphens, spaces) without breaking the checksum.
- **Migration Guides**: How to handle the transition between different dictionary versions.

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/luhn](https://docs.evanion.com/luhn)**

## License
MIT
