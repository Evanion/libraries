# @evanion/luhn

**Prevent mistyped identifiers from hitting your database.**

Stop performing database lookups for IDs that cannot exist. Whether it's an order number, a gift card, or a tracking ID, `@evanion/luhn` lets you add a check character to your identifiers, allowing you to reject typos instantly and locally.

## The Problem: The "Ghost Lookup" Bottleneck

When a user types an ID into a form, the standard approach is to send that ID to the server and query the database. But what happens when the user makes a simple typo?

1. **Wasted Resources**: Your database spends CPU and I/O searching for a record that cannot possibly exist.
2. **Poor Feedback**: The user gets a generic "Not Found" error, which doesn't tell them _why_ the ID is invalid—only that it isn't in the system.
3. **Infrastructure Stress**: At scale, mistyped IDs add a "ghost load" to your primary data store.

## The Solution: Check-Character Validation

By adding a single check character to the end of your identifier, you turn the ID into a self-validating string. Using a generalized Luhn algorithm, `@evanion/luhn` verifies the integrity of an identifier in memory, without a network call or a database query.

### Core Concept: The Local Gate

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

`generate` returns the check character and does not append it, so `orderCode` decides where it goes. `validate` refuses the code with its last character misread as a `1`.

### What a Check Character Catches

<!-- #region catches -->

```ts @import.meta.vitest
import { Luhn } from '@evanion/luhn';

Luhn.validate('order-2026-0042-l').isValid; // -> true
Luhn.validate('order-2026-0043-l').isValid; // -> false
Luhn.validate('order-2026-0024-l').isValid; // -> false
```

<!-- #endregion catches -->

The second code has one digit changed and the third has two adjacent digits swapped. Both are refused.

## Key Features

- 🌍 **Alphabet Agnostic**: Works over any even-sized alphabet you choose—numbers, letters, or custom symbols.
- 🛡️ **Typo-Resistant**: Detects every single-character substitution and every adjacent swap except one: the dictionary's first and last characters.
- ⚡ **Zero DB Overhead**: Reject mistyped input at the edge or in the middleware, before it ever reaches your data layer.
- ⚙️ **Customizable Moduli**: Support for standard Mod-10 (Credit Cards) or custom Mod-N alphabets.
- 🪶 **Zero Dependencies**: ESM-only, for Node 20 or newer and any browser.

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

## Generating and Validating

`@evanion/luhn` exposes two calls on every instance: `generate` computes a check character, and `validate` checks a code that carries one.

### What `generate` Returns

<!-- #region generate -->

```ts @import.meta.vitest
Luhn.generate('order-2026-0042'); // -> { phrase: 'order20260042', checksum: 'l', filtered: 2 }
Luhn.generate('ORDER 2026/0042'); // -> { phrase: 'order20260042', checksum: 'l', filtered: 2 }
```

<!-- #endregion generate -->

`generate` returns the phrase it computed over alongside the check character, because the phrase is not always the input you passed in. Characters outside the dictionary are dropped and counted in `filtered`.

### Handling Empty Input

`generate` throws `EmptyInputError` when no character of the input is in the dictionary. A check character over no payload carries no information, and returning one would make `generate('')` and `generate('--')` indistinguishable:

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

### What `validate` Returns

`validate` treats the last dictionary character of its input as the check character, and never throws.

<!-- #region validate -->

```ts @import.meta.vitest
Luhn.validate('order-2026-0042-l'); // -> { phrase: 'order20260042l', isValid: true, filtered: 3 }
Luhn.validate('ORDER20260042L'); // -> { phrase: 'order20260042l', isValid: true, filtered: 0 }
Luhn.validate('order-2026-0043-l'); // -> { phrase: 'order20260043l', isValid: false, filtered: 3 }
Luhn.validate('l'); // -> { phrase: 'l', isValid: false, filtered: 0 }
Luhn.validate('--'); // -> { phrase: '', isValid: false, filtered: 2 }
```

<!-- #endregion validate -->

Fewer than two surviving characters is never valid, because a payload and a check character is the minimum.

### Mapping a Code Back to an Order

`validate`'s `phrase` includes the check character, so the phrase `generate` returned for the order number is `phrase.slice(0, -1)`. Store that phrase with the order and look the order up by it, whatever case and separators the code was typed with:

<!-- #region look-up -->

