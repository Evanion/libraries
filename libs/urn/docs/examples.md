# @evanion/urn examples

The documentation site renders these blocks by region, and each one runs as a test of this package.

## The Solution: Uniform Resource Names (URNs)

### Core Concept: Namespace-Specific IDs

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

## Beyond the Basics

### Namespace Validation

<!-- #region namespace-class -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
GameURN.parse('urn:game:brass-birmingham'); // -> { urn: 'urn', nid: 'game', nss: 'brass-birmingham' }
```

<!-- #endregion namespace-class -->

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

<!-- #region same-namespace -->

```ts @import.meta.vitest
URN.sameNamespace('urn:game:azul', 'URN:Game:hive'); // -> true
URN.sameNamespace('urn:game:azul', 'urn:order:order-2026-0042'); // -> false
URN.sameNamespace('azul', 'azul'); // -> false
```

<!-- #endregion same-namespace -->

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

<!-- #region extract-id -->

```ts @import.meta.vitest
URN.parse('urn:game:azul').nss; // -> 'game:azul'
URN.parse('urn:game:azul').nid; // -> 'game'
URN.extractId('urn:game:azul'); // -> 'azul'
```

<!-- #endregion extract-id -->

### Validation and Errors

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

<!-- #region components -->

```ts @import.meta.vitest
class GameURN extends URN {
  static override readonly nid = 'game';
}
// ---cut---
GameURN.parse('urn:game:brass-birmingham?=edition=2018#setup'); // -> { urn: 'urn', nid: 'game', nss: 'brass-birmingham', fComponent: 'setup', qComponent: 'edition=2018' }
```

<!-- #endregion components -->

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

<!-- #region component-grammars -->

```ts @import.meta.vitest
URN.qComponentGrammar.test('edition=2018?print'); // -> true
URN.qComponentGrammar.test('?edition=2018'); // -> false
URN.rComponentGrammar.test(''); // -> false
URN.fComponentGrammar.test(''); // -> true
URN.parse('urn:game:azul#').fComponent; // -> ''
```

<!-- #endregion component-grammars -->

<!-- #region components-ignored -->

```ts @import.meta.vitest
const edition = 'urn:game:brass-birmingham?=edition=2018';
const setup = 'urn:game:brass-birmingham#setup';
URN.equals(edition, setup); // -> true
URN.extractId('urn:game:brass-birmingham?=edition=2018#setup'); // -> 'brass-birmingham'
```

<!-- #endregion components-ignored -->

### Percent-Encoding

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

<!-- #region equality -->

```ts @import.meta.vitest
URN.equals('URN:GAME:azul', 'urn:game:azul'); // -> true
URN.equals('urn:game:Brass%3a%20Birmingham', 'urn:game:Brass%3A%20Birmingham'); // -> true
URN.equals('urn:game:Brass%3A%20Birmingham', 'urn:game:Brass:%20Birmingham'); // -> false
URN.equals('urn:game:Azul', 'urn:game:azul'); // -> false
```

<!-- #endregion equality -->

### Custom Schemes and Separators

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

### Type-Safe Literals

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
