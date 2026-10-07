# @evanion/urn

**Eliminate identifier ambiguity with RFC 8141 Uniform Resource Names.**

Stop passing raw IDs like `123` or `abc-789` across your system and wondering, "Is this a product ID, a category ID, or a user ID?" `@evanion/urn` allows you to create self-describing identifiers that carry their own context, ensuring that your IDs are meaningful, unique, and valid across any service.

## The Problem: The "Ambiguous ID" Trap

In large systems, raw identifiers are a liability. When you see a string like `order-2026-0042`, you _assume_ it's an order, but your code has to _guess_ or rely on the variable name. This leads to:

- **Type Confusion**: Passing a `productId` into a function that expects a `categoryId`.
- **Collision Risks**: Two different entities in different databases sharing the same numeric ID.
- **Fragile Parsing**: Using `.split('-')` to guess what a string represents, which breaks the moment your ID format changes.

## The Solution: Uniform Resource Names (URNs)

A URN is a standardized way to identify a resource using a namespace. Instead of `order-2026-0042`, you use `urn:order:order-2026-0042`. Now, the ID itself tells you exactly what it is and where it comes from.

`@evanion/urn` provides a simple, JSON-inspired API to mint, parse, and validate these identifiers according to the RFC 8141 specification.

### Core Concept: Namespace-Specific IDs

The best way to use URNs is to create a class for each of your namespaces. The class supplies its NID to every call, and `stringify` refuses an identifier that breaks the URN grammar. Each `// ->` comment gives the value of the expression on its line:

<!-- #region basic-usage -->

```ts @import.meta.vitest
import { URN, InvalidError } from '@evanion/urn';

class GameURN extends URN {
  static override readonly nid = 'game';
}

const id = GameURN.stringify('brass-birmingham');
id; // -> 'urn:game:brass-birmingham'

let refused = '';
try {
  GameURN.stringify('brass birmingham');
} catch (error) {
  if (error instanceof InvalidError) refused = error.message;
}
refused; // -> "NSS contains invalid character ' ' in 'brass birmingham'"
```

<!-- #endregion basic-usage -->

The `override` keyword is required under TypeScript's `noImplicitOverride`, and optional without it.

## Key Features

- 📜 **RFC 8141 Grammars**: Under the default `:` separator, the NID, the NSS and the three optional components are checked against RFC 8141, and the scheme against RFC 3986, so a scheme other than `urn` parses.
- 🔍 **Safe Parsing**: Convert URN strings into structured components (`urn`, `nid`, `nss`) without guessing.
- ⚖️ **Case-Insensitive Equivalence**: Compare URNs correctly according to the spec (scheme and NID are case-insensitive).
- 🛠️ **Customizable**: Override the scheme, separator, or namespace to support non-standard internal identifiers.
- 🪶 **Zero Dependencies**: No runtime or peer dependencies, and the package ships its own types.

## Installation

```bash
npm install @evanion/urn
```

```bash
yarn add @evanion/urn
```

```bash
pnpm add @evanion/urn
```

The package needs Node 20 or newer and is ESM only. A CommonJS project loads it through `require()` on Node 20.19, 22.12 or newer.

## Beyond the Basics

URNs are more than just strings; they are a structural way to handle identity. The examples below run in this package's test suite, and the documentation site walks through each of them. From here on, a block that uses `GameURN` declares it again, in most blocks above a `// ---cut---` line, so it compiles on its own.

### Namespace Validation

`parse` hands back the three parts, and a class strips its own NID from the `nss`:

<!-- #region namespace-class -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
GameURN.parse('urn:game:brass-birmingham'); // -> { urn: 'urn', nid: 'game', nss: 'brass-birmingham' }
```

<!-- #endregion namespace-class -->

A class keeps a foreign NID in the `nss`, so an identifier from another namespace is never re-labelled as this one, and a foreign scheme keeps the whole identifier. Both comparisons ignore case, per RFC 8141 §3.1, and the parts come back in the case they were written in:

<!-- #region parse -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
GameURN.parse('urn:game:azul'); // -> { urn: 'urn', nid: 'game', nss: 'azul' }
GameURN.parse('URN:GAME:azul'); // -> { urn: 'URN', nid: 'GAME', nss: 'azul' }
GameURN.parse('urn:order:order-2026-0042'); // -> { urn: 'urn', nid: 'order', nss: 'order:order-2026-0042' }
GameURN.parse('baize:game:azul'); // -> { urn: 'baize', nid: 'game', nss: 'baize:game:azul' }
```

