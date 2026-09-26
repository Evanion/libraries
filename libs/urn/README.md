[![npm version](https://img.shields.io/npm/v/@evanion/urn)](https://www.npmjs.com/package/@evanion/urn)
[![npm downloads](https://img.shields.io/npm/dm/@evanion/urn)](https://www.npmjs.com/package/@evanion/urn)
[![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)](https://github.com/Evanion/libraries/actions/workflows/ci.yml)

# URN Library

A URN Library that makes it easier to work with more meaningful identifiers. The API is inspired by, and designed to be as simple as the JSON class.

Full documentation: [docs.evanion.com/urn](https://docs.evanion.com/urn).

## What is a URN?

URN stands for `Universal Resource Name` and is part of the URI spec in [RFC8141](https://datatracker.ietf.org/doc/html/rfc8141). You might have seen it in use at some major companies like AWS (strings that start with `ARN:...`). It's used to identify resources with a more descriptive string, than just a plain identifier, by also adding a namespace and schema.

## Why should you use a URN?

How many times have you seen a random DocumentID being thrown around in a conversation, and you wonder what type of DocumentID it is? Is it a `product` or `productCategory` ID?  
A URN will help, by always include information about the namespace that the ID is referring to.

## Installation

```bash
npm install @evanion/urn
```

Or with yarn:

```bash
yarn add @evanion/urn
```

Or with pnpm:

```bash
pnpm add @evanion/urn
```

## Quick Start

A subclass per namespace is the extension point. Override `nid` and every
inherited method reads it: `stringify` needs only the identifier, and `parse`
hands back the three parts.

<!-- #region basic-usage -->

```ts @import.meta.vitest
import { URN } from '@evanion/urn';

class GameURN extends URN {
  static override readonly nid = 'game';
}

const id = GameURN.stringify('brass-birmingham');
id; // -> 'urn:game:brass-birmingham'
GameURN.parse(id); // -> { urn: 'urn', nid: 'game', nss: 'brass-birmingham' }
```

<!-- #endregion basic-usage -->

## Features

- **A `JSON`-shaped API**: `parse` and `stringify`, and the subclass is the
  only place a scheme or a namespace is named
- **Custom schemes and namespaces**: extend the base class, override the
  statics, and every inherited method reads the new values
- **RFC 8141 grammar**: a role-scoped grammar for the scheme, the NID and the
  NSS, rather than one flat character class
- **Case-folded comparison**: `sameNamespace`, `belongsToNamespace` and
  `equals` fold the scheme and the NID, per RFC 8141 §3.1
- **r-, q- and f-components**: the optional `?+`, `?=` and `#` tails of
  RFC 8141 §2.3, parsed into their own fields and excluded from equivalence

## A class per namespace

A class strips its own namespace on `parse` and keeps a foreign one in the
`nss`, so an identifier read from another namespace cannot be re-labelled as
this one:

<!-- #region namespace-class -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}

GameURN.parse('urn:game:brass-birmingham'); // -> { urn: 'urn', nid: 'game', nss: 'brass-birmingham' }
GameURN.parse('urn:order:order-2026-0042'); // -> { urn: 'urn', nid: 'order', nss: 'order:order-2026-0042' }
```

<!-- #endregion namespace-class -->

A foreign scheme keeps the whole identifier. The comparisons are case-folded,
per RFC 8141 §3.1, and the parts come back in the case they were written in:

<!-- #region parse -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}

GameURN.parse('urn:game:azul'); // -> { urn: 'urn', nid: 'game', nss: 'azul' }
GameURN.parse('URN:GAME:azul'); // -> { urn: 'URN', nid: 'GAME', nss: 'azul' }
GameURN.parse('urn:order:order-2026-0042'); // -> { urn: 'urn', nid: 'order', nss: 'order:order-2026-0042' }
GameURN.parse('baize:game:azul'); // -> { urn: 'baize', nid: 'game', nss: 'baize:game:azul' }
```

<!-- #endregion parse -->

One subclass per namespace means no call site names a namespace. A message that
mixes them is sorted with `belongsToNamespace`, which returns `false` for
malformed input:

<!-- #region class-per-namespace -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}

class OrderURN extends URN {
  static override readonly nid = 'order';
}

GameURN.stringify('spirit-island'); // -> 'urn:game:spirit-island'
OrderURN.stringify('order-2026-0042'); // -> 'urn:order:order-2026-0042'

const ids = ['urn:game:spirit-island', 'urn:order:order-2026-0042', 'hive'];
ids.filter((id) => GameURN.belongsToNamespace(id, 'game')); // -> ['urn:game:spirit-island']
```

<!-- #endregion class-per-namespace -->

`sameNamespace` compares the scheme and the NID of two URNs, case-folded:

<!-- #region same-namespace -->

```ts @import.meta.vitest
URN.sameNamespace('urn:game:azul', 'URN:Game:hive'); // -> true
URN.sameNamespace('urn:game:azul', 'urn:order:order-2026-0042'); // -> false
URN.sameNamespace('azul', 'azul'); // -> false
```

<!-- #endregion same-namespace -->

`belongsToNamespace` defaults its scheme to the calling class's own:

<!-- #region belongs-to-namespace -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}

GameURN.belongsToNamespace('urn:game:azul', 'game'); // -> true
GameURN.belongsToNamespace('baize:game:azul', 'game'); // -> false
GameURN.belongsToNamespace('baize:game:azul', 'game', 'baize'); // -> true
```

<!-- #endregion belongs-to-namespace -->

### One class, the NID per call

`stringify` takes the NSS first, then the NID and the scheme, each defaulting to
the class's own. The object form keys the parts by name and matches `parse`'s
return shape:

<!-- #region stringify-forms -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}

GameURN.stringify('azul'); // -> 'urn:game:azul'
URN.stringify('azul', 'game'); // -> 'urn:game:azul'
URN.stringify('azul', 'game', 'baize'); // -> 'baize:game:azul'
URN.stringify({ nss: 'azul', nid: 'game' }); // -> 'urn:game:azul'
GameURN.stringify(GameURN.parse('urn:game:azul')); // -> 'urn:game:azul'
```

<!-- #endregion stringify-forms -->

`parse(x).nss` keeps a foreign NID; `extractId` always drops it. The base
class's NID is `nid`, so `game` is foreign to it:

<!-- #region extract-id -->

```ts @import.meta.vitest
URN.parse('urn:game:azul').nss; // -> 'game:azul'
URN.parse('urn:game:azul').nid; // -> 'game'
URN.extractId('urn:game:azul'); // -> 'azul'
```

<!-- #endregion extract-id -->

## Validation and error handling

The library validates the scheme, the NID **and** the NSS, each against its
own grammar. There is no single character class: the three roles are different
in the RFC and are different here.

| Role            | Allowed                                                                                                                                   | Length                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| scheme (`urn`)  | a letter, then letters, digits, `+`, `-`, `.`                                                                                             | unbounded                  |
| NID             | letters and digits, plus `-` in the interior                                                                                              | 2–32 writing, 1–32 reading |
| NSS             | letters, digits, `-` `.` `_` `~` `!` `$` `&` `'` `(` `)` `*` `+` `,` `;` `=` `:` `@`, percent-triplets, and `/` after the first character | unbounded                  |
| r-, q-component | the NSS set plus `?` after the first character                                                                                            | unbounded                  |
| f-component     | the NSS set plus `?`, with no first-character rule                                                                                        | unbounded, may be empty    |

Letters are case-insensitive everywhere. Every part must be non-empty, except
the f-component. The grammars are readable off the class, and `parse` accepts a
one-character NID that `stringify` refuses, because RFC 2141 permitted one and
RFC 8141 keeps earlier-valid URNs valid:

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

`isValidFormat` delegates to `parse` and never throws, so it screens input
before `parse` commits to it:

<!-- #region screening -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}

function gameOrNull(input: string) {
  return GameURN.isValidFormat(input) ? GameURN.parse(input) : null;
}

gameOrNull('urn:game:hive'); // -> { urn: 'urn', nid: 'game', nss: 'hive' }
gameOrNull('urn:game:spirit island'); // -> null
gameOrNull('hive'); // -> null
```

<!-- #endregion screening -->

`ValidationError` is the base of everything the library throws, and
`InvalidError` extends it for a part that breaks its grammar. `parse` throws the
base for a string that is not a URN at all:

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

An `InvalidError` names the part that failed, and either the first character at
fault or the structural reason:

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

A job that mints many URNs catches per item, so one bad slug does not stop the
rest:

<!-- #region batch-mint -->

```ts @import.meta.vitest
import { URN, InvalidError } from '@evanion/urn';

function mint(slugs: string[]): { minted: string[]; skipped: string[] } {
  const minted: string[] = [];
  const skipped: string[] = [];

  for (const slug of slugs) {
    try {
      minted.push(URN.stringify(slug, 'game'));
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

### Percent-encoding

`stringify` does not encode and `parse` does not decode. Both work on the wire
form, so a value can never be double-encoded by accident. `encodeNss` and
`decodeNss` are the explicit step:

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

`decodeNss` throws a `ValidationError` on a `%` that is not followed by two hex
digits, or on triplets that are not UTF-8:

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

`encodeURIComponent` is a different step. It makes a whole URN safe as one
segment of a URL path, where `:` and `%` mean something to a router:

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

### Equivalence

`URN.equals` implements RFC 8141 §3.1: the scheme and the NID are compared
case-insensitively, the NSS character for character, except that the hex digits
of a percent-triplet canonicalise to uppercase. A percent-encoded octet is never
decoded for comparison:

<!-- #region equality -->

```ts @import.meta.vitest
URN.equals('URN:GAME:azul', 'urn:game:azul'); // -> true
URN.equals('urn:game:Brass%3a%20Birmingham', 'urn:game:Brass%3A%20Birmingham'); // -> true
URN.equals('urn:game:Brass%3A%20Birmingham', 'urn:game:Brass:%20Birmingham'); // -> false
URN.equals('urn:game:Azul', 'urn:game:azul'); // -> false
```

<!-- #endregion equality -->

## r-, q- and f-components

RFC 8141 §2.3 allows three optional components after the NSS: the r-component
(`?+`, parameters for the resolution service), the q-component (`?=`,
parameters for the named resource) and the f-component (`#`, a secondary
resource within the named one). `parse` returns each in its own field and never
folds it into the `nss`:

<!-- #region components -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}

GameURN.parse('urn:game:brass-birmingham?=edition=2018#setup'); // -> { urn: 'urn', nid: 'game', nss: 'brass-birmingham', fComponent: 'setup', qComponent: 'edition=2018' }
```

<!-- #endregion components -->

The fields are optional and absent, not `undefined`, when the URN carries no
components, so a consumer reading `{ urn, nid, nss }` sees exactly the shape it
saw before:

<!-- #region components-type -->

```ts @import.meta.vitest
import type { URNComponents } from '@evanion/urn';

class GameURN extends URN {
  static override readonly nid = 'game';
}

function tail({ qComponent, fComponent }: URNComponents): string {
  return [qComponent, fComponent].filter(Boolean).join(' / ');
}

tail(GameURN.parse('urn:game:azul?=edition=2017#scoring')); // -> 'edition=2017 / scoring'
'qComponent' in GameURN.parse('urn:game:azul'); // -> false
```

<!-- #endregion components-type -->

Write them with the object form of `stringify`. The wire order is always r, q,
f, whatever order the keys were written in:

<!-- #region components-write -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}

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

The splitting needs no change to the NSS grammar: `pchar` contains neither `?`
nor `#`. The f-component comes off first, because `#` terminates the r- and
q-components while both of those may themselves contain a bare `?`; then the
first `?` of what remains introduces the r-component (`?+`) or the q-component
(`?=`), and an r-component runs to the first following `?=`.

The r- and q-components take the NSS set plus `?` after the first character. The
f-component has no first-character rule and may be empty:

<!-- #region component-grammars -->

```ts @import.meta.vitest
URN.qComponentGrammar.test('edition=2018?print'); // -> true
URN.qComponentGrammar.test('?edition=2018'); // -> false
URN.rComponentGrammar.test(''); // -> false
URN.fComponentGrammar.test(''); // -> true
URN.parse('urn:game:azul#').fComponent; // -> ''
```

<!-- #endregion component-grammars -->

RFC 8141 §3.1 excludes all three from equivalence, so `equals` ignores them,
and `extractId` drops them:

<!-- #region components-ignored -->

```ts @import.meta.vitest
const edition = 'urn:game:brass-birmingham?=edition=2018';
const setup = 'urn:game:brass-birmingham#setup';
URN.equals(edition, setup); // -> true
URN.extractId('urn:game:brass-birmingham?=edition=2018#setup'); // -> 'brass-birmingham'
```

<!-- #endregion components-ignored -->

A subclass whose `separator` contains `?` or `#` cannot tell a separator from a
component delimiter. There, the whole tail stays in the NSS and writing a
component throws.

### Custom separators are not RFC 8141

A subclass that overrides `separator` gets a generic character class with the
separator excluded, for the scheme and the NID, and no RFC length bounds. The
NSS keeps the RFC grammar under every separator. Such a subclass is **not**
claimed to be RFC 8141 conformant.

<!-- #region custom-separator -->

```ts @import.meta.vitest
class GameKey extends URN {
  static override readonly urn = 'baize';
  static override readonly nid = 'game';
  static override readonly separator = '.';
}

GameKey.stringify('azul'); // -> 'baize.game.azul'
GameKey.parse('baize.game.azul'); // -> { urn: 'baize', nid: 'game', nss: 'azul' }
URN.schemeGrammar.test('baize.shop'); // -> true
GameKey.schemeGrammar.test('baize.shop'); // -> false
```

<!-- #endregion custom-separator -->

## Types

`ParsedURN` is what `parse` returns and `URNParts` is what the object form of
`stringify` takes. A `ParsedURN` is assignable to `URNParts`, whose scheme and
NID fall back to the class's own:

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

`stringify` does not deduplicate and is not idempotent. Whatever you pass as the
NSS is emitted verbatim after the scheme and the NID, which keeps a composite
key imported from another system recoverable:

<!-- #region round-trip -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}

GameURN.stringify('game:azul'); // -> 'urn:game:game:azul'
GameURN.parse('urn:game:game:azul').nss; // -> 'game:azul'
GameURN.stringify(GameURN.stringify('azul')); // -> 'urn:game:urn:game:azul'
```

<!-- #endregion round-trip -->

The statics are unbound. Every one of them reads `this`, so unlike
`JSON.stringify` they cannot be destructured or passed as a bare callback:

<!-- #region unbound -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}

const ids = ['urn:game:azul', 'urn:game:hive'];
ids.map((id) => GameURN.extractId(id)); // -> ['azul', 'hive']

let failure = '';
try {
  ids.map(GameURN.extractId);
} catch (error) {
  failure = (error as Error).name;
}
failure; // -> 'TypeError'
```

<!-- #endregion unbound -->

The positional arguments to `stringify` are in the reverse order of `parse`'s
return shape, so `stringify(...Object.values(parse(x)))` writes the scheme where
the NSS belongs. Hand `stringify` the object: the keys carry the meaning, and
only that form can express the r-, q- and f-components.

## API Reference

### Static Methods

- `URN.stringify(parts)`: creates a URN string from
  `{ nss, nid?, urn?, rComponent?, qComponent?, fComponent? }`. The object form
  is the one that can emit components, and its keys match `parse`'s return
  shape.
- `URN.stringify(nss, nid?, urn?)`: the positional form. Same validation, no
  components, and its arguments are in the reverse order of `parse`'s return
  shape. Both throw `InvalidError` if a part is empty or contains a disallowed
  character.
- `URN.parse(urnString)`: parses a URN string into `{ urn, nid, nss }`, plus
  `rComponent`, `qComponent` and `fComponent` when the URN carries them.
  Throws `ValidationError` if the string is not a well-formed URN.
- `URN.isValidFormat(urnString)`: `true` if the string parses. Delegates to
  `parse`, so the two can never disagree. Never throws.
- `URN.extractId(urnString)`: returns everything after the scheme and the NID,
  without any r-, q- or f-component. Throws `ValidationError` on malformed
  input.
- `URN.sameNamespace(a, b)`: `true` if both URNs share a scheme and NID.
  Returns `false` for malformed input.
- `URN.belongsToNamespace(urnString, nid, urn?)`: `true` if the URN is in the
  given namespace, comparing case-insensitively. `urn` defaults to the calling
  class's own scheme.
- `URN.equals(a, b)`: RFC 8141 §3.1 equivalence. Returns `false` for malformed
  input.

### Functions

- `encodeNss(raw)`: percent-encodes everything outside RFC 3986's `unreserved`
  set, producing a valid NSS.
- `decodeNss(encoded)`: the inverse. Throws `ValidationError` on a malformed or
  truncated percent sequence.

### Errors

- `ValidationError`: base class for everything this library throws.
- `InvalidError extends ValidationError`: a part was empty, contained a
  disallowed character, or broke a structural rule of its grammar. Carries
  `property` (`'URN'`, `'NID'`, `'NSS'`, or a component name), `value`,
  `invalidChar` when a single character is at fault, and `reason` when none is.

### Class Properties

- `static urn: string`: the URN scheme (default: `'urn'`)
- `static separator: string`: the separator between the parts (default: `':'`)
- `static nid: string`: the namespace identifier (default: `'nid'`)
- `static schemeGrammar: RegExp`: the grammar the scheme must match
- `static nidGrammar: RegExp`: the grammar the NID must match when writing
- `static nssGrammar: RegExp`: the grammar the NSS must match
- `static rComponentGrammar: RegExp`: the grammar the r-component must match
- `static qComponentGrammar: RegExp`: the grammar the q-component must match
- `static fComponentGrammar: RegExp`: the grammar the f-component must match,
  the only one that accepts the empty string

When overriding these in a subclass, TypeScript's `noImplicitOverride` requires
the `override` keyword.

## Documentation

Guides, worked examples and the full API reference:
[docs.evanion.com/urn](https://docs.evanion.com/urn).

## Contributing

Contributions are welcome! See
[Contributing](https://github.com/Evanion/libraries/blob/main/CONTRIBUTING.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
