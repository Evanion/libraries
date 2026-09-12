# luhn: the dictionary becomes a constructed value

Status: approved, not implemented
Package: `@evanion/luhn` (repo 2.0.1, npm 1.0.0 / 2.0.0 / 2.0.1; an unreleased
breaking packaging change is already staged, so nx computes 3.0.0 either way)
Closes: #85, #86, #87, #88, #89, #90, #91, #92, #94

## Decisions

1. Configuration moves to a construction step. `createLuhn({ dictionary })`
   validates the dictionary once and returns a frozen object carrying the
   precomputed lookup tables plus `generate` and `validate`.
2. The `Luhn` class is removed. `Luhn` becomes the default instance, so
   `Luhn.generate(x)` and `Luhn.validate(x)` still compile and still work.
   Subclassing and the mutable statics go.
3. `sensitive` is removed from both call signatures. Case handling becomes a
   construction option, `caseInsensitive`, which the constructor rejects when
   the dictionary contains case pairs.
4. The default dictionary returns to 1.0.0's 36 lowercase alphanumerics, which
   is the only shipped dictionary on which the documented case-insensitive
   default is sound.
5. Dictionary constraints — string, non-empty, even code-point count, no
   duplicate code points, no case pairs when folding — are all checked at
   construction. Nothing is validated at use.
6. The error base is renamed `LuhnError`. There is one `InvalidDictionaryError`
   carrying a `reason`, not one class per constraint.
7. `libs/urn` is not changed. Deferred on evidence, not symmetry — see below.
8. luhn does not generate random values and will not start. It exposes
   `uniformOverBytes` as data and documents the modulo-bias trap.

## The central decision: there has to be a construction step

#87 asks for the dictionary constraints to be enforced "at construction", the
way `calmh/luhn` and `andrew-d/luhn-rs` do. Today there is no construction. A
dictionary is a mutable static read on every call, so the only place to check it
is at use, which is the bug:

`libs/luhn/src/lib/luhn.ts:167-173` — `getN` runs per call, checks parity only,
and reports the derived dictionary rather than the one the caller set.

Three mechanisms were on the table.

**Static plus subclass, repaired.** Rejected. It cannot hold the invariants. A
static is assignable after the class body runs, so any precomputed table keyed
on it is stale by construction, which is why #91's memoization has to be written
as a cache keyed on the source string that re-derives when it changes. A static
is also a name match rather than a type match, which is the whole of #94:
`TokenLuhn.dictionary` was a function, `dictionary.length` was its arity `0`,
`getN` accepted `0 % 2 === 0`, and the failure surfaced four frames deeper as
`TypeError: dictionary.indexOf is not a function`. And #89 shows half the
surface is not overridable at all — the helpers are static arrow fields whose
`this` is bound to `Luhn` at class-body evaluation, so a subclass override of
`char2index`, `getN`, `filterValid`, `reduce` or `lowercaseOnly` is a silent
no-op.

**Per-call options only** (`generate(input, { dictionary, sensitive })`, #94's
proposal). Rejected as the sole mechanism. It fixes the type-match problem and
makes the alphabet visible at the call site, both of which this spec keeps. It
cannot fix the validation problem: a dictionary arriving per call has to be
validated per call, and the cost of getting it right — parity, uniqueness, case
pairs, an index map — is larger than the checksum it precedes. #91 measured the
fold alone at 3.1 µs against 1.8 µs for the whole rest of the operation.

**A factory returning a bound object.** Chosen. It is the only one of the three
with a moment at which the dictionary is known, checked, and turned into tables
that cannot then go stale.

The returned object carries exactly one piece of configuration, the dictionary,
because decision 3 folds `sensitive` into it. So the instance and the alphabet
are the same value, and there is no second layer:

```ts
export interface LuhnOptions {
  dictionary?: string;
  caseInsensitive?: boolean;
}

export interface Luhn {
  readonly dictionary: string;
  readonly n: number;
  readonly caseInsensitive: boolean;
  readonly uniformOverBytes: boolean;
  generate(input: string): GenerateResult;
  validate(input: string): ValidateResult;
}

export function createLuhn(options?: LuhnOptions): Luhn;

/** `createLuhn()`, frozen. */
export const Luhn: Luhn;

export const DEFAULT_DICTIONARY = '0123456789abcdefghijklmnopqrstuvwxyz';
export const ALTERNATING_CASE_DICTIONARY =
  '0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';
```

