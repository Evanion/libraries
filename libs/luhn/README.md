[![npm version](https://img.shields.io/npm/v/@evanion/luhn)](https://www.npmjs.com/package/@evanion/luhn)
[![npm downloads](https://img.shields.io/npm/dm/@evanion/luhn)](https://www.npmjs.com/package/@evanion/luhn)
[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# Luhn Library

Generate and validate check characters over any alphabet you choose. A
dictionary is validated once, at construction, and the object you get back
carries `generate` and `validate` bound to it.

<!-- #region round-trip -->

```ts @import.meta.vitest
import { Luhn } from '@evanion/luhn';

const { checksum } = Luhn.generate('order-2026-0042');
const code = `order-2026-0042-${checksum}`; // -> 'order-2026-0042-l'

Luhn.validate(code).isValid; // -> true
Luhn.validate('order-2026-0043-l').isValid; // -> false
```

<!-- #endregion round-trip -->

`generate` returns the check character and `validate` accepts the code carrying
it. One digit of the order number changes and the code is refused without a
database lookup.

## Why use it

A check character lets you reject a mistyped input without a database lookup.
That is worth having anywhere a person types an identifier by hand: an order
code read back over the phone, a pickup code typed at a counter, a gift card
number.

<!-- #region catches -->

```ts @import.meta.vitest
import { Luhn } from '@evanion/luhn';

Luhn.validate('order-2026-0042-l').isValid; // -> true
Luhn.validate('order-2026-0043-l').isValid; // -> false
Luhn.validate('order-2026-0024-l').isValid; // -> false
```

<!-- #endregion catches -->

The second code has one digit changed and the third has two adjacent digits
swapped. Both are refused.

## Installation

```bash
npm install @evanion/luhn
```

Or with yarn:

```bash
yarn add @evanion/luhn
```

Or with pnpm:

```bash
pnpm add @evanion/luhn
```

## Generate a check character

<!-- #region generate -->

```ts @import.meta.vitest
Luhn.generate('order-2026-0042'); // -> { phrase: 'order20260042', checksum: 'l', filtered: 2 }
Luhn.generate('ORDER 2026/0042'); // -> { phrase: 'order20260042', checksum: 'l', filtered: 2 }
```

<!-- #endregion generate -->

`generate` returns the filtered phrase alongside the check character, because
the phrase it computed over is not always the phrase you passed in. See
[Filtering](#filtering).

`generate` does not append the check character. Where it goes and what
separates it is yours to decide:

<!-- #region sign-and-read -->

```ts @import.meta.vitest
function sign(orderNumber: string): string {
  const { checksum } = Luhn.generate(orderNumber);
  return `${orderNumber}-${checksum}`;
}

function orderNumberIn(code: string): string | null {
  const { isValid, phrase } = Luhn.validate(code);
  return isValid ? phrase.slice(0, -1) : null;
}

sign('order-2026-0042'); // -> 'order-2026-0042-l'
orderNumberIn('ORDER 2026 0042 L'); // -> 'order20260042'
orderNumberIn('order-2026-0043-l'); // -> null
```

<!-- #endregion sign-and-read -->

An input with no dictionary code points in it throws `EmptyInputError`. A check
character over no payload carries no information, and returning one makes
`generate('')` and `generate('--')` indistinguishable:

<!-- #region empty-input -->

```ts @import.meta.vitest
import { EmptyInputError, Luhn } from '@evanion/luhn';

function checkCharacterFor(orderNumber: string): string | null {
  try {
    return Luhn.generate(orderNumber).checksum;
  } catch (error) {
    if (error instanceof EmptyInputError) return null;
    throw error;
  }
}

checkCharacterFor('order-2026-0042'); // -> 'l'
checkCharacterFor('--'); // -> null
```

<!-- #endregion empty-input -->

## Validate a string

The last dictionary code point of the input is the check character.

<!-- #region validate -->

```ts @import.meta.vitest
Luhn.validate('order-2026-0042-l'); // -> { phrase: 'order20260042l', isValid: true, filtered: 3 }
Luhn.validate('ORDER20260042L'); // -> { phrase: 'order20260042l', isValid: true, filtered: 0 }
Luhn.validate('order-2026-0043-l'); // -> { phrase: 'order20260043l', isValid: false, filtered: 3 }
Luhn.validate('l'); // -> { phrase: 'l', isValid: false, filtered: 0 }
Luhn.validate('--'); // -> { phrase: '', isValid: false, filtered: 2 }
```

<!-- #endregion validate -->

Fewer than two surviving code points is not valid, because a payload and a
check character is the minimum. `validate` never throws.

## Filtering

Code points outside the dictionary are dropped before the checksum is computed,
so a hyphenated, spaced or accented rendering of the same code checks the same.
`filtered` counts the dropped code points, so a caller who wants strict input
can gate on it without reimplementing the filter:

<!-- #region strict-input -->

```ts @import.meta.vitest
type Verdict = 'accepted' | 'mistyped' | 'unexpected characters';

function readStrict(code: string): Verdict {
  const { isValid, filtered } = Luhn.validate(code);
  if (!isValid) return 'mistyped';
  if (filtered > 0) return 'unexpected characters';
  return 'accepted';
}

readStrict('order20260042l'); // -> 'accepted'
readStrict('order-2026-0042-l'); // -> 'unexpected characters'
readStrict('order20260043l'); // -> 'mistyped'
```

<!-- #endregion strict-input -->

## The dictionary

The default is 36 lowercase alphanumerics, with case folding on:

<!-- #region default-dictionary -->

```ts @import.meta.vitest
Luhn.dictionary; // -> '0123456789abcdefghijklmnopqrstuvwxyz'
Luhn.dictionary === DEFAULT_DICTIONARY; // -> true
Luhn.n; // -> 36
Luhn.caseInsensitive; // -> true
```

<!-- #endregion default-dictionary -->

The order of the dictionary decides which index each code point occupies, and
therefore every check character it produces. Two dictionaries with the same
characters in a different order are different alphabets.

Build your own with `createLuhn`. The shop's pickup codes draw on 32 characters,
the 36 with `i`, `l`, `o` and `w` dropped because they are confused when read
aloud:

<!-- #region pickup-dictionary -->

```ts @import.meta.vitest
const pickup = createLuhn({ dictionary: '0123456789abcdefghjkmnpqrstuvxyz' });

pickup.generate('a4kp9mx'); // -> { phrase: 'a4kp9mx', checksum: 'a', filtered: 0 }
pickup.validate('a4kp-9mxa').isValid; // -> true
pickup.n; // -> 32
pickup.caseInsensitive; // -> false
```

<!-- #endregion pickup-dictionary -->

A dictionary must satisfy all of these, and `createLuhn` throws
`InvalidDictionaryError`, carrying a `reason`, when it does not:

| `reason`       | Constraint                                                   |
| -------------- | ------------------------------------------------------------ |
| `not-a-string` | the dictionary is a string                                   |
| `too-short`    | at least 2 code points                                       |
| `odd-length`   | an even number of code points                                |
| `duplicate`    | no code point appears twice                                  |
| `case-pairs`   | no two code points are case variants, when `caseInsensitive` |

<!-- #region constraints -->

```ts @import.meta.vitest
import { InvalidDictionaryError, createLuhn } from '@evanion/luhn';

function problemWith(dictionary: string) {
  try {
    createLuhn({ dictionary });
    return null;
  } catch (error) {
    if (!(error instanceof InvalidDictionaryError)) throw error;
    return { reason: error.reason, offending: error.offending };
  }
}

problemWith('0123456789abcdefghjkmnpqrstuvxyz'); // -> null
problemWith('0123456789abcdefghjkmnpqrstuvxy'); // -> { reason: 'odd-length', offending: [] }
problemWith('0123456789abcdefghjkmnpqrstuvxyy'); // -> { reason: 'duplicate', offending: ['y'] }
problemWith('0'); // -> { reason: 'too-short', offending: [] }
```

<!-- #endregion constraints -->

Everything is checked once, at construction. Nothing is checked at use, so an
instance you hold cannot produce a token its own `validate` rejects.

Counting is by code point, so an astral dictionary, such as emoji or anything
outside the Basic Multilingual Plane, is measured and indexed as you wrote it:

<!-- #region code-points -->

```ts @import.meta.vitest
const suits = createLuhn({ dictionary: '🂡🂱🃁🃑' });

suits.n; // -> 4
'🂡🂱🃁🃑'.length; // -> 8
```

<!-- #endregion code-points -->

A dictionary that varies at runtime is an instance per dictionary. Building one
is one pass over the dictionary, the pass that validates it, so cache the
instance when the same few recur:

<!-- #region instance-per-dictionary -->

```ts @import.meta.vitest
const pickupAlphabet = '0123456789abcdefghjkmnpqrstuvxyz';
const instances = new Map<string, Luhn>();

function luhnFor(dictionary: string): Luhn {
  const held = instances.get(dictionary) ?? createLuhn({ dictionary });
  instances.set(dictionary, held);
  return held;
}

luhnFor(pickupAlphabet).validate('a4kp-9mxa').isValid; // -> true
luhnFor(pickupAlphabet) === luhnFor(pickupAlphabet); // -> true
```

<!-- #endregion instance-per-dictionary -->

## Case sensitivity

`caseInsensitive` folds input to lowercase before looking it up. It is a
property of the dictionary, not of the call: folding is sound only when the
dictionary contains no case pairs, because otherwise two distinct indices fold
onto one and the rest become unreachable.

It defaults to `true` when you supply no dictionary and `false` when you do.

<!-- #region case-sensitivity -->

```ts @import.meta.vitest
const pickup = createLuhn({ dictionary: '0123456789abcdefghjkmnpqrstuvxyz' });
const folding = createLuhn({
  dictionary: '0123456789abcdefghjkmnpqrstuvxyz',
  caseInsensitive: true,
});

pickup.validate('A4KP-9MXA').isValid; // -> false
folding.validate('A4KP-9MXA').isValid; // -> true

const sensitive = createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY });

sensitive.generate('Order-2026-0042').checksum; // -> 'F'
sensitive.validate('Order-2026-0042-F').isValid; // -> true
sensitive.validate('order-2026-0042-F').isValid; // -> false
```

<!-- #endregion case-sensitivity -->

Asking for folding over a dictionary that has case pairs is rejected rather
than quietly downgraded:

<!-- #region case-pairs -->

```ts @import.meta.vitest
let refused: InvalidDictionaryError | undefined;

try {
  createLuhn({
    dictionary: ALTERNATING_CASE_DICTIONARY,
    caseInsensitive: true,
  });
} catch (error) {
  if (error instanceof InvalidDictionaryError) refused = error;
}

refused?.reason; // -> 'case-pairs'
refused?.offending.slice(0, 3); // -> ['Aa', 'Bb', 'Cc']
```

<!-- #endregion case-pairs -->

## Mod-10

With `dictionary: '0123456789'` this library is plain Luhn mod-10, and matches
the published vectors:

<!-- #region mod-10 -->

```ts @import.meta.vitest
const digits = createLuhn({ dictionary: '0123456789' });

digits.generate('7992739871').checksum; // -> '3'
digits.validate('4539578763621486').isValid; // -> true
digits.validate('79927398710').isValid; // -> false
digits.generate('20260042').checksum; // -> '5'
```

<!-- #endregion mod-10 -->

## Modulo bias

The obvious way to use this library is to draw a random string over the
dictionary and then check-character it. Drawing with `byte % dictionary.length`
is uniform only when the dictionary size divides 256. The default 36-character
dictionary does not: `256 % 36` is 4, and the first four characters come up
about 14% more often than the rest.

This library does not generate random values and will not start; a checksum
library shipping a CSPRNG sampler acquires a security surface for a problem
that is not its own. It states the fact instead:

<!-- #region modulo-bias -->

```ts @import.meta.vitest
const pickup = createLuhn({ dictionary: '0123456789abcdefghjkmnpqrstuvxyz' });

Luhn.uniformOverBytes; // -> false
pickup.uniformOverBytes; // -> true
```

<!-- #endregion modulo-bias -->

`uniformOverBytes` reports that `byte % n` is unbiased. It says nothing about
the quality of the bytes. If you intend to sample from your dictionary, pick a
size that divides 256. 32 is the useful one.

## Standards

**Mod-10 is normative.** Luhn's patent
[US 2,950,048](https://patents.google.com/patent/US2950048A/en) defines it, and
ISO/IEC 7812-1 Annex B specifies it for issuer identification numbers, restated
in 3GPP TS 23.003 Annex B.2 and in the
[CMS NPI check-digit specification](https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand/Downloads/NPIcheckdigit.pdf).
With `dictionary: '0123456789'` this library matches the published vectors.

**Mod-N is not.** No RFC, ISO, ITU or ANSI document defines the generalisation
to an arbitrary alphabet. The `floor(a / n) + (a % n)` formula everyone uses
traces to
[Wikipedia revision 74161899](https://en.wikipedia.org/w/index.php?title=Luhn_mod_N_algorithm&oldid=74161899),
dated 2006-09-06, which was unsourced then and is unsourced now; the
implementations that exist say in their own comments that they were
transliterated from that page. With any `n` other than 10, this library
implements that common generalisation and claims nothing more.

The fold itself is Luhn's original formulation rather than a generalisation of
"subtract 9". The patent describes "twice the original digit plus an end around
carry … the addition of any digit standing in the tens position to the digit
standing in the units position". Subtract-9 is the decimal shortcut for it.

## API reference

### `createLuhn(options?)`

Validates the dictionary and returns a frozen `Luhn`.

- `options.dictionary`: the alphabet. Defaults to `DEFAULT_DICTIONARY`.
- `options.caseInsensitive`: fold input to lowercase. Defaults to `true` when
  `dictionary` is omitted, `false` when it is given.

### The returned object

- `dictionary: string`
- `n: number`: the modulus, counted by code point.
- `caseInsensitive: boolean`
- `uniformOverBytes: boolean`: whether `n` divides 256.
- `generate(input): { phrase, checksum, filtered }`: throws `EmptyInputError`
  when nothing survives the filter.
- `validate(input): { phrase, isValid, filtered }`

### Constants

- `Luhn`: `createLuhn()`, frozen. `Luhn.dictionary = x` throws a `TypeError`.
- `DEFAULT_DICTIONARY`: 36 lowercase alphanumerics.
- `ALTERNATING_CASE_DICTIONARY`: 62 characters, `0-9` then `Aa Bb … Zz`.

<!-- #region frozen -->

```ts @import.meta.vitest
let thrown: unknown;

try {
  (Luhn as { dictionary: string }).dictionary = '0123456789';
} catch (error) {
  thrown = error;
}

thrown instanceof TypeError; // -> true
Luhn.dictionary; // -> '0123456789abcdefghijklmnopqrstuvwxyz'
```

<!-- #endregion frozen -->

### Errors

- `LuhnError`: base class for everything this library throws.
- `InvalidDictionaryError extends LuhnError`: carries `reason`, `dictionary`,
  and `offending` (the repeated code points, or the case pairs).
- `EmptyInputError extends LuhnError`: `generate` had nothing to work with.

Catching `LuhnError` handles both without naming either:

<!-- #region catch-any -->

```ts @import.meta.vitest
import { LuhnError, createLuhn } from '@evanion/luhn';

function mint(dictionary: string, orderNumber: string): string {
  try {
    return createLuhn({ dictionary }).generate(orderNumber).checksum;
  } catch (error) {
    if (error instanceof LuhnError) return error.name;
    throw error;
  }
}

mint('0123456789', '20260042'); // -> '5'
mint('0123456789', 'ORD'); // -> 'EmptyInputError'
mint('012345678', '20260042'); // -> 'InvalidDictionaryError'
```

<!-- #endregion catch-any -->

## Migrating from 2.x

**Every check character changes.** The default dictionary goes from 62
characters to 36, so every index changes. Tokens minted by 2.x do not validate
under 3.x.

| 2.x                                                | 3.x                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `Luhn.generate(input)`                             | unchanged call, new value                                              |
| `Luhn.validate(input)`                             | unchanged call; it now accepts every token `generate` produces         |
| `Luhn.generate(input, true)`                       | `createLuhn({ caseInsensitive: false }).generate(input)`               |
| `class X extends Luhn { static dictionary = d }`   | `createLuhn({ dictionary: d, caseInsensitive: true })`                 |
| `class X extends Luhn { static sensitive = true }` | `createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY })`, same values |
| `Luhn.dictionary = d`                              | `TypeError`; the default instance is frozen                            |
| `Luhn.sensitive`                                   | `Luhn.caseInsensitive`                                                 |
| `Luhn.lowercaseOnly(d)`                            | removed; nothing folds a dictionary any more                           |
| the `protected static` helpers                     | removed; they were arrow fields bound to `Luhn` and never overridable  |
| `ValidationError`                                  | `LuhnError`                                                            |
| `validate('')` → `isValid: true`                   | `isValid: false`                                                       |
| `generate('')` → `{ checksum: '0' }`               | throws `EmptyInputError`                                               |
| an odd dictionary throws at the first call         | throws at `createLuhn`                                                 |

A per-request dictionary is a per-request instance. That is one pass over the
dictionary, which is the pass that would have happened anyway.

## License

MIT — see [LICENSE](LICENSE).
