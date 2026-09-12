![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)
![npm (scoped)](https://img.shields.io/npm/v/@evanion/luhn)

# Luhn Library

Generate and validate check characters over any alphabet you choose. A
dictionary is validated once, at construction, and the object you get back
carries `generate` and `validate` bound to it.

```ts
import { Luhn } from '@evanion/luhn';
import { generateRandom } from 'some_library';

const createToken = () => {
  const randomString = generateRandom();
  const { checksum } = Luhn.generate(randomString);
  return `${randomString}-${checksum}`;
};
```

## Why use it

A check character lets you reject a mistyped input without a database lookup.
That is worth having anywhere a person types an identifier by hand: a licence
key, a gift card number, a support reference.

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

```ts
Luhn.generate('foo'); // -> { phrase: 'foo', checksum: '5', filtered: 0 }
Luhn.generate('FoO'); // -> { phrase: 'foo', checksum: '5', filtered: 0 }
```

`generate` returns the filtered phrase alongside the check character, because
the phrase it computed over is not always the phrase you passed in — see
[Filtering](#filtering).

An input with no dictionary code points in it throws `EmptyInputError`. A check
character over no payload carries no information, and returning one makes
`generate('')` and `generate('!!!!')` indistinguishable.

## Validate a string

The last dictionary code point of the input is the check character.

```ts
Luhn.validate('foo5'); // -> { phrase: 'foo5', isValid: true, filtered: 0 }
Luhn.validate('FOO5'); // -> { phrase: 'foo5', isValid: true, filtered: 0 }
Luhn.validate('FoO-ö5'); // -> { phrase: 'foo5', isValid: true, filtered: 2 }
Luhn.validate('bar5'); // -> { phrase: 'bar5', isValid: false, filtered: 0 }
```

Fewer than two surviving code points is not valid — a payload and a check
character is the minimum:

```ts
Luhn.validate(''); // -> { phrase: '', isValid: false, filtered: 0 }
Luhn.validate('!!!!0'); // -> { phrase: '0', isValid: false, filtered: 4 }
```

## Filtering

Code points outside the dictionary are dropped before the checksum is computed,
so a hyphenated or accented rendering of the same token checks the same:

```ts
Luhn.generate('foo-baz'); // -> { phrase: 'foobaz', checksum: 'p', filtered: 1 }
Luhn.generate('fooö-baz'); // -> { phrase: 'foobaz', checksum: 'p', filtered: 2 }
```

`filtered` counts the dropped code points, so a caller who wants strict input
can gate on it without reimplementing the filter.

## The dictionary

The default is 36 lowercase alphanumerics, with case folding on:

```ts
Luhn.dictionary; // -> '0123456789abcdefghijklmnopqrstuvwxyz'
Luhn.n; // -> 36
Luhn.caseInsensitive; // -> true
```

The order of the dictionary decides which index each code point occupies, and
therefore every check character it produces. Two dictionaries with the same
characters in a different order are different alphabets.

Build your own with `createLuhn`:

```ts
import { createLuhn } from '@evanion/luhn';

const hex = createLuhn({ dictionary: '0123456789abcdef' });

hex.generate('cafe'); // -> { phrase: 'cafe', checksum: '3', filtered: 0 }
hex.validate('cafe3').isValid; // -> true
```

A dictionary must satisfy all of these, and `createLuhn` throws
`InvalidDictionaryError` — carrying a `reason` — when it does not:

| `reason`       | Constraint                                                   |
| -------------- | ------------------------------------------------------------ |
| `not-a-string` | the dictionary is a string                                   |
| `too-short`    | at least 2 code points                                       |
| `odd-length`   | an even number of code points                                |
| `duplicate`    | no code point appears twice                                  |
| `case-pairs`   | no two code points are case variants, when `caseInsensitive` |

Everything is checked once, at construction. Nothing is checked at use, so an
instance you hold cannot produce a token its own `validate` rejects.

Counting is by code point, so an astral dictionary — emoji, or anything outside
the Basic Multilingual Plane — is measured and indexed as you wrote it.

## Case sensitivity

`caseInsensitive` folds input to lowercase before looking it up. It is a
property of the dictionary, not of the call: folding is sound only when the
dictionary contains no case pairs, because otherwise two distinct indices fold
onto one and the rest become unreachable.

It defaults to `true` when you supply no dictionary and `false` when you do.

```ts
import { ALTERNATING_CASE_DICTIONARY, createLuhn } from '@evanion/luhn';

const sensitive = createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY });

sensitive.generate('FoO'); // -> { phrase: 'FoO', checksum: 'K', filtered: 0 }
sensitive.validate('FoOK').isValid; // -> true
sensitive.validate('fook').isValid; // -> false
```

Asking for folding over a dictionary that has case pairs is rejected rather
than quietly downgraded:

```ts
createLuhn({
  dictionary: ALTERNATING_CASE_DICTIONARY,
  caseInsensitive: true,
}); // throws InvalidDictionaryError, reason: 'case-pairs'
```

## Mod-10

With `dictionary: '0123456789'` this library is plain Luhn mod-10:

```ts
const digits = createLuhn({ dictionary: '0123456789' });

digits.generate('7992739871').checksum; // -> '3'
digits.validate('4539578763621486').isValid; // -> true
digits.validate('79927398710').isValid; // -> false
```

## Modulo bias

The obvious way to use this library is to draw a random string over the
dictionary and then check-character it. Drawing with `byte % dictionary.length`
is uniform only when the dictionary size divides 256. The default 36-character
dictionary does not — `256 % 36` is 4, and the first four characters come up
about 15% more often than the rest.

This library does not generate random values and will not start; a checksum
library shipping a CSPRNG sampler acquires a security surface for a problem
that is not its own. It states the fact instead:

```ts
Luhn.uniformOverBytes; // -> false
createLuhn({ dictionary: '0123456789abcdefghjkmnpqrstuvxyz' }).uniformOverBytes; // -> true
```

`uniformOverBytes` reports that `byte % n` is unbiased. It says nothing about
the quality of the bytes. If you intend to sample from your dictionary, pick a
size that divides 256 — 32 is the useful one.

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

- `options.dictionary` — the alphabet. Defaults to `DEFAULT_DICTIONARY`.
- `options.caseInsensitive` — fold input to lowercase. Defaults to `true` when
  `dictionary` is omitted, `false` when it is given.

### The returned object

- `dictionary: string`
- `n: number` — the modulus, counted by code point.
- `caseInsensitive: boolean`
- `uniformOverBytes: boolean` — whether `n` divides 256.
- `generate(input): { phrase, checksum, filtered }` — throws `EmptyInputError`
  when nothing survives the filter.
- `validate(input): { phrase, isValid, filtered }`

### Constants

- `Luhn` — `createLuhn()`, frozen. `Luhn.dictionary = x` throws a `TypeError`.
- `DEFAULT_DICTIONARY` — 36 lowercase alphanumerics.
- `ALTERNATING_CASE_DICTIONARY` — 62 characters, `0-9` then `Aa Bb … Zz`.

### Errors

- `LuhnError` — base class for everything this library throws.
- `InvalidDictionaryError extends LuhnError` — carries `reason`, `dictionary`,
  and `offending` (the repeated code points, or the case pairs).
- `EmptyInputError extends LuhnError` — `generate` had nothing to work with.

## Migrating from 2.x

**Every check character changes.** The default dictionary goes from 62
characters to 36, so every index changes. Tokens minted by 2.x do not validate
under 3.x.

| 2.x                                                | 3.x                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `Luhn.generate(input)`                             | unchanged call, new value                                                  |
| `Luhn.validate(input)`                             | unchanged call; it now accepts every token `generate` produces             |
| `Luhn.generate(input, true)`                       | `createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY }).generate(input)`  |
| `class X extends Luhn { static dictionary = d }`   | `createLuhn({ dictionary: d, caseInsensitive: true })`                     |
| `class X extends Luhn { static sensitive = true }` | `createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY })` — same values    |
| `Luhn.dictionary = d`                              | `TypeError`; the default instance is frozen                                |
| `Luhn.sensitive`                                   | `Luhn.caseInsensitive`                                                     |
| `Luhn.lowercaseOnly(d)`                            | removed; nothing folds a dictionary any more                               |
| the `protected static` helpers                     | removed; they were arrow fields bound to `Luhn` and never overridable      |
| `ValidationError`                                  | `LuhnError`                                                                |
| `validate('')` → `isValid: true`                   | `isValid: false`                                                           |
| `generate('')` → `{ checksum: '0' }`               | throws `EmptyInputError`                                                   |
| an odd dictionary throws at the first call         | throws at `createLuhn`                                                     |

A per-request dictionary is a per-request instance. That is one pass over the
dictionary, which is the pass that would have happened anyway.

## Testing

```bash
npm test
```

## License

MIT — see [LICENSE](LICENSE).
