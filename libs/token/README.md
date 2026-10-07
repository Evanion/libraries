# @evanion/token

**Human-friendly codes with built-in error detection.**

`@evanion/token` mints readable codes for gift cards, pickup codes and support tickets, and `validate` refuses a code with one wrong character before your application queries the database.

## Why a Database Lookup Is the Wrong First Check

An application that checks a random code only against its database has two problems:

1. **Expensive Failures**: A mistyped code still triggers a database lookup, and every typo runs a query that cannot find anything.
2. **Poor User Experience**: A user who types `a4kp-9mx8` instead of `a4kp-9mxa` only finds out they failed when the database returns "Not Found," which is indistinguishable from a code that actually doesn't exist.

## Check Characters Refuse a Typo Locally

`@evanion/token` generates codes with an integrated check character, computed by `@evanion/luhn` with the Luhn algorithm. This allows you to validate a code's structural integrity locally. If a user mistypes a single character, `validate` rejects the code instantly, without a single database query.

## Key Features

- 🛡️ **Instant Validation**: Catch every single-character substitution and almost every adjacent swap before it hits your backend.
- 🗣️ **Human-Optimized**: Uses a "confusable-free" alphabet that removes `i`, `l`, `o`, and `w` to prevent reading and dictation errors.
- 📏 **Customizable Shapes**: Control length, chunk size (e.g., `XXXX-XXXX`), and separators to match your brand's needs.
- 🔐 **CSPRNG Powered**: Uses `crypto.getRandomValues` for cryptographically secure code generation.
- 🪶 **Lightweight**: ESM-only, one dependency (`@evanion/luhn`), and runs on Node 20 or newer and in any browser with no polyfill.

## Installation

```bash
npm install @evanion/token
```

Or with yarn:

```bash
yarn add @evanion/token
```

Or with pnpm:

```bash
pnpm add @evanion/token
```

## Creating a Token Instance

`createToken` validates every option once and returns a frozen instance with `generate` and `validate` bound to it. Build it at module scope. The defaults are a `length` of 8, which counts the check character, chunked in fours, so `value` comes back nine characters long with its one separator:

Every option is optional. A gift card code wants more characters than a pickup code:

A shape that cannot describe a code throws `InvalidShapeError` at construction. The error carries a `reason` and all three of `length`, `chunkSize` and `separator` as they were resolved, defaults included. A dictionary that holds the separator throws it too:

## Issuing and Redeeming Codes

`generate` draws `length - 1` random characters, appends the check character, and chunks the result. The characters are random, so what the example below can show about a pickup code is its shape:

`value` is the printed code, prefix included, such as `ORD-a4kp-9mxa`. `body` is what the check character was computed over, unchunked: store and index on it.

A code that `generate` minted validates back to the same `body`, and a code with one character retyped does not:

A shop stores `body` against the order and prints `value` on the receipt. At the counter, `validate` turns what the customer reads back into the same `body`, or refuses it before the table is read:

