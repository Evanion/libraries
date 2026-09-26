[![npm version](https://img.shields.io/npm/v/@evanion/token)](https://www.npmjs.com/package/@evanion/token)
[![npm downloads](https://img.shields.io/npm/dm/@evanion/token)](https://www.npmjs.com/package/@evanion/token)
[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# Token Library

Short codes a person can read aloud, type from a card, or dictate over a
phone. Each one carries a check character, so a mistyped one is rejected before
you touch the database.

<!-- #region at-a-glance -->

```ts @import.meta.vitest
import { createToken } from '@evanion/token';

const token = createToken();

token.validate('a4kp-9mxa'); // -> { valid: true, body: 'a4kp9mx' }
token.validate('a4kp-9mx8'); // -> { valid: false, reason: 'check-failed' }
```

<!-- #endregion at-a-glance -->

## Why use it

Two properties make a code usable by a human:

- The alphabet leaves out characters that are confused when read or heard, such
  as `l` and `i` for `1` and `o` for `0`.
- A wrong code can be rejected **before** an expensive operation. A database
  lookup for a code that was mistyped is a lookup that never needed to happen.

The second one is the check character, and it is not optional here. Without it
this package is three lines of `crypto.getRandomValues`.

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

## Construct an instance

`createToken` validates every option once and returns a frozen object with
`generate` and `validate` bound to it. Build it at module scope. The defaults are
a `length` of 8, which counts the check character, chunked in fours, so `value`
comes back nine characters long with its one separator:

<!-- #region construct -->

```ts @import.meta.vitest
import { createToken } from '@evanion/token';

const token = createToken();

token.generate().value.length; // -> 9
```

<!-- #endregion construct -->

Every option is optional. A gift card code wants more characters than a pickup
code:

<!-- #region instances -->

```ts @import.meta.vitest
const pickupCode = createToken();
const giftCard = createToken({ length: 16, chunkSize: 4 });

pickupCode.generate().value.length; // -> 9
giftCard.generate().value.length; // -> 19
giftCard.entropyBits; // -> 75
```

<!-- #endregion instances -->

A shape that cannot describe a code throws `InvalidShapeError`, which carries a
`reason` and all three of `length`, `chunkSize` and `separator` as they were
resolved:

<!-- #region shape-errors -->

```ts @import.meta.vitest
import { InvalidShapeError, createToken } from '@evanion/token';
import type { TokenOptions } from '@evanion/token';

/** The shape error `createToken` throws for `options`, if it throws one. */
function refusal(options: TokenOptions): InvalidShapeError | undefined {
  try {
    createToken(options);
  } catch (error) {
    if (error instanceof InvalidShapeError) return error;
    throw error;
  }
  return undefined;
}

refusal({ length: 10, chunkSize: 5 }); // -> undefined
refusal({ length: 10, chunkSize: 4 })?.reason; // -> 'chunk-size-indivisible'
refusal({ length: 10, chunkSize: 4 })?.message; // -> 'Token chunkSize must divide length, or the last chunk is shorter than the rest; 4 does not divide 10.'
refusal({ separator: 'a' })?.reason; // -> 'separator-in-dictionary'
refusal({ separator: 'a' })?.length; // -> 8
```

<!-- #endregion shape-errors -->

## Generate a code

`generate` draws `length - 1` random characters, appends the check character,
and chunks the result. The characters are random, so what can be claimed about
a pickup code is its shape:

<!-- #region generate -->

```ts @import.meta.vitest
const token = createToken();

const pickup = token.generate({ prefix: 'ORD' });

pickup.prefix; // -> 'ORD'
pickup.body.length; // -> 7
pickup.value.length; // -> 13
pickup.value.endsWith(pickup.check); // -> true
```

<!-- #endregion generate -->

`value` is the code as a person sees it, such as `ORD-a4kp-9mxa`. `body` is what
the check character was computed over, unchunked, which is the form to store
and index on.

The round trip is the other thing that can be claimed: the code `generate`
minted validates, and a code with one character retyped does not.

<!-- #region round-trip -->

```ts @import.meta.vitest
const token = createToken();
const pickup = token.generate({ prefix: 'ORD' });

token.validate(pickup.value.slice('ORD-'.length)).valid; // -> true
token.validate('a4kp-9mx8').valid; // -> false
```

<!-- #endregion round-trip -->

Characters are drawn from `crypto.getRandomValues`, which is Web Crypto: the
same CSPRNG in Node 20 and in a browser, so the package runs in either with no
import and no polyfill. `generate` never retries and never checks for
collisions. See [Entropy](#entropy).

## Validate a code

<!-- #region validate -->

```ts @import.meta.vitest
const token = createToken();

token.validate('a4kp-9mxa'); // -> { valid: true, body: 'a4kp9mx' }
token.validate('a4kp-9mx8'); // -> { valid: false, reason: 'check-failed' }
token.validate('a4kp-9mxo'); // -> { valid: false, reason: 'outside-alphabet' }
token.validate('a4kp-9mx'); // -> { valid: false, reason: 'wrong-length' }
```

<!-- #endregion validate -->

| `reason`           | Meaning                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `outside-alphabet` | a character not in the dictionary, after separators are stripped |
| `wrong-length`     | the code is not `length` characters long                         |
| `check-failed`     | the last character does not check out against the ones before it |

`validate` returns a reason rather than throwing, because it is the cheap gate
in front of a lookup, not an exceptional path. It is total and free of side
effects.

Narrow on `valid` to reach `body`, and look the order up by it:

<!-- #region lookup -->

```ts @import.meta.vitest
const token = createToken();
const orders = new Map([['a4kp9mx', 'order-2026-0042']]);

function findOrder(input: string): string {
  const result = token.validate(input);
  if (!result.valid) return `refused: ${result.reason}`;
  return orders.get(result.body) ?? 'no such order';
}

findOrder('A4KP9MXA'); // -> 'order-2026-0042'
findOrder('a4kp-9mx8'); // -> 'refused: check-failed'
findOrder(token.generate().value); // -> 'no such order'
```

<!-- #endregion lookup -->

**`valid: true` does not mean the code exists**, and it is not authentication.
One code in `n` passes by construction, which is one in 32 with the default
alphabet. Treat it as a filter, never as a credential.

### What the check character catches

Luhn's guarantee, over any alphabet:

- Every single-character substitution, at every position, including the check
  character itself.
- Every swap of two adjacent characters, except one pair: the first and last
  entries of the dictionary, `0` and `z` by default.

<!-- #region check-catches -->

```ts @import.meta.vitest
const token = createToken();

token.validate('a4kp-9mza').valid; // -> false
token.validate('a4pk-9mxa').valid; // -> false
token.validate('b0zg-7kqb').valid; // -> true
token.validate('bz0g-7kqb').valid; // -> true
```

<!-- #endregion check-catches -->

That one blind spot is structural. With `g(x) = floor(2x / n) + (2x mod n)`, a
swap of indices `a` and `b` escapes exactly when `a + g(b) ≡ b + g(a)` (mod n),
which for even `n` has the single non-trivial solution `{0, n - 1}`. It is the
textbook mod-10 `{0, 9}` case, generalised.

## Separators are presentation

`generate` chunks `value` and leaves `body` unchunked. `validate` strips the
separator and folds case first, so a code typed without the separator, grouped
differently, or read off a card in capitals still validates:

<!-- #region separators -->

```ts @import.meta.vitest
const token = createToken();

token.validate('a4kp9mxa').valid; // -> true
token.validate('a4-kp-9m-xa').valid; // -> true
token.validate('A4KP-9MXA'); // -> { valid: true, body: 'a4kp9mx' }
```

<!-- #endregion separators -->

`chunkSize` must divide `length`, or `createToken` throws: a trailing chunk of
one character is exactly the thing this package exists to avoid. Set
`chunkSize` equal to `length` for an unchunked code. A shorter code with a
space between two chunks of three reads aloud as two words:

<!-- #region spoken -->

```ts @import.meta.vitest
const counterCode = createToken({ length: 6, chunkSize: 3, separator: ' ' });
const { value } = counterCode.generate();

value.length; // -> 7
value.charAt(3); // -> ' '
counterCode.validate(value.replace(' ', '')).valid; // -> true
```

<!-- #endregion spoken -->

## The prefix sits outside the checksum

`ORD-a4kp-9mxa` checksums `a4kp9mx` only, and `validate` takes the code without
the prefix:

<!-- #region prefix -->

```ts @import.meta.vitest
const token = createToken();

const { value } = token.generate({ prefix: 'ORD' });

token.validate(value); // -> { valid: false, reason: 'outside-alphabet' }
token.validate(value.slice('ORD-'.length)).valid; // -> true
value.startsWith('ORD-'); // -> true
```

<!-- #endregion prefix -->

Folding the prefix in would require every prefix character to be in the
alphabet, and `ORD` contains `o`, which is excluded precisely because it is
confusable. Comparing the prefix is a literal string match, which is what a
caller writing `value.startsWith('ORD-')` expects. `generate` draws the whole
body at random, so no option brings a prefix under the check character.

## Entropy

`length` counts the check character, so usable entropy is
`(length - 1) * log2(n)`. At the defaults, `length: 8` and `n: 32`, that is
**35 bits**, and `entropyBits` reports it:

<!-- #region entropy -->

```ts @import.meta.vitest
const token = createToken();

token.entropyBits; // -> 35
createToken({ length: 12 }).entropyBits; // -> 55
createToken({ length: 13, chunkSize: 13 }).entropyBits; // -> 60
```

<!-- #endregion entropy -->

35 bits is 34,359,738,368 values. Read that as a collision budget rather than
as a guess-resistance budget:

- A 50% chance of one collision arrives at about **218,000** codes.
- At 1,000,000 issued codes a collision is effectively certain.

So uniqueness is a unique index on your table, not a property this generator
offers. Draw again when the insert conflicts:

<!-- #region issue -->

```ts @import.meta.vitest
const token = createToken();

/** Stands in for the orders table's unique index on the code's body. */
const issued = new Set<string>();

function insertPickupCode(body: string): boolean {
  if (issued.has(body)) return false;
  issued.add(body);
  return true;
}

function issuePickupCode(): string {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { value, body } = token.generate({ prefix: 'ORD' });
    if (insertPickupCode(body)) return value;
  }
  throw new Error('could not allocate a pickup code');
}

issuePickupCode().startsWith('ORD-'); // -> true
issued.size; // -> 1
```

<!-- #endregion issue -->

Raise `length` if 218,000 is within reach of your volume; five more characters
add 25 more bits.

## The alphabet

The default is 32 characters:

<!-- #region default-alphabet -->

```ts @import.meta.vitest
import { CONFUSABLE_CHARACTERS, DEFAULT_DICTIONARY } from '@evanion/token';

DEFAULT_DICTIONARY; // -> '0123456789abcdefghjkmnpqrstuvxyz'
DEFAULT_DICTIONARY.length; // -> 32
CONFUSABLE_CHARACTERS; // -> 'ilow'
```

<!-- #endregion default-alphabet -->

It is the lowercase alphanumerics without `i`, `l`, `o` and `w`. The first
three go because they are read as `1`, `1` and `0`. `w` goes because it is the
one English letter whose name is polysyllabic and contains another letter's
name, "double-u", which is what breaks it when a code is dictated. `1` and `0`
survive their own groups because a code is as often typed as spoken, and a
digit is unambiguous on a keypad.

A dictionary you supply has to satisfy four constraints at once, all checked by
`createToken`:

| Constraint                           | Enforced by     | Why                                    |
| ------------------------------------ | --------------- | -------------------------------------- |
| no confusable characters             | this package    | `l`, `i` read as `1`, and `o` as `0`   |
| lowercase                            | this package    | input is case folded before it is read |
| `256 % n === 0`                      | this package    | otherwise `byte % n` is biased         |
| even size, no repeats, no case pairs | `@evanion/luhn` | a check character has to be definable  |

The three this package owns throw `InvalidAlphabetError`, with a `reason` and
the `offending` characters:

<!-- #region alphabet-errors -->

```ts @import.meta.vitest
import { InvalidAlphabetError, createToken } from '@evanion/token';

/** The alphabet error `createToken` throws for `dictionary`, if it throws one. */
function refusal(dictionary: string): InvalidAlphabetError | undefined {
  try {
    createToken({ dictionary });
  } catch (error) {
    if (error instanceof InvalidAlphabetError) return error;
    throw error;
  }
  return undefined;
}

const everything = '0123456789abcdefghijklmnopqrstuvwxyz';

refusal(everything)?.reason; // -> 'confusable'
refusal(everything)?.offending; // -> ['i', 'l', 'o', 'w']
refusal('0123456789abcdefghjkmnpqrstuvx')?.reason; // -> 'non-uniform'
refusal('0123456789ABCDEFGHJKMNPQRSTUVXYZ')?.reason; // -> 'unfolded'
refusal('0123456789abcdef'); // -> undefined
```

<!-- #endregion alphabet-errors -->

A dictionary that fails one of Luhn's own constraints throws
`InvalidDictionaryError` from `@evanion/luhn`, which does not extend
`TokenError`. Catch both by name:

<!-- #region catch-both -->

```ts @import.meta.vitest
import { InvalidDictionaryError } from '@evanion/luhn';
import { TokenError, createToken } from '@evanion/token';

/** The name of the error `createToken` throws for `dictionary`. */
function rejectedBy(dictionary: string): string {
  try {
    createToken({ dictionary });
  } catch (error) {
    if (error instanceof TokenError) return error.name;
    if (error instanceof InvalidDictionaryError) return error.name;
    throw error;
  }
  return 'accepted';
}

rejectedBy('0123456789abcdefghijklmnopqrstuvwxyz'); // -> 'InvalidAlphabetError'
rejectedBy('0123456789abcdefghjkmnpqrstuvxy'); // -> 'InvalidDictionaryError'
rejectedBy('0123456789abcdef'); // -> 'accepted'
```

<!-- #endregion catch-both -->

`256 % n === 0` is the constraint that is easy to miss. `crypto.getRandomValues`
yields 0–255, and `byte % n` over-represents the first `256 % n` characters. At
n = 32 the division is exact. Luhn's own 36-character default is **not**
uniform: `256 % 36 === 4`, over-representing its first four characters by
14.3%, which is why this package does not adopt it.

Rejection sampling is the alternative to constraining the alphabet. It is not
used here: it makes generation variable-time, and the constraint is
satisfiable, as the default shows.

The order of the dictionary decides which index each character occupies, and
therefore every check character it produces. Two alphabets with the same
characters in a different order are different alphabets.

Hexadecimal passes all four constraints, at four bits a character:

<!-- #region hex -->

```ts @import.meta.vitest
const hexCard = createToken({ dictionary: '0123456789abcdef', length: 12 });

hexCard.n; // -> 16
hexCard.entropyBits; // -> 44
hexCard.generate().value.length; // -> 14
```

<!-- #endregion hex -->

## API reference

### `createToken(options?)`

Validates the options and returns a frozen `Token`.

- `options.length`: total characters, check character included. Defaults to
  `8`.
- `options.chunkSize`: characters between separators. Must divide `length`.
  Defaults to `4`.
- `options.separator`: placed between chunks and after a prefix. Must share no
  character with the dictionary. Defaults to `'-'`.
- `options.dictionary`: the alphabet. Defaults to `DEFAULT_DICTIONARY`.

### The returned object

- `dictionary: string`
- `n: number`, the characters in the dictionary.
- `length`, `chunkSize`, `separator`, as configured.
- `entropyBits: number`, which is `(length - 1) * log2(n)`.
- `generate(options?): { value, body, check, prefix }`
- `validate(input): { valid: true, body } | { valid: false, reason }`

### Constants

- `DEFAULT_DICTIONARY`: the 32 characters above.
- `CONFUSABLE_CHARACTERS`: `'ilow'`, excluded from every alphabet.
- `DEFAULT_LENGTH`, `DEFAULT_CHUNK_SIZE`, `DEFAULT_SEPARATOR`: `8`, `4`, `-`.

### Errors

- `TokenError`: base class for everything this package throws.
- `InvalidAlphabetError extends TokenError`: carries `reason`
  (`confusable | unfolded | non-uniform`), `dictionary` and `offending`.
- `InvalidShapeError extends TokenError`: carries `reason` and all three of
  `length`, `chunkSize`, `separator`.

A dictionary that fails one of Luhn's own constraints throws
`InvalidDictionaryError` from `@evanion/luhn`, which does not extend
`TokenError`.

Everything is checked at construction. Nothing is checked at use, so an
instance you hold cannot produce a code its own `validate` rejects.

## License

MIT, see [LICENSE](LICENSE).