<!-- #endregion parse -->

`belongsToNamespace` picks one kind of URN out of a mixed list. It takes the NID as an argument even on a namespace class, and returns `false` for a string that is not a URN:

<!-- #region class-per-namespace -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
class OrderURN extends URN {
  static override readonly nid = 'order';
}

GameURN.stringify('spirit-island'); // -> 'urn:game:spirit-island'
OrderURN.stringify('order-2026-0042'); // -> 'urn:order:order-2026-0042'

const ids = ['urn:game:spirit-island', 'urn:order:order-2026-0042', 'hive'];
ids.filter((id) => GameURN.belongsToNamespace(id, 'game')); // -> ['urn:game:spirit-island']
```

<!-- #endregion class-per-namespace -->

`sameNamespace` compares the scheme and the NID of two URNs, ignoring case, and returns `false` for a string that is not a URN:

<!-- #region same-namespace -->

```ts @import.meta.vitest
URN.sameNamespace('urn:game:azul', 'URN:Game:hive'); // -> true
URN.sameNamespace('urn:game:azul', 'urn:order:order-2026-0042'); // -> false
URN.sameNamespace('azul', 'azul'); // -> false
```

<!-- #endregion same-namespace -->

`belongsToNamespace` defaults its scheme to the calling class's own, and takes another scheme as its third argument:

<!-- #region belongs-to-namespace -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
GameURN.belongsToNamespace('urn:game:azul', 'game'); // -> true
GameURN.belongsToNamespace('baize:game:azul', 'game'); // -> false
GameURN.belongsToNamespace('baize:game:azul', 'game', 'baize'); // -> true
```

<!-- #endregion belongs-to-namespace -->

The base `URN` class serves code whose namespaces are open-ended. Its `stringify` takes the NSS first, then the NID and the scheme, each defaulting to the class's own. The object form keys the parts by name and matches `parse`'s return shape:

<!-- #region stringify-forms -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
GameURN.stringify('azul'); // -> 'urn:game:azul'
URN.stringify('azul', 'game'); // -> 'urn:game:azul'
URN.stringify('azul', 'game', 'baize'); // -> 'baize:game:azul'
URN.stringify({ nss: 'azul', nid: 'game' }); // -> 'urn:game:azul'
GameURN.stringify(GameURN.parse('urn:game:azul')); // -> 'urn:game:azul'
```

<!-- #endregion stringify-forms -->

The base class's own NID is the placeholder `'nid'`, so `URN.parse(x).nss` keeps the NID of every real namespace. `extractId` always drops it:

<!-- #region extract-id -->

```ts @import.meta.vitest
URN.parse('urn:game:azul').nss; // -> 'game:azul'
URN.parse('urn:game:azul').nid; // -> 'game'
URN.extractId('urn:game:azul'); // -> 'azul'
```

<!-- #endregion extract-id -->

### Validation and Errors

Each part has its own grammar:

| Part            | Allowed                                                                                                                                   | Length                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| scheme (`urn`)  | a letter, then letters, digits, `+`, `-`, `.`                                                                                             | unbounded                  |
| NID             | letters and digits, plus `-` in the interior                                                                                              | 2–32 writing, 1–32 reading |
| NSS             | letters, digits, `-` `.` `_` `~` `!` `$` `&` `'` `(` `)` `*` `+` `,` `;` `=` `:` `@`, percent-triplets, and `/` after the first character | unbounded                  |
| r-, q-component | the NSS set plus `?` after the first character                                                                                            | unbounded                  |
| f-component     | the NSS set plus `?`, with no first-character rule                                                                                        | unbounded, may be empty    |

Every grammar accepts upper- and lower-case letters, and every part except the f-component must be non-empty. `parse` accepts a one-character NID that `stringify` refuses, because RFC 2141 permitted one and RFC 8141 keeps earlier-valid URNs valid:

<!-- #region grammars -->

```ts @import.meta.vitest
URN.schemeGrammar.test('baize'); // -> true
URN.nidGrammar.test('game'); // -> true
URN.nidGrammar.test('g'); // -> false
URN.isValidFormat('urn:g:azul'); // -> true
URN.nssGrammar.test('brass-birmingham'); // -> true
URN.nssGrammar.test('brass birmingham'); // -> false
```

<!-- #endregion grammars -->