`Luhn` is frozen deliberately. The 1.x and 2.x configuration idiom was
`Luhn.dictionary = x` or an override in a subclass; against a frozen object in
an ES module — strict mode, always — the assignment throws a `TypeError`. A
deprecated static that silently did nothing would reproduce #89's failure mode
at the one moment a user is most likely to make the mistake.

What dissolves with the class, rather than being fixed:

- #89's subclass-override hazard. There are no overridable helpers and no
  `this`-dependent statics, so there is nothing to bind wrongly.
- #89's destructuring hazard. `const { generate } = Luhn` works, because
  `generate` closes over the instance's tables instead of reading `this`.
- #89's cross-alphabet validation (`TokenLuhn.generate` checked by
  `Luhn.validate`, 1951/2000 disagreements). `generate` and `validate` are
  methods on the same object; there is no second receiver to reach them
  through. This is also why `generate` does **not** need to return the
  dictionary it used, as that comment suggested — the caller is holding it.
- #91's memoization. The fold, the index map and `n` are computed once in
  `createLuhn`. There is no cache, so there is no cache key and no invalidation
  rule.

## What happens to `sensitive`

It is removed from `generate` and `validate`, and it is not replaced by a
per-call option.

The audit settles the semantics: case folding is compatible with Luhn mod-N
only when the dictionary contains no case pairs. With the shipped 62-character
dictionary and folding on, 36 of 62 code points are reachable while `n` stays
62 — indices 10, 12, … 60, every uppercase letter, are dead — and 8268/20000
round-trips fail. With a 36-character lowercase dictionary, folding is pure
input normalisation and 20000/20000 round-trips pass.

So folding is not a behaviour the caller may request; it is a behaviour a
dictionary either admits or does not. Call a dictionary **caseless** when no two
of its code points are case variants of one another:

```
caseless(d)  ⟺  new Set([...d].map((c) => c.toLowerCase())).size === [...d].length
```

`caseInsensitive: true` over a dictionary that is not caseless throws
`InvalidDictionaryError` with `reason: 'case-pairs'`, naming the pairs. It is
not silently downgraded, and folding is not silently enabled when a dictionary
happens to be caseless — the caller says what they want and the constructor says
whether the dictionary supports it.

`lowercaseOnly` is removed from the public surface. It was named for the wrong
role: it produced the case-folded alphabet used in case-_insensitive_ mode.
Under this design nothing folds the dictionary at all. The dictionary is used
verbatim and input is folded to match it, which is what normalisation means.

What breaks, plainly:

- `Luhn.generate(x, true)` and `Luhn.validate(x, true)` stop compiling. Per #86
  the second argument deleted every uppercase character from its input, so
  `generate('ABC', true)` returned `{ phrase: '', checksum: '0' }`; there is no
  working caller to preserve.
- `static sensitive = true` on a subclass stops existing. That path _was_
  correct (0/2000 failures), and it is exactly reproduced by
  `createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY })` — see the migration
  table.
- A custom dictionary with case pairs and folding on now throws at construction
  instead of returning wrong answers at use. The README's own custom-dictionary
  example, `README.md:117-120`, is such a dictionary.

## The default dictionary

Default becomes `DEFAULT_DICTIONARY`, 36 lowercase alphanumerics, with
`caseInsensitive: true`.

The documented contract has always been case-insensitive (`static sensitive =
false`, `README.md:65-69`). 2.0.0 introduced the 62-character alternating
dictionary, and that dictionary cannot satisfy the default it shipped under:
its alternating order is what places an uppercase letter at every even index
from 10 up, which is the mechanism behind #85's 842/2000 failures. Keeping 62
characters would mean making the default case-_sensitive_, changing the
documented contract to accommodate a dictionary chosen in 2.0.0 without one.

36 lowercase alphanumerics is also 1.0.0's default — `Luhn.dictionary()`
returned `'0123456789abcdefghij…'`, 36 characters — so the default returns to
where it was before the change that broke it.

Nothing is dropped from what `validate` accepts. Uppercase input still counts,
because folding maps it onto the dictionary rather than filtering it out.
`Luhn.validate('FOO…')` and `Luhn.validate('foo…')` agree, which is what
`README.md:106` promises and what 2.0.1 only appeared to deliver.

`ALTERNATING_CASE_DICTIONARY` stays exported so the 2.0.x case-sensitive
behaviour remains reachable by name.

## Dictionary validation

All of it in `createLuhn`, none of it at use.

