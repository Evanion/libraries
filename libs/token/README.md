# @evanion/token

**Human-friendly tokens with built-in error detection.**

Stop wasting database resources on mistyped codes. Whether it's a gift card, a pickup code, or a password reset token, a single typo should be caught before your application ever hits the database.

## The Problem: The "Database-Driven" Validation Trap

Most developers generate random strings and validate them by querying the database. This creates two major problems:

1. **Expensive Failures**: A mistyped code still triggers a database lookup. At scale, thousands of typos per hour become a significant and unnecessary load on your infrastructure.
2. **Poor User Experience**: A user who types `a4kp-9mx8` instead of `a4kp-9mxa` only finds out they failed when the database returns "Not Found," which is indistinguishable from a code that actually doesn't exist.

## The Solution: Check-Character Tokens

`@evanion/token` generates tokens with an integrated check character (based on the Luhn algorithm). This allows you to validate a code's structural integrity locally. If a user mistypes a single character, the token is rejected without a single database query.

### Core Concept: The Local Gate

To generate a token, use `createToken()` to build an instance with the default alphabet and shape. The `validate` method then checks if a code's check character matches, returning the reason for any failure: a wrong check character, a character outside the alphabet, or the wrong length. The following block runs in the package's test suite with `createToken` imported from `@evanion/token`, where each `// ->` comment indicates the expression's value.

<!-- #region validate -->

```ts @import.meta.vitest
const token = createToken();

token.validate('b0zg-7kqb'); // -> { valid: true, body: 'b0zg7kq' }
token.validate('b0zg-7kq8'); // -> { valid: false, reason: 'check-failed' }
token.validate('bozg-7kqb'); // -> { valid: false, reason: 'outside-alphabet' }
token.validate('b0zg-7kq'); // -> { valid: false, reason: 'wrong-length' }
```

<!-- #endregion validate -->

## Key Features

- 🛡️ **Local Validation**: Catch single-character substitutions and almost all adjacent swaps before they hit your backend.
- 🗣️ **Human-Optimized**: Uses a "confusable-free" alphabet that removes characters like `i`, `l`, `o`, and `w` to prevent reading and dictation errors.
- 📏 **Customizable Shapes**: Control length, chunk size (e.g., `XXXX-XXXX`), and separators to match your brand's needs.
- 🔐 **CSPRNG Powered**: Uses `crypto.getRandomValues` for cryptographically secure token generation.
- 📦 **Environment**: ESM only, requires Node 20 or newer, and ships its own types; depends solely on `@evanion/luhn` to compute the check character.

## Installation

```bash
npm install @evanion/token
```

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/token](https://docs.evanion.com/token/)**

## License

MIT
