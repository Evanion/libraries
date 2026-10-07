# @evanion/luhn

**Prevent mistyped identifiers from hitting your database.**

Stop performing database lookups for IDs that cannot exist. Whether it's an order number, a gift card, or a tracking ID, `@evanion/luhn` lets you add a check character to your identifiers, allowing you to reject typos instantly and locally.

## A Mistyped Identifier Still Costs a Query

When a user types an ID into a form, the standard approach is to send that ID to the server and query the database. But what happens when the user makes a simple typo?

1. **Wasted Resources**: Your database spends CPU and I/O searching for a record that cannot possibly exist.
2. **Poor Feedback**: The user gets a generic "Not Found" error, which doesn't tell them _why_ the ID is invalid—only that it isn't in the system.
3. **Database Load**: At scale, every mistyped ID is one more query that finds nothing.

## A Check Character Refuses the Typo

By adding a single check character to the end of your identifier, you turn the ID into a self-validating string. Using a generalized Luhn algorithm, `@evanion/luhn` verifies the integrity of an identifier in memory, without a network call or a database query.

### Issue and Check an Order Code

`generate` returns the check character and does not append it, so `orderCode` decides where it goes. `validate` refuses the code with its last character misread as a `1`.

### What a Check Character Catches

The second code has one digit changed and the third has two adjacent digits swapped. Both are refused.

A check character catches typing mistakes and nothing else. A random string passes one time in 36 under the default dictionary, and anyone can compute a valid check character, so a code that passes still needs your database to say whether it was issued.

## Key Features

- **Any Even-Sized Alphabet**: Plain Luhn mod-10 over digits, as on payment cards, or mod-N over letters or custom symbols.
- **Typo-Resistant**: Detects every single-character substitution and every adjacent swap except one: the dictionary's first and last characters.
- **Local Check**: Refuses a mistyped code in memory, before your code sends the query. A code that passes still needs that query.
- **Zero Dependencies**: ESM-only, for Node 20 or newer and any browser.

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

`generate` returns the phrase it computed over alongside the check character, because the phrase is not always the input you passed in. Characters outside the dictionary are dropped and counted in `filtered`.

### Handling Empty Input

`generate` throws `EmptyInputError` when no character of the input is in the dictionary. A check character over no payload carries no information, and returning one would make `generate('')` and `generate('--')` indistinguishable:

### What `validate` Returns

`validate` treats the last dictionary character of its input as the check character, and never throws.

Fewer than two surviving characters is never valid, because a payload and a check character is the minimum.

### Mapping a Code Back to an Order

`validate`'s `phrase` includes the check character, so the phrase `generate` returned for the order number is `phrase.slice(0, -1)`. Store that phrase with the order and look the order up by it, whatever case and separators the code was typed with:

### Strict Input with `filtered`

A barcode scanner sends exactly the characters the barcode holds, so a till reading one can refuse anything the filter dropped:

## Custom Dictionaries

A dictionary is the alphabet `@evanion/luhn` reads a code against. `createLuhn` validates a dictionary once, at construction, and returns a frozen instance carrying `generate` and `validate` bound to it.

### The Default Dictionary

The default is 36 lowercase alphanumerics, with case folding on:

The order of the dictionary decides which index each character occupies, and therefore every check character it produces. Two dictionaries with the same characters in a different order are different alphabets.

### Building Your Own with `createLuhn`

The shop's pickup codes draw on 32 characters: the 36 with `i`, `l`, `o` and `w` dropped, because they are confused when read or heard:

### Dictionary Constraints

`createLuhn` throws `InvalidDictionaryError`, carrying a `reason`, when a dictionary breaks one of five constraints:

| `reason`       | What the dictionary must be                                           |
| -------------- | --------------------------------------------------------------------- |
| `not-a-string` | a string                                                              |
| `too-short`    | at least 2 code points long                                           |
| `odd-length`   | an even number of code points long                                    |
| `duplicate`    | free of repeated code points                                          |
| `case-pairs`   | free of case variants of one letter, when `caseInsensitive` is `true` |