| Constraint                       | Why                                                                                                                                                                                                                                          | `reason`       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `typeof dictionary === 'string'` | #94: a function override presented as an empty dictionary and failed as a `TypeError` from `indexOf` four frames deeper                                                                                                                      | `not-a-string` |
| at least 2 code points           | `n < 2` makes the fold meaningless and `n === 0` divides by zero; `0 % 2 === 0` passes today                                                                                                                                                 | `too-short`    |
| even code-point count            | mod-N needs even `n`, or the doubling step is not a bijection                                                                                                                                                                                | `odd-length`   |
| no duplicate code points         | the character↔index mapping must be a bijection. #87: `'aabbccdd'` passes parity, `indexOf` returns the first occurrence, the effective alphabet is 4 wide while `n` is 8, and `generate('abc')` produces a token its own `validate` rejects | `duplicate`    |
| caseless, when `caseInsensitive` | the audit's 8268/20000                                                                                                                                                                                                                       | `case-pairs`   |

Counting is by code point (`[...dictionary]`), not by UTF-16 unit. `split('')`
at `libs/luhn/src/lib/luhn.ts:34` and `:58` splits surrogate pairs, so an emoji
or astral dictionary is miscounted and mis-indexed today. The README invites
custom dictionaries, which is the reason to get this right.

The error reports the `reason`, the dictionary, and the offending code points —
for `duplicate` the repeated ones, for `case-pairs` the pairs. #87's second
complaint disappears with the cause: there is no derived dictionary any more, so
an error can never name a length the caller did not supply.

### Modulo bias

#87 measured `byte % dictionary.length` over 2,000,000 `crypto.randomBytes`
samples: the shipped 62-character dictionary over-represents its first 8
characters by 27.7%. `256 % 36 === 4`, so the new 36-character default is biased
too, by 15.2%.

luhn does not generate random values. It should not — a checksum library
shipping a CSPRNG sampler acquires a security surface for a problem that is not
its own. But it owns the dictionary, so it states the fact as data:

```ts
readonly uniformOverBytes: boolean;  // 256 % n === 0
```

That is the whole feature. No rejection-sampling helper in 3.0.0. The doc
comment must say what the flag does and does not mean: it reports that
`byte % n` is unbiased, and nothing about the quality of the bytes.

The README documents the trap next to the dictionary, says the default is not
uniform over bytes, and states that a dictionary whose length divides 256 —
32 is the useful size — is the one to pick if the caller intends to sample from
it. `@evanion/token` does sample, with `crypto.randomBytes` and a modulo
(`token.ts:37`) over a 32-character dictionary that happens to divide 256. It
will consume this constraint rather than rediscovering it.

## Errors

```ts
export class LuhnError extends Error {}

export type InvalidDictionaryReason =
  'not-a-string' | 'too-short' | 'odd-length' | 'duplicate' | 'case-pairs';

export class InvalidDictionaryError extends LuhnError {
  readonly reason: InvalidDictionaryReason;
  readonly dictionary: string;
  readonly offending: readonly string[];
}

export class EmptyInputError extends LuhnError {}
```

One dictionary error with a `reason`, not a class per constraint. Five classes
would make "the dictionary is unusable" a five-arm `catch`, and every caller
that only wants to know whether the dictionary is acceptable would have to
enumerate them.

#90's three defects go with the rewrite: `name` matches the class, the
user-facing message says "dictionary" rather than "directory" (twice, in the one
string a user reads), and the field is declared before it is assigned. The last
one is not cosmetic — under the monorepo's `tsconfig.base.json`, a
declared-but-uninitialised field compiles to a `defineProperty` that runs after
the constructor body and overwrites the assignment with `undefined`. Field
declarations come first.

### `ValidationError` is not unified with urn's — it is renamed

`libs/luhn` and `libs/urn` both export a `ValidationError`. They are unrelated
classes with one name, `instanceof` across them is false, and
`scripts/verify-packaging.mjs:96-98` already carries an alias and a comment
saying so.

Do not unify. A shared base means either a runtime dependency from luhn to urn —
a checksum library depending on a URN library, for an `instanceof` nothing
performs — or a third `@evanion/errors` package existing for one class. No code
in this repo or in `@evanion/token` catches a urn error from luhn or the
reverse.

The actual defect is two different things sharing a name. luhn's base becomes
`LuhnError`, the collision is gone, and the alias at
`scripts/verify-packaging.mjs:98` is deleted with it. `ValidationError` is also
dead weight in luhn today — exported, documented as the catch-all, thrown by
nothing.