```ts @import.meta.vitest
function orderPhrase(code: string): string | null {
  const { isValid, phrase } = Luhn.validate(code);
  return isValid ? phrase.slice(0, -1) : null;
}

Luhn.generate('order-2026-0042').phrase; // -> 'order20260042'
orderPhrase('ORDER 2026 0042 L'); // -> 'order20260042'
orderPhrase('order-2026-0043-l'); // -> null
```

<!-- #endregion look-up -->

### Strict Input with `filtered`

A barcode scanner sends exactly the characters the barcode holds, so a till reading one can refuse anything the filter dropped:

<!-- #region strict-input -->

```ts @import.meta.vitest
type Verdict = 'accepted' | 'misread' | 'unexpected characters';

function readBarcode(scanned: string): Verdict {
  const { isValid, filtered } = Luhn.validate(scanned);
  if (!isValid) return 'misread';
  if (filtered > 0) return 'unexpected characters';
  return 'accepted';
}

readBarcode('order20260042l'); // -> 'accepted'
readBarcode('order-2026-0042-l'); // -> 'unexpected characters'
readBarcode('order20260043l'); // -> 'misread'
```

<!-- #endregion strict-input -->

## Custom Dictionaries

A dictionary is the alphabet `@evanion/luhn` reads a code against. `createLuhn` validates a dictionary once, at construction, and returns a frozen instance carrying `generate` and `validate` bound to it.

### The Default Dictionary

The default is 36 lowercase alphanumerics, with case folding on:

<!-- #region default-dictionary -->

```ts @import.meta.vitest
import { DEFAULT_DICTIONARY, Luhn } from '@evanion/luhn';

Luhn.dictionary; // -> '0123456789abcdefghijklmnopqrstuvwxyz'
Luhn.dictionary === DEFAULT_DICTIONARY; // -> true
Luhn.n; // -> 36
Luhn.caseInsensitive; // -> true
```

<!-- #endregion default-dictionary -->

The order of the dictionary decides which index each character occupies, and therefore every check character it produces. Two dictionaries with the same characters in a different order are different alphabets.

### Building Your Own with `createLuhn`

The shop's pickup codes draw on 32 characters: the 36 with `i`, `l`, `o` and `w` dropped, because they are confused when read or heard:

<!-- #region pickup-dictionary -->

```ts @import.meta.vitest
import { createLuhn } from '@evanion/luhn';

const pickup = createLuhn({ dictionary: '0123456789abcdefghjkmnpqrstuvxyz' });

pickup.generate('a4kp9mx'); // -> { phrase: 'a4kp9mx', checksum: 'a', filtered: 0 }
pickup.validate('a4kp-9mxa').isValid; // -> true
pickup.n; // -> 32
pickup.caseInsensitive; // -> false
```

<!-- #endregion pickup-dictionary -->

### Dictionary Constraints

`createLuhn` throws `InvalidDictionaryError`, carrying a `reason`, when a dictionary breaks one of five constraints:

| `reason`       | What the dictionary must be                                           |
| -------------- | --------------------------------------------------------------------- |
| `not-a-string` | a string                                                              |
| `too-short`    | at least 2 code points long                                           |
| `odd-length`   | an even number of code points long                                    |
| `duplicate`    | free of repeated code points                                          |
| `case-pairs`   | free of case variants of one letter, when `caseInsensitive` is `true` |

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

Everything is checked once, at construction, so an instance you hold cannot produce a code its own `validate` rejects.

### Unicode Dictionaries

Counting is by code point, so an astral dictionary, such as emoji or anything outside the Basic Multilingual Plane, is measured and indexed as you wrote it:

<!-- #region code-points -->

```ts @import.meta.vitest
const suits = createLuhn({ dictionary: '🂡🂱🃁🃑' });

suits.n; // -> 4
'🂡🂱🃁🃑'.length; // -> 8
```

<!-- #endregion code-points -->

### Caching Instances

A dictionary that varies at runtime needs an instance per dictionary. `createLuhn` validates the dictionary and builds a lookup table every time it is called, so cache the instance when the same few recur:

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

### Case Sensitivity

`caseInsensitive` folds input to lowercase before looking it up. It defaults to `true` when you supply no dictionary and `false` when you do. `ALTERNATING_CASE_DICTIONARY` holds 62 characters, `0-9` then `Aa Bb … Zz`, and an instance over it reads case:

<!-- #region case-sensitivity -->

