![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)
![npm (scoped)](https://img.shields.io/npm/v/@evanion/token)

# Token Library

Short codes a person can read aloud, type from a card, or dictate over a
phone — each carrying a check character, so a mistyped one is rejected before
you touch the database.

```ts
import { createToken } from '@evanion/token';

const token = createToken();

token.generate(); // -> { value: 'a4kp-9mxa', body: 'a4kp9mx', check: 'a', prefix: undefined }
token.validate('a4kp-9mxa'); // -> { valid: true, body: 'a4kp9mx' }
```

## Why use it

Two properties make a code usable by a human:

- The alphabet leaves out characters that are confused when read or heard.
  `1`/`l`/`i` and `0`/`o` are the point.
- A wrong code can be rejected **before** an expensive operation. A database
  lookup for a code that was mistyped is a lookup that never needed to happen.

The second one is the check character, and it is not optional here. Without it
this package is three lines of `crypto.randomBytes`.

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

## Generate a code

```ts
const token = createToken();

token.generate();
// -> { value: 'a4kp-9mxa', body: 'a4kp9mx', check: 'a', prefix: undefined }

token.generate({ prefix: 'ORD' });
// -> { value: 'ORD-a4kp-9mxa', body: 'a4kp9mx', check: 'a', prefix: 'ORD' }
```

`value` is the code as a person sees it. `body` is what the check character was
computed over, unchunked, which is the form to store and index on.

Characters are drawn from `crypto.randomBytes`. `generate` never retries and
never checks for collisions — see [Entropy](#entropy).

## Validate a code

```ts
token.validate('a4kp-9mxa'); // -> { valid: true,  body: 'a4kp9mx' }
token.validate('a4kp-9mx8'); // -> { valid: false, reason: 'check-failed' }
token.validate('a4kp-9mxo'); // -> { valid: false, reason: 'outside-alphabet' }
token.validate('a4kp-9mx'); // -> { valid: false, reason: 'wrong-length' }
```

| `reason`           | Meaning                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `outside-alphabet` | a character not in the dictionary, after separators are stripped |
| `wrong-length`     | the code is not `length` characters long                         |
| `check-failed`     | the last character does not check out against the ones before it |

`validate` returns a reason rather than throwing, because it is the cheap gate
in front of a lookup, not an exceptional path. It is total and free of side
effects.

**`valid: true` does not mean the code exists**, and it is not authentication.
One code in `n` passes by construction — one in 32 with the default alphabet.
Treat it as a filter, never as a credential.

### What the check character catches

Luhn's guarantee, over any alphabet:

- Every single-character substitution, at every position, including the check
  character itself.
- Every swap of two adjacent characters, except one pair: the first and last
  entries of the dictionary — `0` and `z` by default.

That one blind spot is structural. With `g(x) = floor(2x / n) + (2x mod n)`, a
swap of indices `a` and `b` escapes exactly when `a + g(b) ≡ b + g(a)` (mod n),
which for even `n` has the single non-trivial solution `{0, n - 1}`. It is the
textbook mod-10 `{0, 9}` case, generalised.

## Separators are presentation

`generate` chunks `value` and leaves `body` unchunked. `validate` strips the
separator first, so a code typed without it, or grouped differently, still
validates:

```ts
token.validate('a4kp9mxa').valid; // -> true
token.validate('a4-kp-9m-xa').valid; // -> true
```

Case is folded too, so a code read off a card in capitals validates:

```ts
token.validate('A4KP-9MXA'); // -> { valid: true, body: 'a4kp9mx' }
```

`chunkSize` must divide `length`, or `createToken` throws: a trailing chunk of
one character is exactly the thing this package exists to avoid. Set
`chunkSize` equal to `length` for an unchunked code.

```ts
const short = createToken({ length: 6, chunkSize: 3, separator: ' ' });

short.generate(); // -> { value: 'q7t 3n7', body: 'q7t3n', check: '7', prefix: undefined }
```

## The prefix sits outside the checksum

`ORD-a4kp-9mxa` checksums `a4kp9mx` only, and `validate` takes the code without
the prefix:

```ts
const { value } = token.generate({ prefix: 'ORD' });

token.validate(value); // -> { valid: false, reason: 'outside-alphabet' }
token.validate(value.slice('ORD-'.length)); // -> { valid: true, ... }
```

Folding the prefix in would require every prefix character to be in the
alphabet, and `ORD` contains `o`, which is excluded precisely because it is
confusable. Comparing the prefix is a literal string match, which is what a
caller writing `value.startsWith('ORD-')` expects. If you want the prefix
authenticated, put it in the body.

## Entropy

`length` counts the check character, so usable entropy is
`(length - 1) * log2(n)`. At the defaults — `length: 8`, `n: 32` — that is
**35 bits**, and `token.entropyBits` reports it.

35 bits is 34,359,738,368 values. Read that as a collision budget rather than
as a guess-resistance budget:

- A 50% chance of one collision arrives at about **218,000** codes.
- At 1,000,000 issued codes a collision is effectively certain.

So uniqueness is a unique index on your table, not a property this generator
offers. Raise `length` if 218,000 is within reach of your volume; five more
characters buys 25 more bits.

## The alphabet

The default is 32 characters:

```ts
token.dictionary; // -> '0123456789abcdefghjkmnpqrstuvxyz'
token.n; // -> 32
```

It is the lowercase alphanumerics without `i`, `l`, `o` and `w`. The first
three go because they are read as `1`, `1` and `0`. `w` goes because it is the
one English letter whose name is polysyllabic and contains another letter's
name — "double-u" — which is what breaks it when a code is dictated. `1` and
`0` survive their own groups because a code is as often typed as spoken, and a
digit is unambiguous on a keypad.

A dictionary you supply has to satisfy three independent constraints at once,
all checked by `createToken`:

| Constraint                      | Enforced by     | Why                                    |
| ------------------------------- | --------------- | -------------------------------------- |
| no confusable characters        | this package    | `1`/`l`/`i` and `0`/`o` are the point  |
| lowercase                       | this package    | input is case folded before it is read |
| `256 % n === 0`                 | this package    | otherwise `byte % n` is biased         |
| even size, no repeats, no pairs | `@evanion/luhn` | a check character has to be definable  |

```ts
createToken({ dictionary: '0123456789abcdefghijklmnopqrstuvwxyz' });
// throws InvalidAlphabetError { reason: 'confusable', offending: ['i', 'l', 'o', 'w'] }

createToken({ dictionary: '0123456789abcdefghjkmnpqrstuvx' });
// throws InvalidAlphabetError { reason: 'non-uniform' } -- 30 does not divide 256
```

`256 % n === 0` is the constraint that is easy to miss. `crypto.randomBytes`
yields 0–255, and `byte % n` over-represents the first `256 % n` characters. At
n = 32 the division is exact. Luhn's own 36-character default is **not**
uniform — `256 % 36 === 4`, over-representing its first four characters by
14.3% — which is why this package does not adopt it.

Rejection sampling is the alternative to constraining the alphabet. It is not
used here: it makes generation variable-time, and the constraint is
satisfiable — the default proves it.

The order of the dictionary decides which index each character occupies, and
therefore every check character it produces. Two alphabets with the same
characters in a different order are different alphabets.

## API reference

### `createToken(options?)`

Validates the options and returns a frozen `Token`.

- `options.length` — total characters, check character included. Defaults to
  `8`.
- `options.chunkSize` — characters between separators. Must divide `length`.
  Defaults to `4`.
- `options.separator` — placed between chunks and after a prefix. Must share no
  character with the dictionary. Defaults to `'-'`.
- `options.dictionary` — the alphabet. Defaults to `DEFAULT_DICTIONARY`.

### The returned object

- `dictionary: string`
- `n: number` — characters in the dictionary.
- `length`, `chunkSize`, `separator` — as configured.
- `entropyBits: number` — `(length - 1) * log2(n)`.
- `generate(options?): { value, body, check, prefix }`
- `validate(input): { valid: true, body } | { valid: false, reason }`

### Constants

- `DEFAULT_DICTIONARY` — the 32 characters above.
- `CONFUSABLE_CHARACTERS` — `'ilow'`, excluded from every alphabet.
- `DEFAULT_LENGTH`, `DEFAULT_CHUNK_SIZE`, `DEFAULT_SEPARATOR` — `8`, `4`, `-`.

### Errors

- `TokenError` — base class for everything this package throws.
- `InvalidAlphabetError extends TokenError` — carries `reason`
  (`confusable | unfolded | non-uniform`), `dictionary` and `offending`.
- `InvalidShapeError extends TokenError` — carries `reason` and all three of
  `length`, `chunkSize`, `separator`.

A dictionary that fails one of Luhn's own constraints throws
`InvalidDictionaryError` from `@evanion/luhn`, which does not extend
`TokenError`. Catch `Error` to cover both.

Everything is checked at construction. Nothing is checked at use, so an
instance you hold cannot produce a code its own `validate` rejects.

## Testing

```bash
npm test
```

## License

MIT — see [LICENSE](LICENSE).