## The input floor

#88: `validate('')`, `validate('!!!!')` and `validate('åäö0')` all return
`isValid: true`, because filtering leaves nothing, the sum is 0, and `!(0 % n)`
is `true`. The README sells `validate` as an input guard, and a guard that
accepts the empty string is the wrong default for the job.

- `validate` requires at least 2 surviving code points — a payload and a check
  character. Below that, `isValid: false`. It does not throw: answering "is this
  token valid" with an exception for one class of invalid token makes every
  caller wrap the guard in a `try`.
- `generate` requires at least 1 surviving code point and throws
  `EmptyInputError` otherwise. It has no boolean to answer with, and
  `{ phrase: '', checksum: '0' }` is a check character over no data — the value
  that makes `generate('ABC', true)`, `generate('XYZ', true)` and
  `generate('', true)` indistinguishable today.

Both results gain a filtered count, so a caller who wants strict input can gate
on it without reimplementing the filter. #88's related complaint is that
`validate('FoO-ö5')` and `validate('foo5')` return the same shape, so a clean
token and a mangled one are indistinguishable:

```ts
interface GenerateResult {
  phrase: string;
  checksum: string;
  filtered: number;
}
interface ValidateResult {
  phrase: string;
  isValid: boolean;
  filtered: number;
}
```

Silent filtering itself stays. It is deliberate, documented, and the reason
`foo-baz` and `fooö-baz` check the same.

## Fix order

The reviewer's recommended order — 86 → 94 → 87 → 89 → 91 → 92, with 88 and 90
free-floating — is the right order for six separate patches, and it is correct
that issue-number order rewrites the same code three times. Decision 1 makes
most of it moot: #85, #86, #87, #89, #91 and #94 are one rewrite, because each
one's suggested patch edits or caches code the rewrite deletes.

- #85 and #86 are the same dictionary-selection expression
  (`luhn.ts:50-52`, `:88-90`). The rewrite has no selection expression: there is
  one dictionary, fixed at construction, and the check character is drawn from
  the same table `validate` looks up in. That is the whole of #85.
- #87's index `Map` and #91's fold memoization are the same precomputation,
  performed once in `createLuhn`.
- #89's helpers stop being a public surface, so there is nothing to convert.
- #94's signature change is the construction step.

Implementation phases:

