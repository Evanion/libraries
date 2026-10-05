# @evanion/token

**Human-friendly tokens with built-in error detection.**

Stop wasting database resources on mistyped codes. Whether it's a gift card, a pickup code, or a password reset token, a single typo should be caught instantly—before your application ever hits the database.

## The Problem: The "Database-Driven" Validation Trap

Most developers generate random strings and validate them by querying the database. This creates two major problems:
1. **Expensive Failures**: A mistyped code still triggers a database lookup. At scale, thousands of typos per hour become a significant and unnecessary load on your infrastructure.
2. **Poor User Experience**: A user who types `a4kp-9mx8` instead of `a4kp-9mxa` only finds out they failed when the database returns "Not Found," which is indistinguishable from a code that actually doesn't exist.

## The Solution: Check-Character Tokens

`@evanion/token` generates tokens with an integrated check character (based on the Luhn algorithm). This allows you to validate a code's structural integrity locally. If a user mistypes a single character, the token is rejected instantly—without a single database query.

### Core Concept: The Local Gate

```ts @import.meta.vitest
import { createToken } from '@evanion/token';

const token = createToken();

// ✅ Valid: matches the check character
token.validate('a4kp-9mxa'); // -> { valid: true, body: 'a4kp9mx' }

// ❌ Invalid: rejected instantly due to a typo
token.validate('a4kp-9mx8'); // -> { valid: false, reason: 'check-failed' }
```

## Key Features

- 🛡️ **Instant Validation**: Catch single-character substitutions and adjacent swaps before they hit your backend.
- 🗣️ **Human-Optimized**: Uses a "confusable-free" alphabet that removes characters like `i`, `l`, `o`, and `w` to prevent reading and dictation errors.
- 📏 **Customizable Shapes**: Control length, chunk size (e.g., `XXXX-XXXX`), and separators to match your brand's needs.
- 🔐 **CSPRNG Powered**: Uses `crypto.getRandomValues` for cryptographically secure token generation.
- 🪶 **Zero Dependencies**: Lightweight, ESM-only, and runs on any modern JS runtime.

## Installation

```bash
npm install @evanion/token
```

## Beyond the Basics

Tokens are a balance between entropy and usability. Our documentation covers how to optimize your tokens for your specific use case:

- **Entropy Calculation**: Understand the collision budget of your token length and alphabet.
- **Custom Alphabets**: How to define your own dictionary while maintaining Luhn-compliant check characters.
- **Prefixing**: Adding identifiers (like `ORD-`) to your tokens for better categorization.
- **Integration Patterns**: Best practices for storing the "body" and presenting the "value."

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/token](https://docs.evanion.com/token)**

## License
MIT