`isValidFormat` calls `parse` and returns `false` where `parse` would throw, so it screens input before `parse` reads it. It checks the form, and a URN from another namespace passes:

<!-- #region screening -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
function urnOrNull(input: string) {
  return GameURN.isValidFormat(input) ? GameURN.parse(input) : null;
}

urnOrNull('urn:game:hive'); // -> { urn: 'urn', nid: 'game', nss: 'hive' }
urnOrNull('urn:game:spirit island'); // -> null
urnOrNull('hive'); // -> null
urnOrNull('urn:order:order-2026-0042'); // -> { urn: 'urn', nid: 'order', nss: 'order:order-2026-0042' }
```

<!-- #endregion screening -->

`ValidationError` is the base of both error classes the library exports. `parse` throws it for a string that is not a URN at all, and its subclass `InvalidError` for a part that breaks its grammar:

<!-- #region error-handling -->

```ts @import.meta.vitest
import { URN, InvalidError, ValidationError } from '@evanion/urn';

function problemWith(input: string): string {
  try {
    URN.parse(input);
    return 'none';
  } catch (error) {
    if (error instanceof InvalidError) return `bad ${error.property}`;
    if (error instanceof ValidationError) return 'not a URN';
    throw error;
  }
}

problemWith('urn:game:azul'); // -> 'none'
problemWith('urn:game:spirit island'); // -> 'bad NSS'
problemWith('azul'); // -> 'not a URN'
```

<!-- #endregion error-handling -->

An `InvalidError` names the part that failed, and either the first character at fault or the structural reason:

<!-- #region invalid-error -->

```ts @import.meta.vitest
import { URN, InvalidError } from '@evanion/urn';

function rejection(nss: string, nid: string): InvalidError | undefined {
  try {
    URN.stringify(nss, nid);
    return undefined;
  } catch (error) {
    if (error instanceof InvalidError) return error;
    throw error;
  }
}

const space = rejection('spirit island', 'game');
space?.property; // -> 'NSS'
space?.invalidChar; // -> ' '
space?.message; // -> "NSS contains invalid character ' ' in 'spirit island'"

const short = rejection('spirit-island', 'g');
short?.property; // -> 'NID'
short?.reason; // -> 'must be at least 2 characters long'
```

<!-- #endregion invalid-error -->

A job that mints many URNs catches per item, so one bad slug does not stop the rest:

<!-- #region batch-mint -->

```ts @import.meta.vitest
import { URN, InvalidError } from '@evanion/urn';

function mint(slugs: string[]): { minted: string[]; skipped: string[] } {
  const minted: string[] = [];
  const skipped: string[] = [];

  for (const slug of slugs) {
    try {
      minted.push(URN.stringify({ nss: slug, nid: 'game' }));
    } catch (error) {
      if (!(error instanceof InvalidError)) throw error;
      skipped.push(slug);
    }
  }

  return { minted, skipped };
}

mint(['azul', 'spirit island', 'wingspan']); // -> { minted: ['urn:game:azul', 'urn:game:wingspan'], skipped: ['spirit island'] }
```

<!-- #endregion batch-mint -->

### Component Parsing

RFC 8141 §2.3 allows three optional components after the NSS: the r-component (`?+`, parameters for the resolution service), the q-component (`?=`, parameters for the named resource) and the f-component (`#`, a secondary resource within the named one). `parse` returns each in its own field and never folds it into the `nss`:

<!-- #region components -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
GameURN.parse('urn:game:brass-birmingham?=edition=2018#setup'); // -> { urn: 'urn', nid: 'game', nss: 'brass-birmingham', fComponent: 'setup', qComponent: 'edition=2018' }
```

<!-- #endregion components -->

The component fields are absent, not `undefined`, when the URN carries none, so a URN with no components parses to exactly `{ urn, nid, nss }`:

<!-- #region components-type -->

```ts @import.meta.vitest
import type { URNComponents } from '@evanion/urn';

class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
function tail({ qComponent, fComponent }: URNComponents): string {
  return [qComponent, fComponent].filter(Boolean).join(' / ');
}

