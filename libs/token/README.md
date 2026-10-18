# @evanion/token

**Generate human-friendly tokens with built-in error detection.**

When users mistype a gift card or password reset code, your application shouldn't have to query a database just to discover the code is invalid. `@evanion/token` solves this by integrating a check character into every token, allowing you to catch typos locally before they ever hit your infrastructure.

<!-- #region validate -->

```ts @import.meta.vitest
const token = createToken();

token.validate('b0zg-7kqb'); // -> { valid: true, body: 'b0zg7kq' }
token.validate('b0zg-7kq8'); // -> { valid: false, reason: 'check-failed' }
token.validate('bozg-7kqb'); // -> { valid: false, reason: 'outside-alphabet' }
token.validate('b0zg-7kq'); // -> { valid: false, reason: 'wrong-length' }
```

<!-- #endregion validate -->

## Capabilities of @evanion/token

The `@evanion/token` package provides several tools to ensure tokens are secure and easy for humans to use:

- **Local Validation**: Catch single-character substitutions and almost all adjacent swaps without a backend query.
- **Human-Optimized Alphabet**: Prevents reading and dictation errors by using a "confusable-free" alphabet that removes characters like `i`, `l`, `o`, and `w`.
- **Customizable Shapes**: Match your brand's needs by controlling length, separators, and chunk size (e.g., `XXXX-XXXX`).
- **Secure Generation**: Uses `crypto.getRandomValues` (CSPRNG) to ensure tokens are cryptographically secure.

## Environment and Installation

`@evanion/token` is an ESM-only package that requires Node 20 or newer. It ships its own types and depends solely on `@evanion/luhn` to compute the check character.

```bash
npm install @evanion/token
```

## Documentation

For the full API reference and worked examples, visit our documentation site:

👉 **[libs.evanion.com/docs/token](https://libs.evanion.com/docs/token/)**

## License

MIT