`generate` never retries and never checks for collisions. Uniqueness is a unique index on your table; see [Entropy and Collisions](#entropy-and-collisions).

## Understanding Validation Results

`validate` returns `valid: true` and the `body`, or `valid: false` and the first `reason` the code failed:

| `reason`           | Meaning                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `outside-alphabet` | a character not in the dictionary, after separators are stripped |
| `wrong-length`     | the code is not `length` characters long                         |
| `check-failed`     | the last character does not check out against the ones before it |

`validate` never throws and has no side effects, so it can run on every request as the cheap gate in front of a lookup. Narrow on `valid` to reach `body`:

**`valid: true` does not mean the code exists**, and it is not authentication. One random code in `n` passes the check by construction, which is one in 32 with the default alphabet. Treat it as a filter, never as a credential.

### What the Check Character Catches

Luhn catches, over any alphabet:

- Every single-character substitution, at every position, including the check character itself.
- Every swap of two adjacent characters, except one pair: the first and last entries of the dictionary, `0` and `z` by default.

The blind spot is structural. With `g(x) = floor(2x / n) + (2x mod n)`, a swap of indices `a` and `b` escapes exactly when `a + g(b) ≡ b + g(a)` (mod n), which for even `n` has the single non-trivial solution `{0, n - 1}`. It is the textbook mod-10 `{0, 9}` case, generalised. Two mistakes in one code can also cancel each other out and pass.

## Flexible Input: Separators and Prefixes

`validate` strips the separator and folds case first, so a code typed without the separator, grouped differently, or read off a card in capitals still validates to the same `body`:

`chunkSize` must divide `length`, or `createToken` throws: a trailing chunk shorter than the rest is hard to read aloud. Set `chunkSize` equal to `length` for an unchunked code. A short code with a space between two chunks of three reads aloud as two words:

The prefix sits outside the checksum. `ORD-a4kp-9mxa` checksums `a4kp9mx` only, and `validate` refuses the code with its prefix still on. Strip it first, in any case, with or without its separator:

The strip is safe because the default dictionary has no `o`: no code starts with one, so a leading `ord` is always the prefix.

## Entropy and Collisions

`length` counts the check character, so usable entropy is `(length - 1) * log2(n)`. At the defaults, `length: 8` and `n: 32`, that is **35 bits**, and `entropyBits` reports it:

`length: 13` needs its own `chunkSize`, because the default 4 does not divide 13.

35 bits is 34,359,738,368 values. Read that as a collision budget, not as a guess-resistance budget:

- A 50% chance of one collision arrives at about **218,000** codes.
- At 1,000,000 issued codes a collision is effectively certain.

So uniqueness is a unique index on your table. Draw again when the insert conflicts:

The retry absorbs a collision. Size `length` by the chance that the next insert conflicts, the codes already issued divided by `2^bits`: keep it below 1 in 1,000 at the volume you expect in three years. At 35 bits that is about 34 million codes, and five more characters add 25 more bits.

A 35-bit code protects against typos, not against an attacker enumerating codes. Don't use it for session IDs, password resets or anything where knowing the string grants access. If a readable code does gate something, such as a gift card balance, rate-limit the lookup and bind it to a second factor.

## Choosing an Alphabet

The default is 32 characters:

It is the lowercase alphanumerics without `i`, `l`, `o` and `w`. The first three are read as `1`, `1` and `0`. `w` goes because "double-u" dictated down a phone gets written back as `u`, and because dropping three leaves 33, which cannot carry a check character.

A dictionary you supply has to satisfy every constraint below, all checked by `createToken`:

| Constraint                           | Enforced by     | Why                                                |
| ------------------------------------ | --------------- | -------------------------------------------------- |
| no confusable characters             | this package    | `l`, `i` read as `1`, `o` as `0`, `w` heard as `u` |
| lowercase                            | this package    | input is case folded before it is read             |
| `256 % n === 0`                      | this package    | otherwise `byte % n` is biased                     |
| even size, no repeats, no case pairs | `@evanion/luhn` | a check character has to be definable              |

The three this package owns throw `InvalidAlphabetError`, with a `reason` and the `offending` characters:

A dictionary that fails one of Luhn's own constraints throws `InvalidDictionaryError` from `@evanion/luhn`, which does not extend `TokenError`. `createToken` hands the dictionary to Luhn first, so a dictionary that breaks both packages' rules throws Luhn's error. Catch each with `instanceof`:

With a strict package manager such as pnpm, add `@evanion/luhn` to your own `package.json` at the exact version `@evanion/token` pins. A copy at another version defines a second `InvalidDictionaryError` class, and `instanceof` against it misses the error token's copy throws.

`256 % n === 0` is the constraint that is easy to miss. `crypto.getRandomValues` yields 0–255, and `byte % n` over-represents the first `256 % n` characters. At n = 32 the division is exact. Luhn's own 36-character default is **not** uniform: `256 % 36 === 4`, over-representing its first four characters by 14.3%, which is why this package does not adopt it. Rejection sampling would lift the constraint, at the price of variable-time generation.

The order of the dictionary decides which index each character occupies, and therefore every check character it produces. Reorder it and codes you already issued can fail `validate`, so store it as a constant string and never sort it.

Hexadecimal passes every constraint, at four bits a character:

## API at a Glance

- `createToken(options?)` validates `length`, `chunkSize`, `separator` and `dictionary` and returns a frozen `Token`. Defaults: `8`, `4`, `'-'`, `DEFAULT_DICTIONARY`.
- `Token` carries `dictionary`, `n`, `length`, `chunkSize`, `separator`, `entropyBits`, `generate(options?)` returning `{ value, body, check, prefix }`, and `validate(input)` returning `{ valid: true, body } | { valid: false, reason }`.
- `DEFAULT_DICTIONARY`, `CONFUSABLE_CHARACTERS`, `DEFAULT_LENGTH`, `DEFAULT_CHUNK_SIZE`, `DEFAULT_SEPARATOR` are the constants above.
- `TokenError` is the base class for every error this package defines. `createToken` also lets `@evanion/luhn`'s `InvalidDictionaryError` through. `InvalidAlphabetError` carries `reason` (`confusable | unfolded | non-uniform`), `dictionary` and `offending`. `InvalidShapeError` carries `reason`, `length`, `chunkSize` and `separator`.

Everything is checked at construction and nothing at use: `generate` and `validate` never throw, and an instance cannot mint an unprefixed code its own `validate` rejects.

## Full Documentation

For the full guides, the API reference and an interactive validator, visit the documentation site:

👉 **[docs.evanion.com/token](https://docs.evanion.com/token)**

## License

MIT, see [LICENSE](LICENSE).
