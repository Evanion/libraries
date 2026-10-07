# @evanion/token examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## Check Characters Refuse a Typo Locally

<!-- #region at-a-glance -->

```ts @import.meta.vitest
import { createToken } from '@evanion/token';

const token = createToken();

// ✅ Valid: matches the check character
token.validate('a4kp-9mxa'); // -> { valid: true, body: 'a4kp9mx' }

// ❌ Invalid: rejected instantly due to a typo
token.validate('a4kp-9mx8'); // -> { valid: false, reason: 'check-failed' }
```

<!-- #endregion at-a-glance -->

## Creating a Token Instance

<!-- #region construct -->

```ts @import.meta.vitest
import { createToken } from '@evanion/token';

const token = createToken();

token.generate().value.length; // -> 9
```

<!-- #endregion construct -->

<!-- #region instances -->

```ts @import.meta.vitest
const giftCard = createToken({ length: 16, chunkSize: 4 });

giftCard.generate().value.length; // -> 19
giftCard.entropyBits; // -> 75
```

<!-- #endregion instances -->

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
refusal({ length: 12, chunkSize: 4 }); // -> undefined
refusal({ dictionary: '0123456789abcde-' })?.reason; // -> 'separator-in-dictionary'
refusal({ separator: 'a' })?.reason; // -> 'separator-in-dictionary'
refusal({ separator: 'a' })?.length; // -> 8
```

<!-- #endregion shape-errors -->

## Issuing and Redeeming Codes

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

<!-- #region round-trip -->

```ts @import.meta.vitest
const token = createToken();
const pickup = token.generate();

token.validate(pickup.value); // -> { valid: true, body: pickup.body }
token.validate('a4kp-9mx8'); // -> { valid: false, reason: 'check-failed' }
```

<!-- #endregion round-trip -->

<!-- #region checkout -->

```ts @import.meta.vitest
import { createToken } from '@evanion/token';

const token = createToken();

/** Stands in for the orders table, keyed on each pickup code's body. */
const orders = new Map<string, string>();

const { value, body } = token.generate();
orders.set(body, 'order-2026-0042');

function findOrder(readBack: string): string {
  const result = token.validate(readBack);
  if (!result.valid) return `refused: ${result.reason}`;
  return orders.get(result.body) ?? 'no such order';
}

findOrder(value); // -> 'order-2026-0042'
findOrder('a4kp-9mxa'); // -> 'no such order'
findOrder('a4kp-9nxa'); // -> 'refused: check-failed'
```

<!-- #endregion checkout -->

## Understanding Validation Results

<!-- #region validate -->

```ts @import.meta.vitest
const token = createToken();

token.validate('b0zg-7kqb'); // -> { valid: true, body: 'b0zg7kq' }
token.validate('b0zg-7kq8'); // -> { valid: false, reason: 'check-failed' }
token.validate('bozg-7kqb'); // -> { valid: false, reason: 'outside-alphabet' }
token.validate('b0zg-7kq'); // -> { valid: false, reason: 'wrong-length' }
```

<!-- #endregion validate -->

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

### What the Check Character Catches

<!-- #region check-catches -->

```ts @import.meta.vitest
const token = createToken();

token.validate('a4kp-9mza').valid; // -> false
token.validate('a4pk-9mxa').valid; // -> false
token.validate('b0zg-7kqb').valid; // -> true
token.validate('bz0g-7kqb').valid; // -> true
```

<!-- #endregion check-catches -->

## Flexible Input: Separators and Prefixes

<!-- #region separators -->

```ts @import.meta.vitest
const token = createToken();

token.validate('a4kp9mxa').valid; // -> true
token.validate('a4-kp-9m-xa').valid; // -> true
token.validate('A4KP-9MXA'); // -> { valid: true, body: 'a4kp9mx' }
```

<!-- #endregion separators -->

<!-- #region spoken -->

```ts @import.meta.vitest
const counterCode = createToken({ length: 6, chunkSize: 3, separator: ' ' });
const { value } = counterCode.generate();

value.length; // -> 7
value.charAt(3); // -> ' '
counterCode.validate(value).valid; // -> true
counterCode.validate(value.replace(' ', '-')).valid; // -> false
```

<!-- #endregion spoken -->

<!-- #region prefix -->

```ts @import.meta.vitest
const token = createToken();

const { value } = token.generate({ prefix: 'ORD' });

token.validate(value); // -> { valid: false, reason: 'outside-alphabet' }

/** Validates a pickup code read back with or without its `ORD` prefix. */
function validatePickupCode(readBack: string) {
  return token.validate(readBack.replace(/^ord-?/i, ''));
}

validatePickupCode(value).valid; // -> true
validatePickupCode(value.toLowerCase()).valid; // -> true
validatePickupCode(value.replaceAll('-', '')).valid; // -> true
```

<!-- #endregion prefix -->

## Entropy and Collisions

<!-- #region entropy -->

```ts @import.meta.vitest
const token = createToken();

token.entropyBits; // -> 35
createToken({ length: 12 }).entropyBits; // -> 55
createToken({ length: 13, chunkSize: 13 }).entropyBits; // -> 60
```

<!-- #endregion entropy -->

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

## Choosing an Alphabet

<!-- #region default-alphabet -->

```ts @import.meta.vitest
import { CONFUSABLE_CHARACTERS, DEFAULT_DICTIONARY } from '@evanion/token';

DEFAULT_DICTIONARY; // -> '0123456789abcdefghjkmnpqrstuvxyz'
DEFAULT_DICTIONARY.length; // -> 32
CONFUSABLE_CHARACTERS; // -> 'ilow'
```

<!-- #endregion default-alphabet -->

<!-- #region alphabet-errors -->

```ts @import.meta.vitest
import { InvalidAlphabetError, createToken } from '@evanion/token';

/** The alphabet error `createToken` throws for `dictionary`, if it throws one. */
function dictionaryRefusal(
  dictionary: string,
): InvalidAlphabetError | undefined {
  try {
    createToken({ dictionary });
  } catch (error) {
    if (error instanceof InvalidAlphabetError) return error;
    throw error;
  }
  return undefined;
}

const everything = '0123456789abcdefghijklmnopqrstuvwxyz';

dictionaryRefusal(everything)?.reason; // -> 'confusable'
dictionaryRefusal(everything)?.offending; // -> ['i', 'l', 'o', 'w']
dictionaryRefusal('0123456789abcdefghjkmnpqrstuvx')?.reason; // -> 'non-uniform'
dictionaryRefusal('0123456789ABCDEFGHJKMNPQRSTUVXYZ')?.reason; // -> 'unfolded'
dictionaryRefusal('0123456789abcdef'); // -> undefined
```

<!-- #endregion alphabet-errors -->

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

<!-- #region hex -->

```ts @import.meta.vitest
const hexCard = createToken({ dictionary: '0123456789abcdef', length: 16 });

hexCard.n; // -> 16
hexCard.entropyBits; // -> 60
hexCard.generate().value.length; // -> 19
```

<!-- #endregion hex -->