1. **Errors.** `LuhnError`, `InvalidDictionaryError` with `reason`,
   `EmptyInputError`. Everything else throws them, so they land first. (#90)
2. **`createLuhn`.** Validation, the index map, `n`, `uniformOverBytes`,
   `caseInsensitive`. (#87, #94, the dictionary half of #91)
3. **`generate` and `validate`** over the precomputed tables, code-point
   iteration, the input floor, the `filtered` count. (#85, #86, #88, #89, the
   remainder of #91)
4. **The default instance, frozen**, and the export surface.
5. **Docs.** Regenerate every worked example from executable assertions; rewrite
   the standards section. Last, because every number in it is an output of
   phases 2 and 3. (#92)

## Standards conformance, per the audit

The README must not claim conformance to a mod-N standard, because there is no
mod-N standard. Required content:

- Mod-10 is normative. Luhn's patent
  [US 2,950,048](https://patents.google.com/patent/US2950048A/en), ISO/IEC
  7812-1 Annex B, restated in 3GPP TS 23.003 Annex B.2 and the CMS NPI
  check-digit specification.
- Mod-N is not. The `floor(a/n) + (a % n)` formula traces to Wikipedia revision
  74161899, 2006-09-06, unsourced then and unsourced now. No RFC, ISO, ITU or
  ANSI defines it. Every implementation found — three npm packages, one Go, one
  Rust — states in a comment that it was transliterated from that page. Link it
  and say so.
- With `dictionary: '0123456789'` this library is mod-10 and matches the
  published vectors. With any other `n` it implements the common generalisation.
- The fold is Luhn's original formulation, not a generalisation of subtract-9.
  The patent says "twice the original digit plus an end around carry … the
  addition of any digit standing in the tens position to the digit standing in
  the units position". Subtract-9 is the decimal shortcut.
- The dictionary description is wrong today (`README.md:113`: "`0-9` plus `A-Z`
  and `a-z`" for a dictionary whose alternating `Aa Bb Cc` order is
  load-bearing and documented nowhere). State the new default and state that
  ordering determines the check character.
- Drop the claim that the `sensitive` static and the `sensitive` argument are
  equivalent (`README.md:71-86`). Both are gone; the claim was false while they
  existed.

The arithmetic itself is not touched. The audit found zero genuine
disagreements against five implementations in three languages over 120,000
inputs, and every published vector passes. Every bug in this cluster is in
dictionary handling around the arithmetic.

## Migration

| 2.0.1                                                                      | 3.0.0                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| every check character the library has ever emitted                         | changes — the default dictionary changes from 62 characters to 36, so every index changes   |
| `Luhn.generate(input)`                                                     | unchanged call, new value                                                                   |
| `Luhn.validate(input)`                                                     | unchanged call; 842/2000 of its own tokens stopped failing                                  |
| `Luhn.generate(input, true)`                                               | does not compile. `createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY }).generate(input)` |
| `Luhn.validate(input, true)`                                               | does not compile. Same replacement                                                          |
| `class X extends Luhn { static dictionary = d }`                           | `createLuhn({ dictionary: d, caseInsensitive: true })`                                      |
| `class X extends Luhn { static sensitive = true }`                         | `createLuhn({ dictionary: ALTERNATING_CASE_DICTIONARY })` — same alphabet, same values      |
| `Luhn.dictionary = d`                                                      | `TypeError`: the default instance is frozen                                                 |
| `Luhn.dictionary` (string, 62 chars)                                       | `Luhn.dictionary` (string, 36 chars)                                                        |
| `Luhn.sensitive` (boolean)                                                 | `Luhn.caseInsensitive` (boolean, `true`)                                                    |
| `Luhn.lowercaseOnly(d)`                                                    | removed; nothing folds a dictionary any more                                                |
| `protected static char2index / index2char / filterValid / reduce / getN`   | removed; they were never overridable (#89)                                                  |
| subclass override of any helper                                            | no replacement. Build a second instance                                                     |
| `const { generate } = Luhn` → `TypeError`                                  | works                                                                                       |
| `ValidationError`                                                          | `LuhnError`                                                                                 |
| `InvalidDictionaryError`, `name === 'InvalidError'`                        | `name === 'InvalidDictionaryError'`, plus `reason` and `offending`                          |
| message "Luhn directory is of invalid length"                              | "dictionary", and the reason it was rejected                                                |
| odd dictionary throws at first call                                        | throws at `createLuhn`                                                                      |
| duplicate characters accepted, tokens fail their own validator             | throws at `createLuhn`, `reason: 'duplicate'`                                               |
| non-string dictionary accepted, `TypeError` from `indexOf`                 | throws at `createLuhn`, `reason: 'not-a-string'`                                            |
| `caseInsensitive` over a dictionary with case pairs                        | throws at `createLuhn`, `reason: 'case-pairs'`                                              |
| `validate('')`, `validate('!!!!')` → `isValid: true`                       | `isValid: false`                                                                            |
| `generate('')` → `{ phrase: '', checksum: '0' }`                           | throws `EmptyInputError`                                                                    |
| `GenerateResult`, `ValidateResult`                                         | gain `filtered: number`                                                                     |
| `split('')` miscounts astral dictionaries                                  | code-point iteration throughout                                                             |
| `luhn.spec.ts:23-27`, `:39-43` assert the empty-string checksum `'0'`      | replaced, not adjusted — they pass today only because the input was deleted                 |
| `README.md:58-120`, `luhn.ts:44-47`, `:81-86` worked examples              | regenerated from executable assertions                                                      |
| `scripts/verify-packaging.mjs:98` `ValidationError as LuhnValidationError` | alias deleted                                                                               |

`@evanion/token` is the only known consumer and it throws on every call against
2.0.1 (`TypeError: dictionary.indexOf is not a function`, #94). It constrains
nothing. Nothing in this design is shaped around keeping it working, and it will
be rewritten against `createLuhn` rather than migrated.

## `libs/urn` is deferred, not changed

urn uses mutable-looking statics (`separator`, `urn`, `nid`) with documented
subclassing, and it shipped 2.0.0 with that surface. The same redesign is not
applied, here or in a companion spec.

Why urn's version of the pattern is not luhn's:

- urn's statics are `readonly` and exposed through `static get` accessors that
  read `this`, so overrides compose all the way down. That is the exact property
  luhn lacks (#89).
- They describe namespace identity, which a subclass genuinely is, not
  per-request data. luhn's dictionary is per-request data in its one real
  consumer — `@evanion/token` accepts a per-call `config.dictionary` and cannot
  get it through a class-lifetime static (#94).
- urn has no construction-time invariant to enforce. Its grammars validate
  per-call inputs, which is where validation belongs for them.
- No measured defect. luhn's cluster is nine issues with reproductions; urn's
  equivalent is zero.

The one point that does carry over: urn's read path (`parse`, `sameNamespace`,
`splitParts`) takes `separator` and `urn` from statics only, with no argument,
while its write path (`stringify:183`, `belongsToNamespace:270`) already takes
both as arguments with the static as the default. That asymmetry deserves a
separate issue, and it is an additive argument, not a redesign.

Revisit urn when `createLuhn` has shipped and there is evidence about how it
reads in use. Not before, and not because the two packages should look alike.

## Testing

- **Round-trip property.** For every instance in the matrix, ≥2000 random
  inputs, `validate(phrase + checksum).isValid === true`, zero failures. This is
  the test whose absence let #85 ship — `luhn.spec.ts:9` round-trips one input
  whose check character happens to be lowercase.
- **Matrix:** the default instance; `ALTERNATING_CASE_DICTIONARY`
  case-sensitive; `'0123456789'`; a dictionary containing astral code points.
- **Case folding.** On the default instance, mixed-case input yields the same
  result as the folded input, for ≥2000 random inputs.
- **Reachability.** Over random inputs, every index `0 … n-1` is produced as a
  check character. 36 of 62 reachable while `n` is 62 is the signature of the
  8268/20000 failure mode, and a reachability test catches it directly.
- **Constraint rejection**, one case per `reason`: `'abc'` (odd), `'aabbccdd'`
  (duplicate), `ALTERNATING_CASE_DICTIONARY` with `caseInsensitive: true`
  (case-pairs), `''` and `'ab'`… (too-short boundary: 0 rejected, 2 accepted),
  `(() => 'abcd') as unknown as string` (not-a-string). Assert `reason`,
  `dictionary` and `offending`, not just that something threw.
- **Mod-10 vectors**, from the audit's sources, with `dictionary:
'0123456789'`: `4539578763621486`, `79927398713`, `4111111111111111`,
  `5500005555555559`, `6011000990139424` valid; `79927398710` invalid;
  `generate('7992739871').checksum === '3'`.
- **Single-substitution detection** over random inputs: changing one code point
  to another in the dictionary is detected. Do not assert transposition
  coverage; mod-N does not catch all transpositions and the audit did not
  measure which.
- **Input floor:** `validate('')`, `validate('!!!!')`, `validate('!!!!0')`,
  `validate('åäö0')` all `isValid: false`; `generate('')` and `generate('!!!!')`
  throw `EmptyInputError`.
- **`filtered` count** matches the number of dropped code points, counted by
  code point.
- **Frozen default:** `Luhn.dictionary = 'x'` throws; `const { generate } =
Luhn; generate('foo')` works.
- **Every worked example in the README and the JSDoc is an executable
  assertion**, so an arithmetic change fails CI instead of silently
  invalidating the docs. #92's root cause is that 2.0.0 changed the arithmetic
  and left every documented number at its 1.x value.

## Deliberately not done

- **No rejection-sampling or token-generation helper.** #87 raises it; the
  modulo bias is real and the fix belongs where the randomness is. luhn exposes
  `uniformOverBytes` and documentation.
- **No deprecated statics.** They cannot be made to work against precomputed
  tables, and a static that is accepted and ignored is #89's failure mode
  reintroduced at the migration boundary. A frozen object throwing on
  assignment is the louder answer.
- **No per-call `dictionary` option alongside the factory.** It would reopen
  validate-at-use for the one argument whose validation is expensive. A caller
  with a per-request dictionary constructs a per-request instance; that is one
  pass over the dictionary, and it is the pass that would have happened anyway.
- **No `InvalidDictionaryError` subclass per constraint.** #87 proposes
  `DuplicateDictionaryCharacterError`. `reason` covers it without making
  "unusable dictionary" a multi-arm catch.
- **No `dictionary` field on `GenerateResult`.** Suggested in #89's comment to
  let a caller thread the alphabet from `generate` to `validate`. Unnecessary
  once both are methods on the same object.
- **No change to silent filtering.** Documented, deliberate, and the reason
  `foo-baz` and `fooö-baz` agree. Only its floor was missing.
- **No change to the arithmetic.** Audited correct.
- **No change to `libs/urn`.** See above.