tail(GameURN.parse('urn:game:azul?=edition=2017#scoring')); // -> 'edition=2017 / scoring'
'qComponent' in GameURN.parse('urn:game:azul'); // -> false
```

<!-- #endregion components-type -->

Only the object form of `stringify` writes components. The wire order is always r, q, f, whatever order the keys were written in:

<!-- #region components-write -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
const rules = {
  nss: 'brass-birmingham',
  fComponent: 'setup',
  qComponent: 'edition=2018',
};
GameURN.stringify(rules); // -> 'urn:game:brass-birmingham?=edition=2018#setup'

const english = {
  nss: 'brass-birmingham',
  rComponent: 'lang=en',
  fComponent: '',
};
GameURN.stringify(english); // -> 'urn:game:brass-birmingham?+lang=en#'

const written = 'urn:game:brass-birmingham?=edition=2018#setup';
GameURN.stringify(GameURN.parse(written)) === written; // -> true
```

<!-- #endregion components-write -->

The r- and q-components need at least one character and take `?` anywhere but the first. The f-component may be empty:

<!-- #region component-grammars -->

```ts @import.meta.vitest
URN.qComponentGrammar.test('edition=2018?print'); // -> true
URN.qComponentGrammar.test('?edition=2018'); // -> false
URN.rComponentGrammar.test(''); // -> false
URN.fComponentGrammar.test(''); // -> true
URN.parse('urn:game:azul#').fComponent; // -> ''
```

<!-- #endregion component-grammars -->

RFC 8141 §3.1 excludes all three components from equivalence, so `equals` checks their grammar but does not compare them, and `extractId` drops them:

<!-- #region components-ignored -->

```ts @import.meta.vitest
const edition = 'urn:game:brass-birmingham?=edition=2018';
const setup = 'urn:game:brass-birmingham#setup';
URN.equals(edition, setup); // -> true
URN.extractId('urn:game:brass-birmingham?=edition=2018#setup'); // -> 'brass-birmingham'
```

<!-- #endregion components-ignored -->

### Percent-Encoding

`stringify` does not encode and `parse` does not decode. Both work on the wire form, so a value is never double-encoded by accident. `encodeNss` and `decodeNss` are the explicit step:

<!-- #region nss-encoding -->

```ts @import.meta.vitest
import { URN, encodeNss, decodeNss } from '@evanion/urn';

URN.isValidFormat('urn:game:Brass: Birmingham'); // -> false

const nss = encodeNss('Brass: Birmingham');
nss; // -> 'Brass%3A%20Birmingham'

const id = URN.stringify(nss, 'game');
id; // -> 'urn:game:Brass%3A%20Birmingham'
decodeNss(URN.extractId(id)); // -> 'Brass: Birmingham'
```

<!-- #endregion nss-encoding -->

`decodeNss` throws a `ValidationError` on a `%` that is not followed by two hex digits, or on triplets that are not UTF-8:

<!-- #region decode-nss -->

```ts @import.meta.vitest
import { decodeNss, ValidationError } from '@evanion/urn';

decodeNss('Brass%3A%20Birmingham'); // -> 'Brass: Birmingham'

let refused = '';
try {
  decodeNss('Brass%3');
} catch (error) {
  if (error instanceof ValidationError) refused = error.message;
}
refused; // -> "Malformed percent-encoding in 'Brass%3': '%' must be followed by two hex digits."
```

<!-- #endregion decode-nss -->

`encodeURIComponent` is a separate step. It makes a whole URN safe as one segment of a URL path, where `:` and `%` mean something to a router:

<!-- #region url-segment -->

```ts @import.meta.vitest
import { URN, encodeNss } from '@evanion/urn';

const id = URN.stringify(encodeNss('Brass: Birmingham'), 'game');
const path = `/games/${encodeURIComponent(id)}`;
path; // -> '/games/urn%3Agame%3ABrass%253A%2520Birmingham'

const received = decodeURIComponent(path.slice('/games/'.length));
URN.equals(received, id); // -> true
```

<!-- #endregion url-segment -->

`URN.equals` implements RFC 8141 §3.1. The scheme and the NID are compared ignoring case, and the NSS character for character, except that the hex digits of a percent-triplet compare ignoring case. A percent-encoded octet is never decoded for comparison:

<!-- #region equality -->

```ts @import.meta.vitest
URN.equals('URN:GAME:azul', 'urn:game:azul'); // -> true
URN.equals('urn:game:Brass%3a%20Birmingham', 'urn:game:Brass%3A%20Birmingham'); // -> true
URN.equals('urn:game:Brass%3A%20Birmingham', 'urn:game:Brass:%20Birmingham'); // -> false
URN.equals('urn:game:Azul', 'urn:game:azul'); // -> false
```

