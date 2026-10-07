# @evanion/luhn examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## A Check Character Refuses the Typo

### Issue and Check an Order Code

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

### What a Check Character Catches

<!-- #region catches -->

```ts @import.meta.vitest
import { Luhn } from '@evanion/luhn';

Luhn.validate('order-2026-0042-l').isValid; // -> true
Luhn.validate('order-2026-0043-l').isValid; // -> false
Luhn.validate('order-2026-0024-l').isValid; // -> false
```

<!-- #endregion catches -->

## Generating and Validating

### What `generate` Returns

<!-- #region generate -->

```ts @import.meta.vitest
Luhn.generate('order-2026-0042'); // -> { phrase: 'order20260042', checksum: 'l', filtered: 2 }
Luhn.generate('ORDER 2026/0042'); // -> { phrase: 'order20260042', checksum: 'l', filtered: 2 }
```

<!-- #endregion generate -->

### Handling Empty Input

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

<!-- #region validate -->

```ts @import.meta.vitest
Luhn.validate('order-2026-0042-l'); // -> { phrase: 'order20260042l', isValid: true, filtered: 3 }
Luhn.validate('ORDER20260042L'); // -> { phrase: 'order20260042l', isValid: true, filtered: 0 }
Luhn.validate('order-2026-0043-l'); // -> { phrase: 'order20260043l', isValid: false, filtered: 3 }
Luhn.validate('l'); // -> { phrase: 'l', isValid: false, filtered: 0 }
Luhn.validate('--'); // -> { phrase: '', isValid: false, filtered: 2 }
```

<!-- #endregion validate -->

### Mapping a Code Back to an Order

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

### The Default Dictionary

<!-- #region default-dictionary -->

```ts @import.meta.vitest
import { DEFAULT_DICTIONARY, Luhn } from '@evanion/luhn';

Luhn.dictionary; // -> '0123456789abcdefghijklmnopqrstuvwxyz'
Luhn.dictionary === DEFAULT_DICTIONARY; // -> true
Luhn.n; // -> 36
Luhn.caseInsensitive; // -> true
```

<!-- #endregion default-dictionary -->

### Building Your Own with `createLuhn`

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

### Unicode Dictionaries

<!-- #region code-points -->

```ts @import.meta.vitest
const suits = createLuhn({ dictionary: '🂡🂱🃁🃑' });

suits.n; // -> 4
'🂡🂱🃁🃑'.length; // -> 8
```

<!-- #endregion code-points -->

### Caching Instances

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

<!-- #region case-sensitivity -->

```ts @import.meta.vitest
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

### Mod-10 and Its Standards

<!-- #region mod-10 -->

```ts @import.meta.vitest
const digits = createLuhn({ dictionary: '0123456789' });

digits.generate('7992739871').checksum; // -> '3'
digits.validate('4539578763621486').isValid; // -> true
digits.validate('79927398710').isValid; // -> false
digits.generate('20260042').checksum; // -> '5'
```

<!-- #endregion mod-10 -->

### Modulo Bias

<!-- #region modulo-bias -->

```ts @import.meta.vitest
Luhn.uniformOverBytes; // -> false
pickup.uniformOverBytes; // -> true
```

<!-- #endregion modulo-bias -->

## Errors

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