Everything is checked once, at construction, so an instance you hold cannot produce a code its own `validate` rejects.

### Unicode Dictionaries

Counting is by code point, so an astral dictionary, such as emoji or anything outside the Basic Multilingual Plane, is measured and indexed as you wrote it:

### Caching Instances

A dictionary that varies at runtime needs an instance per dictionary. `createLuhn` validates the dictionary and builds a lookup table every time it is called, so cache the instance when the same few recur:

### Case Sensitivity

`caseInsensitive` folds input to lowercase before looking it up. It defaults to `true` when you supply no dictionary and `false` when you do. `ALTERNATING_CASE_DICTIONARY` holds 62 characters, `0-9` then `Aa Bb … Zz`, and an instance over it reads case:

Folding over a dictionary that holds both `A` and `a` would leave the index of `A` unreachable, so `createLuhn` rejects it rather than quietly downgrading:

## Standards and Modulo Bias

### Mod-10 and Its Standards

With `dictionary: '0123456789'`, `@evanion/luhn` is plain Luhn mod-10 and matches the published vectors:

Luhn's patent [US 2,950,048](https://patents.google.com/patent/US2950048A/en) defines mod-10, and ISO/IEC 7812-1 Annex B specifies it for issuer identification numbers, restated in 3GPP TS 23.003 Annex B.2 and in the [CMS NPI check-digit specification](https://www.cms.gov/Regulations-and-Guidance/Administrative-Simplification/NationalProvIdentStand/Downloads/NPIcheckdigit.pdf).

### Mod-N Has No Formal Standard

No RFC, ISO, ITU or ANSI document defines the generalisation to an arbitrary alphabet. The `floor(a / n) + (a % n)` formula everyone uses traces to [Wikipedia revision 74161899](https://en.wikipedia.org/w/index.php?title=Luhn_mod_N_algorithm&oldid=74161899), dated 2006-09-06 and unsourced. With any `n` other than 10, this library implements that common generalisation and claims nothing more.

### Modulo Bias

Drawing a random string over a dictionary with `byte % n` is uniform only when `n` divides 256. The default 36-character dictionary does not: `256 % 36` is 4, and the first four characters come up about 14% more often than the rest. `@evanion/luhn` does not generate random values, and `uniformOverBytes` reports whether an instance's dictionary is safe to draw from that way:

`uniformOverBytes` says nothing about the quality of the bytes.

## Errors

- `LuhnError`: base class for everything this library throws.
- `InvalidDictionaryError extends LuhnError`: thrown by `createLuhn`; carries `reason`, `dictionary`, and `offending` (the repeated code points, or the case pairs).
- `EmptyInputError extends LuhnError`: `generate` had nothing to work with.

Catching `LuhnError` handles both without naming either:

Every instance is frozen, so an assignment to `Luhn.dictionary` throws a `TypeError` in an ES module:

## Migrating from 2.x

**Every check character changes.** The default dictionary went from 62 characters to 36, so a code 2.x produced validates under 3.x only by coincidence. `ALTERNATING_CASE_DICTIONARY` over lowercased input reproduces every check character the 2.x default produced:

[Migrating from 2.x](https://docs.evanion.com/luhn/migration) maps every 2.x call to its 3.x form.

## Beyond the Basics

The documentation site covers each topic above in depth, including:

- **Custom Dictionaries**: How to create a "confusable-free" alphabet to prevent reading errors.
- **Modulo Bias**: Understanding the impact of dictionary size on sampling uniformity.
- **Filtering**: How to handle separators (hyphens, spaces) without breaking the checksum.
- **Migrating from 2.x**: Every 2.x call mapped to its 3.x form, and how to keep validating codes 2.x issued.

For the full API reference and worked examples, visit our documentation site:

[docs.evanion.com/luhn](https://docs.evanion.com/luhn)

## License

MIT — see [LICENSE](LICENSE).
