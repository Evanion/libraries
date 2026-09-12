![CI](https://github.com/Evanion/libraries/actions/workflows/ci.yml/badge.svg)
![npm (scoped)](https://img.shields.io/npm/v/@evanion/urn)

# URN Library

A URN Library that makes it easier to work with more meaningful identifiers. The API is inspired by, and designed to be as simple as the JSON class.

## What is a URN?

URN stands for `Universal Resource Name` and is part of the URI spec in [RFC8141](https://datatracker.ietf.org/doc/html/rfc8141). You might have seen it in use at some major companies like AWS (strings that start with `ARN:...`). It's used to identify resources with a more descriptive string, than just a plain identifier, by also adding a namespace and schema.

## Why should you use a URN?

How many times have you seen a random DocumentID being thrown around in a conversation, and you wonder what type of DocumentID it is? Is it a `product` or `productCategory` ID?  
A URN will help, by always include information about the namespace that the ID is referring to.

## Philosophy

The idea with this library is to make it as easy to work with URNs as it is to work with `JSON`. And the library's API is inspired by the `JSON` API.

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

<!-- #region basic-usage -->
```ts @import.meta.vitest
import { URN } from '@evanion/urn';

// You can easily extend the base class to create your own base schema
class TRN extends URN {
  static override readonly urn = 'trn';
}

// Then you can generate a URN using the stringify method
TRN.stringify('foo', 'bar'); // -> 'trn:bar:foo'

// Parse a URN to get its constituent parts
const parsed = TRN.parse('trn:bar:foo'); // -> { urn: 'trn', nid: 'bar', nss: 'bar:foo' }
```
<!-- #endregion basic-usage -->

## Features

- **Simple API**: JSON-inspired API for easy adoption
- **URN Parsing**: Parse URN strings into structured components
- **URN Stringifying**: Create URN strings from components
- **Custom Schemes**: Support for custom URN schemes beyond the standard `urn:`
- **Namespace Support**: Handle custom namespaces and identifiers
- **Class Inheritance**: Extend the base URN class for domain-specific implementations
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- **RFC 8141 grammar**: A role-scoped grammar for the scheme, the NID and the
  NSS, rather than one flat character class
- **Case-folded comparison**: `sameNamespace`, `belongsToNamespace` and
  `equals` fold the scheme and the NID, per RFC 8141 §3.1

## Why should you use a URN

How many times have you seen a random DocumentID being thrown around in a conversation,
and you wonder what type of DocumentID it is? Is it a `product` or `productCategory` ID?  
A URN will help, by always include information about the namespace that the ID is referring to.

## Philosophy

The idea with this library to make it as easy to work with URNs as it is to work with `JSON`.
And the libraries API is inspired by the `JSON` API.

## Basic Usage

### Declare Namespace

You can easily create a namespace specific class:

```ts
// You can create namespace specific URN classes
class UserTRN extends TRN {
  static override readonly nid = 'user';
}

// That will automatically create a URN with the proper namespace
UserTRN.stringify('1337'); // -> 'trn:user:1337'
```

### Custom URN Schemes

Create your own URN schemes for different domains:

```ts
// E-commerce system
class EcommerceURN extends URN {
  static override readonly urn = 'ecommerce';
}

class ProductURN extends EcommerceURN {
  static override readonly nid = 'product';
}

class OrderURN extends EcommerceURN {
  static override readonly nid = 'order';
}

// Usage
const productUrn = ProductURN.stringify('laptop-123');
console.log(productUrn); // "ecommerce:product:laptop-123"

const orderUrn = OrderURN.stringify('456');
console.log(orderUrn); // "ecommerce:order:456"
```

### Parse URNs

Parsing a URN will decode it into its constituent parts:

```ts
const parsed = UserTRN.parse('trn:user:1337');
console.log(parsed); // -> {urn:'trn', nid: 'user', nss: '1337'}
```

**Important**: If you parse a URN from another namespace ID, it will retain the namespace ID in the NSS. This way, each namespace should only work with plain ids when it's inside its own namespace, and retain the namespace information if it's from another namespace ID:

```ts
const parsed = UserTRN.parse('trn:order:42');
console.log(parsed); // -> {urn: 'trn', nid: 'order', nss: 'order:42'}
```

A foreign **scheme** is retained the same way, verbatim, so a record read from
another scheme cannot be silently re-labelled as this one:

```ts
UserTRN.parse('ftp:user:1'); // -> {urn: 'ftp', nid: 'user', nss: 'ftp:user:1'}
UserTRN.parse('trn:user:1'); // -> {urn: 'trn', nid: 'user', nss: '1'}
```

The comparisons are case-folded, so `URN:USER:1` is not foreign to a `urn` /
`user` class. The parts always come back in the case they were written in.

## Validation & Error Handling

The library validates the URN scheme, the NID **and** the NSS, each against its
own grammar. There is no single character class: the three roles are different
in the RFC and are different here.

| Role           | Allowed                                                                                                                                   | Length                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| scheme (`urn`) | a letter, then letters, digits, `+`, `-`, `.`                                                                                             | unbounded                  |
| NID            | letters and digits, plus `-` in the interior                                                                                              | 2–32 writing, 1–32 reading |
| NSS            | letters, digits, `-` `.` `_` `~` `!` `$` `&` `'` `(` `)` `*` `+` `,` `;` `=` `:` `@`, percent-triplets, and `/` after the first character | unbounded                  |

Letters are case-insensitive everywhere. Every component must be non-empty.

Read the grammars off the class if you need them — they stay reactive to a
subclass's `separator`:

<!-- #region grammars -->
```ts @import.meta.vitest
URN.schemeGrammar; // /^[A-Za-z][A-Za-z0-9+.-]*$/
URN.nidGrammar; // /^[A-Za-z0-9][A-Za-z0-9-]{0,30}[A-Za-z0-9]$/
URN.nssGrammar; // the RFC 8141 `pchar *(pchar / "/")` set
```
<!-- #endregion grammars -->

```ts
import { URN, InvalidError } from '@evanion/urn';

// This will throw an InvalidError for invalid NID
UserTRN.stringify('1337', 'f?o'); // throws InvalidError, an invalid NID

// This will throw an InvalidError for invalid URN
UserTRN.stringify('1337', 'foo', 'b!r'); // throws InvalidError, an invalid URN

// Handle errors gracefully
try {
  const urn = URN.stringify('invalid character', 'namespace');
} catch (error) {
  if (error instanceof InvalidError) {
    console.log('Invalid URN:', error.message);
  }
}
```

### Read-lenient, write-strict

`stringify` enforces the RFC 8141 NID exactly. `parse` accepts the same
character set but allows a one-character NID, because RFC 2141 permitted one and
RFC 8141 Appendix B keeps earlier-valid URNs valid. Nothing else is relaxed on
read:

```ts
URN.parse('urn:x:1'); // ok
URN.stringify('1', 'x'); // throws: NID must be at least 2 characters long
```

### Percent-encoding

`stringify` does not encode and `parse` does not decode. Both work on the wire
form, so a value can never be double-encoded by accident. `stringify` rejects an
NSS that is not already encoded:

```ts
URN.stringify('a b', 'example'); // throws
URN.stringify('a%20b', 'example'); // 'urn:example:a%20b'
URN.parse('urn:example:a%20b').nss; // 'a%20b' -- triplets come back intact
```

Two helpers cover the conversion explicitly:

<!-- #region nss-encoding -->
```ts @import.meta.vitest
import { encodeNss, decodeNss } from '@evanion/urn';

encodeNss('café'); // -> 'caf%C3%A9'
decodeNss('caf%C3%A9'); // -> 'café'
```
<!-- #endregion nss-encoding -->

### Equivalence

`URN.equals` implements RFC 8141 §3.1: the scheme and the NID are compared
case-insensitively, the NSS character for character, except that the hex digits
of a percent-triplet canonicalise to uppercase. A percent-encoded octet is never
decoded for comparison:

<!-- #region equality -->
```ts @import.meta.vitest
URN.equals('URN:Example:a123%2cz456', 'urn:example:a123%2Cz456'); // -> true
URN.equals('urn:example:a123%2Cz456', 'urn:example:a123,z456'); // -> false
URN.equals('urn:example:A123', 'urn:example:a123'); // -> false
```
<!-- #endregion equality -->

### Custom separators are not RFC 8141

A subclass that overrides `separator` gets a generic character class with the
separator excluded, for the scheme and the NID, and no RFC length bounds. The
NSS keeps the RFC grammar under every separator. Such a subclass is **not**
claimed to be RFC 8141 conformant.

## Important Caveats

`stringify` does not deduplicate. Whatever you pass as the NSS is emitted
verbatim after the scheme and the NID, so an NSS whose first segment happens to
equal the NID survives the round trip:

```ts
UserTRN.stringify('user:42'); // -> 'trn:user:user:42'
UserTRN.parse('trn:user:user:42').nss; // -> 'user:42'
```

Earlier versions dropped the repeated segment, which made `user:42` — a
composite key imported from another system — irrecoverable. If you meant the
other namespace, name it:

```ts
UserTRN.stringify('42', 'order'); // -> 'trn:order:42'
```

`stringify` is also not idempotent, and is not a normaliser:

<!-- #region round-trip -->
```ts @import.meta.vitest
URN.stringify(URN.stringify('foo')); // -> 'urn:nid:urn:nid:foo'
```
<!-- #endregion round-trip -->

The statics are unbound. Every one of them reads `this`, so unlike
`JSON.stringify` they cannot be destructured:

```ts
const { stringify } = URN;
stringify('a'); // TypeError -- the default parameter `nid = this.nid` needs `this`
```

The arguments to `stringify` are in the reverse order of `parse`'s return shape,
so `stringify(...Object.values(parse(x)))` is silently wrong. Pass them by name:

```ts
const parsed = URN.parse(input);
URN.stringify(parsed.nss, parsed.nid, parsed.urn);
```

## Common Use Cases

### Resource Identification

```ts
class ResourceURN extends URN {
  static override readonly urn = 'resource';
}

// Identify different types of resources
const userUrn = ResourceURN.stringify('123', 'user');
const productUrn = ResourceURN.stringify('456', 'product');
const orderUrn = ResourceURN.stringify('789', 'order');
```

### Microservice Communication

```ts
class ServiceURN extends URN {
  static override readonly urn = 'service';
}

// Identify services and their resources
const userServiceUrn = ServiceURN.stringify('user-service', 'service');
const userResourceUrn = ServiceURN.stringify('123', 'user-service');
```

## API Reference

### Static Methods

- `URN.stringify(nss, nid?, urn?)` — Creates a URN string from components.
  Throws `InvalidError` if any component is empty or contains a disallowed character.
- `URN.parse(urnString)` — Parses a URN string into `{ urn, nid, nss }`.
  Throws `ValidationError` if the string is not a well-formed URN.
- `URN.isValidFormat(urnString)` — `true` if the string parses. Delegates to
  `parse`, so the two can never disagree. Never throws, so it is the cheap way
  to test input first.
- `URN.extractId(urnString)` — Returns everything after the scheme and the NID.
  Throws `ValidationError` on malformed input.
- `URN.sameNamespace(a, b)` — `true` if both URNs share a scheme and NID.
  Returns `false` for malformed input rather than throwing.
- `URN.belongsToNamespace(urnString, nid, urn?)` — `true` if the URN is in the
  given namespace, comparing case-insensitively. `urn` defaults to **this
  class's own scheme**, so it works on subclasses without repeating the scheme.
- `URN.equals(a, b)` — RFC 8141 §3.1 equivalence. Returns `false` for malformed
  input rather than throwing.

### Functions

- `encodeNss(raw)` — percent-encodes everything outside RFC 3986's `unreserved`
  set, producing a valid NSS.
- `decodeNss(encoded)` — the inverse. Throws `ValidationError` on a malformed or
  truncated percent sequence.

#### `parse().nss` vs `extractId()`

They differ on a foreign namespace, on purpose. `parse` keeps a non-matching NID
attached to the `nss` so the namespace is not silently lost; `extractId` always
drops it:

```ts
URN.parse('urn:user:123').nss; // 'user:123'  (base class nid is 'nid')
URN.extractId('urn:user:123'); // '123'
```

Reach for `parse` when the namespace matters, `extractId` when you only want the
trailing identifier.

### Errors

- `ValidationError` — base class for everything this library throws. Catch this
  to handle any validation failure.
- `InvalidError extends ValidationError` — a component was empty, contained a
  disallowed character, or broke a structural rule of its grammar. Carries
  `property` (`'URN' | 'NID' | 'NSS'`), `value`, `invalidChar` when a single
  character is at fault, and `reason` when none is — a length bound, a leading
  hyphen, a truncated percent-triplet.

### Class Properties

- `static urn: string` - The URN scheme (default: 'urn')
- `static separator: string` - The separator between components (default: ':')
- `static nid: string` - The namespace identifier (default: 'nid')
- `static schemeGrammar: RegExp` - The grammar the scheme must match
- `static nidGrammar: RegExp` - The grammar the NID must match when writing
- `static nssGrammar: RegExp` - The grammar the NSS must match

`isValid` is gone. One flat regex cannot describe three roles across two
separator regimes; the three getters can, and they stay reactive to a
subclass's `separator`.

When overriding these in a subclass, TypeScript's `noImplicitOverride` requires
the `override` keyword:

```ts
class UserTRN extends URN {
  static override readonly urn = 'trn';
  static override readonly nid = 'user';
}
```

## Testing

The library includes comprehensive test coverage with Vitest:

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests for any improvements.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Documentation

For comprehensive documentation, examples, and API reference, visit our [documentation site](https://docs.evanion.com/urn).