<!-- #endregion equality -->

### Custom Schemes and Separators

A subclass that overrides `separator` checks the scheme and the NID against a character class that excludes the separator, with no RFC length bounds. The NSS keeps the RFC grammar under every separator. Such a subclass is outside RFC 8141:

<!-- #region custom-separator -->

```ts @import.meta.vitest
class GameKey extends URN {
  static override readonly urn = 'baize';
  static override readonly nid = 'game';
  static override readonly separator = '.';
}

GameKey.stringify('azul'); // -> 'baize.game.azul'
GameKey.parse('baize.game.azul'); // -> { urn: 'baize', nid: 'game', nss: 'azul' }
GameKey.parse('baize.game.azul.2017').nss; // -> 'azul.2017'
URN.schemeGrammar.test('baize.shop'); // -> true
GameKey.schemeGrammar.test('baize.shop'); // -> false
```

<!-- #endregion custom-separator -->

A separator that contains `?` or `#` cannot be told apart from a component introducer, so it switches components off. On such a class, `parse` throws an `InvalidError` with `property: 'NSS'` for any `?` or `#` after the NID, and `stringify` throws one with `property: 'COMPONENT'` for any component.

### Type-Safe Literals

`ParsedURN` is what `parse` returns and `URNParts` is what the object form of `stringify` takes. A `ParsedURN` is assignable to `URNParts`, whose scheme and NID fall back to the class's own:

<!-- #region parsed-types -->

```ts @import.meta.vitest
import type { ParsedURN, URNParts } from '@evanion/urn';

class GameURN extends URN {
  static override readonly nid = 'game';
}

const parsed: ParsedURN = GameURN.parse('urn:game:azul#setup');
const scoring: URNParts = { ...parsed, fComponent: 'scoring' };
GameURN.stringify(scoring); // -> 'urn:game:azul#scoring'

const bare: URNParts = { nss: 'hive' };
GameURN.stringify(bare); // -> 'urn:game:hive'
```

<!-- #endregion parsed-types -->

`IFullURN` types a URN literal with the default `:` separator:

<!-- #region full-urn-type -->

```ts @import.meta.vitest
import type { IFullURN } from '@evanion/urn';

type GameId = IFullURN<'urn', 'game', string>;

const azul: GameId = 'urn:game:azul';
URN.extractId(azul); // -> 'azul'

// @ts-expect-error: an order URN is not a GameId
const order: GameId = 'urn:order:order-2026-0042';
URN.isValidFormat(order); // -> true
```

<!-- #endregion full-urn-type -->

## Important Caveats

`stringify` does not deduplicate and is not idempotent. Whatever you pass as the NSS is written verbatim after the scheme and the NID, which keeps a composite key from another system recoverable:

<!-- #region round-trip -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
GameURN.stringify('game:azul'); // -> 'urn:game:game:azul'
GameURN.parse('urn:game:game:azul').nss; // -> 'game:azul'
GameURN.stringify(GameURN.stringify('azul')); // -> 'urn:game:urn:game:azul'
```

<!-- #endregion round-trip -->

The statics are unbound. Every one of them reads `this`, so unlike `JSON.stringify` they cannot be destructured or passed as a bare callback. `stringify`, `parse` and `extractId` throw a `TypeError`, and `isValidFormat`, `equals` and `sameNamespace` catch it and return `false`. An arrow function keeps the class:

<!-- #region unbound -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
const catalogue = ['urn:game:azul', 'urn:game:hive'];
catalogue.map((id) => GameURN.extractId(id)); // -> ['azul', 'hive']

let failure = '';
try {
  catalogue.map(GameURN.extractId);
} catch (error) {
  failure = (error as Error).name;
}
failure; // -> 'TypeError'

catalogue.filter(GameURN.isValidFormat); // -> []
catalogue.filter((id) => GameURN.isValidFormat(id)); // -> ['urn:game:azul', 'urn:game:hive']
```

<!-- #endregion unbound -->

`belongsToNamespace` throws the `TypeError` only when its scheme argument is left out. `filter` and `map` pass a third argument, so under either it returns `false` for every URN.

The positional arguments to `stringify` are in the reverse order of `parse`'s return shape, so `stringify(...Object.values(parse(x)))` writes the scheme where the NSS belongs. Hand `stringify` the object: the keys carry the meaning, and only that form can write the r-, q- and f-components.

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/urn](https://docs.evanion.com/urn)**

## License

MIT