```ts @import.meta.vitest
import { ALTERNATING_CASE_DICTIONARY, createLuhn } from '@evanion/luhn';

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

Folding over a dictionary that holds both `A` and `a` would leave the index of `A` unreachable, so `createLuhn` rejects it rather than quietly downgrading:

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

## Standards and Modulo Bias

### Mod-10: The Industry Standard

With `dictionary: '0123456789'`, `@evanion/luhn` is plain Luhn mod-10 and matches the published vectors:

<!-- #region mod-10 -->

```ts @import.meta.vitest
const digits = createLuhn({ dictionary: '0123456789' });

digits.generate('7992739871').checksum; // -> '3'
digits.validate('4539578763621486').isValid; // -> true
digits.validate('79927398710').isValid; // -> false
digits.generate('20260042').checksum; // -> '5'
```

<!-- #endregion mod-10 -->

Luhn's patent [US 2,950,048](https://patents.google.com/patent/US2950048A/en) defines mod-10, and ISO/IEC 7812-1 Annex B specifies it for issuer identification numbers, restated in 3GPP TS 23.003 Annex B.2 and in the [CMS NPI check-digit specification](https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand/Downloads/NPIcheckdigit.pdf).

### Mod-N: No Formal Standard

No RFC, ISO, ITU or ANSI document defines the generalisation to an arbitrary alphabet. The `floor(a / n) + (a % n)` formula everyone uses traces to [Wikipedia revision 74161899](https://en.wikipedia.org/w/index.php?title=Luhn_mod_N_algorithm&oldid=74161899), dated 2006-09-06 and unsourced. With any `n` other than 10, this library implements that common generalisation and claims nothing more.

### Modulo Bias

Drawing a random string over a dictionary with `byte % n` is uniform only when `n` divides 256. The default 36-character dictionary does not: `256 % 36` is 4, and the first four characters come up about 14% more often than the rest. `@evanion/luhn` does not generate random values, and `uniformOverBytes` reports whether an instance's dictionary is safe to draw from that way:

<!-- #region modulo-bias -->

```ts @import.meta.vitest
const pickup = createLuhn({ dictionary: '0123456789abcdefghjkmnpqrstuvxyz' });

Luhn.uniformOverBytes; // -> false
pickup.uniformOverBytes; // -> true
```

<!-- #endregion modulo-bias -->

`uniformOverBytes` says nothing about the quality of the bytes.

## Errors

- `LuhnError`: base class for everything this library throws.
- `InvalidDictionaryError extends LuhnError`: thrown by `createLuhn`; carries `reason`, `dictionary`, and `offending` (the repeated code points, or the case pairs).
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

Every instance is frozen, so an assignment to `Luhn.dictionary` throws a `TypeError` in an ES module:

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

## Migrating from 2.x

**Every check character changes.** The default dictionary went from 62 characters to 36, so a code 2.x produced validates under 3.x only by coincidence. `ALTERNATING_CASE_DICTIONARY` over lowercased input reproduces every check character the 2.x default produced:

<!-- #region legacy-default -->

```ts @import.meta.vitest
const legacy = createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY });

function checkCharacter2x(orderNumber: string): string {
  return legacy.generate(orderNumber.toLowerCase()).checksum;
}

function issuedBy2x(code: string): boolean {
  const orderNumber = code.slice(0, -1).toLowerCase();
  return legacy.validate(orderNumber + code.slice(-1)).isValid;
}

checkCharacter2x('order-2026-0042'); // -> 'E'
issuedBy2x('order-2026-0042-E'); // -> true
issuedBy2x('order-2026-0043-E'); // -> false
Luhn.validate('order-2026-0042-E').isValid; // -> false
```

<!-- #endregion legacy-default -->

[Migrating from 2.x](https://docs.evanion.com/luhn/migration) maps every 2.x call to its 3.x form.

## Beyond the Basics

The documentation site covers each topic above in depth, including:

- **Custom Dictionaries**: How to create a "confusable-free" alphabet to prevent reading errors.
- **Modulo Bias**: Understanding the impact of dictionary size on sampling uniformity.
- **Filtering**: How to handle separators (hyphens, spaces) without breaking the checksum.
- **Migrating from 2.x**: Every 2.x call mapped to its 3.x form, and how to keep validating codes 2.x issued.

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/luhn](https://docs.evanion.com/luhn)**

## License

MIT — see [LICENSE](LICENSE).
