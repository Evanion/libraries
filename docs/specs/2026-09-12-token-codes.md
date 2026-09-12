# @evanion/token: human-shareable codes

Status: approved, not implemented
Depends on: `@evanion/luhn` 3.0.0 (PR #104)
Prior art: `apps/recipes/src/utils/token/` in Evanion/tillagat, commit `cf3c937` (2022), not carried forward

## Why

Verification codes, referral codes, order references — values a person reads
aloud, types from a card, or dictates over a phone. Two properties matter:

- The alphabet excludes characters that are confused when read or heard.
- A code can be rejected as malformed **before** an expensive operation. That
  is the point of the check character: a database lookup for a code that was
  mistyped is a lookup that never needed to happen.

The second is why this is a package rather than three lines of
`crypto.randomBytes`.

## Why not the 2022 original

It does not run. Measured against `@evanion/luhn@2.0.1`:

```
TokenLuhn.generate('abc123x')
  TypeError: dictionary.indexOf is not a function
```

`luhn@1.0.0` exposed `dictionary` as a static method; `2.0.0` made it a string
property. The original injected its alphabet by subclassing and overriding that
static with a method, so the override became a type mismatch and every call
threw. It went unnoticed for sixteen months because the only consumer was
pinned inside one app.

Two further defects in the same file: `validate` called `Luhn.validate` on the
base class rather than the subclass, so it checked against luhn's 62-character
default while `generate` used the 32-character token alphabet — 1951 of 2000
tokens rejected. And the prefix was folded into the checksum after being
filtered against the dictionary, so a prefix containing a character outside the
alphabet was silently truncated before folding.

None of it carries over. The idea does.

## Decisions

1. Every token carries a check character. Not optional — its absence removes
   the reason to use this package.
2. `@evanion/luhn` is a dependency, not a peer.
3. The prefix is optional and sits **outside** the checksummed body.
4. Chunking and the separator are configurable; both serve readability.
5. The alphabet is fixed by default and validated when supplied.

## Shape

```ts
const token = createToken();                       // defaults
token.generate()
// { value: 'a4kp-9mx7', body: 'a4kp9mx', check: '7', prefix: undefined }

token.generate({ prefix: 'ORD' })
// { value: 'ORD-a4kp-9mx7', body: 'a4kp9mx', check: '7', prefix: 'ORD' }

token.validate('a4kp-9mx7')       // { valid: true,  body: 'a4kp9mx' }
token.validate('a4kp-9mx8')       // { valid: false, reason: 'check-failed' }
token.validate('a4kp-9mxo')       // { valid: false, reason: 'outside-alphabet' }
```

`createToken({ length, chunkSize, separator, dictionary })`, validated once,
frozen, mirroring `createLuhn`.

## The alphabet

Default: `0123456789abcdefghjkmnpqrstuvxyz` — 32 characters, lowercase, with
`i`, `l`, `o` and `w` removed.

It has to satisfy three independent constraints at once, and it does:

| Constraint | Source | Why |
| --- | --- | --- |
| No confusable characters | this package | `1`/`l`/`i`, `0`/`o` are the point |
| Even length, no duplicates, no case pairs | `createLuhn` | the check character is computed over it |
| `256 % n === 0` | uniform sampling | otherwise `byte % n` is biased |

The third is the one that is easy to miss. `crypto.randomBytes` yields values
0–255; taking `byte % n` over-represents the first `256 % n` characters. At
n = 32 the division is exact and every character is equally likely. luhn's own
36-character default is **not** uniform — `256 % 36 === 4`, over-representing
its first four characters by 14.3% — which is why token does not simply adopt
it.

A supplied dictionary is validated on all three. luhn already reports the
second as `too-short`, `odd-length`, `duplicate`, `case-pairs`; token checks
the first and third and reports its own reasons. It reads
`createLuhn(...).uniformOverBytes` rather than recomputing `256 % n === 0`.

Rejection sampling is the alternative to constraining the alphabet. It is not
used: it makes generation variable-time, and the constraint is satisfiable — the
default proves it.

## The prefix sits outside the checksum

`ORD-a4kp-9mx7` checksums `a4kp9mx` only.

Folding the prefix in requires every prefix character to be in the alphabet.
`ORD` contains `o`, which is excluded precisely because it is confusable, so
the original filtered it to `RD` before folding — silently, and only for some
prefixes. A caller who wants the prefix authenticated can put it in the body.

Prefix comparison is a literal string match, which is what a caller checking
`code.startsWith('ORD-')` expects.

## Validation, and what it is for

`validate` is the cheap gate before an expensive operation, so it must be
total, fast and free of side effects. It returns a reason rather than throwing:

| `reason` | meaning |
| --- | --- |
| `outside-alphabet` | a character not in the dictionary, after separators are stripped |
| `wrong-length` | body length does not match the configured length |
| `check-failed` | the check character does not match the body |

`valid: true` means the code is well formed. It does not mean the code exists.
The README must say so, because a check character that is mistaken for
authentication is worse than none — it is 1/n guessable by construction, and at
n = 32 that is one in thirty-two.

## Separators are presentation

`generate` returns `value` chunked and `body` unchunked. `validate` strips the
separator before checking, so a code typed with or without it, or with the
wrong grouping, still validates. The separator must not appear in the
dictionary; that is checked at construction.

Chunk size divides the total length, or construction throws. A trailing chunk
of one character is harder to read aloud, which is the thing this package
exists to avoid.

## Entropy

`length` counts body characters including the check character, so usable
entropy is `(length - 1) * log2(n)`. At the defaults — length 8, n = 32 —
that is 35 bits. The README states this next to the default rather than leaving
it to be derived, because a verification code sized by eye is how a code ends
up guessable.

`generate` never retries or checks for collisions. Uniqueness is the caller's
database constraint, not a property a generator can offer.

## Migration

Nothing to migrate. `@evanion/token` has never been published, and the 2022
source throws on every call against current luhn.

## Testing

- Generated tokens validate, over enough samples to catch a systematic
  off-by-one: `generate` then `validate` for 10,000 codes, zero failures.
- A single-character substitution anywhere in the body is caught. This is the
  property the check character exists for, and Luhn's guarantee is that all
  single-digit substitutions are detected.
- Adjacent transpositions are caught except the pairs Luhn is known not to
  catch. Assert the known exception rather than asserting it catches
  everything.
- Uniformity: over 100,000 samples with the default alphabet, no character
  appears more than a small tolerance from `1/n`. Then the same test with a
  deliberately non-uniform alphabet, asserting construction rejects it.
- A code with the separator removed, doubled, or placed differently still
  validates.
- Prefix is not checksummed: the same body with two different prefixes has the
  same check character.
- Construction rejects each invalid dictionary with its own reason, including
  one that is valid for luhn but confusable, and one that is unconfusable but
  not uniform.
- Examples in the README and docblocks are pinned by a test, as
  `libs/luhn/src/lib/docs.spec.ts` does. That test caught a check character
  that was guessed rather than computed.
