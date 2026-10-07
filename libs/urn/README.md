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

A class keeps a foreign NID in the `nss`, so an identifier from another namespace is never re-labelled as this one, and a foreign scheme keeps the whole identifier. Both comparisons ignore case, per RFC 8141 §3.1, and the parts come back in the case they were written in:

`belongsToNamespace` picks one kind of URN out of a mixed list. It takes the NID as an argument even on a namespace class, and returns `false` for a string that is not a URN:

`sameNamespace` compares the scheme and the NID of two URNs, ignoring case, and returns `false` for a string that is not a URN:

`belongsToNamespace` defaults its scheme to the calling class's own, and takes another scheme as its third argument:

The base `URN` class serves code whose namespaces are open-ended. Its `stringify` takes the NSS first, then the NID and the scheme, each defaulting to the class's own. The object form keys the parts by name and matches `parse`'s return shape:

The base class's own NID is the placeholder `'nid'`, so `URN.parse(x).nss` keeps the NID of every real namespace. `extractId` always drops it:

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

`isValidFormat` calls `parse` and returns `false` where `parse` would throw, so it screens input before `parse` reads it. It checks the form, and a URN from another namespace passes:

`ValidationError` is the base of both error classes the library exports. `parse` throws it for a string that is not a URN at all, and its subclass `InvalidError` for a part that breaks its grammar:

An `InvalidError` names the part that failed, and either the first character at fault or the structural reason:

A job that mints many URNs catches per item, so one bad slug does not stop the rest:

### Component Parsing

RFC 8141 §2.3 allows three optional components after the NSS: the r-component (`?+`, parameters for the resolution service), the q-component (`?=`, parameters for the named resource) and the f-component (`#`, a secondary resource within the named one). `parse` returns each in its own field and never folds it into the `nss`:

The component fields are absent, not `undefined`, when the URN carries none, so a URN with no components parses to exactly `{ urn, nid, nss }`:

Only the object form of `stringify` writes components. The wire order is always r, q, f, whatever order the keys were written in:

The r- and q-components need at least one character and take `?` anywhere but the first. The f-component may be empty:

RFC 8141 §3.1 excludes all three components from equivalence, so `equals` checks their grammar but does not compare them, and `extractId` drops them:

### Percent-Encoding

`stringify` does not encode and `parse` does not decode. Both work on the wire form, so a value is never double-encoded by accident. `encodeNss` and `decodeNss` are the explicit step:

`decodeNss` throws a `ValidationError` on a `%` that is not followed by two hex digits, or on triplets that are not UTF-8:

`encodeURIComponent` is a separate step. It makes a whole URN safe as one segment of a URL path, where `:` and `%` mean something to a router:

`URN.equals` implements RFC 8141 §3.1. The scheme and the NID are compared ignoring case, and the NSS character for character, except that the hex digits of a percent-triplet compare ignoring case. A percent-encoded octet is never decoded for comparison:

### Custom Schemes and Separators

A subclass that overrides `separator` checks the scheme and the NID against a character class that excludes the separator, with no RFC length bounds. The NSS keeps the RFC grammar under every separator. Such a subclass is outside RFC 8141:

A separator that contains `?` or `#` cannot be told apart from a component introducer, so it switches components off. On such a class, `parse` throws an `InvalidError` with `property: 'NSS'` for any `?` or `#` after the NID, and `stringify` throws one with `property: 'COMPONENT'` for any component.

### Type-Safe Literals

`ParsedURN` is what `parse` returns and `URNParts` is what the object form of `stringify` takes. A `ParsedURN` is assignable to `URNParts`, whose scheme and NID fall back to the class's own:

`IFullURN` types a URN literal with the default `:` separator:

## Important Caveats

`stringify` does not deduplicate and is not idempotent. Whatever you pass as the NSS is written verbatim after the scheme and the NID, which keeps a composite key from another system recoverable:

The statics are unbound. Every one of them reads `this`, so unlike `JSON.stringify` they cannot be destructured or passed as a bare callback. `stringify`, `parse` and `extractId` throw a `TypeError`, and `isValidFormat`, `equals` and `sameNamespace` catch it and return `false`. An arrow function keeps the class:

`belongsToNamespace` throws the `TypeError` only when its scheme argument is left out. `filter` and `map` pass a third argument, so under either it returns `false` for every URN.

The positional arguments to `stringify` are in the reverse order of `parse`'s return shape, so `stringify(...Object.values(parse(x)))` writes the scheme where the NSS belongs. Hand `stringify` the object: the keys carry the meaning, and only that form can write the r-, q- and f-components.

For the full API reference and worked examples, visit our documentation site:

👉 **[docs.evanion.com/urn](https://docs.evanion.com/urn)**

## License

MIT
