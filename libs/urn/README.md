[![CircleCI](https://circleci.com/gh/Evanion/urn/tree/main.svg?style=shield)](https://circleci.com/gh/Evanion/urn/tree/main)
[![codecov](https://codecov.io/gh/Evanion/urn/branch/main/graph/badge.svg?token=S5V045X33K)](https://codecov.io/gh/Evanion/urn)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=Evanion_urn&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=Evanion_urn)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=Evanion_urn&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=Evanion_urn)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=Evanion_urn&metric=bugs)](https://sonarcloud.io/summary/new_code?id=Evanion_urn)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=Evanion_urn&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=Evanion_urn)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=Evanion_urn&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=Evanion_urn)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Evanion_urn&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Evanion_urn)
[![Known Vulnerabilities](https://snyk.io/test/github/Evanion/urn/badge.svg)](https://snyk.io/test/github/Evanion/urn)
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

```ts
import { URN } from '@evanion/urn';

// You can easily extend the base class to create your own base schema
class TRN extends URN {
  static readonly urn = 'trn';
}

// Then you can generate a URN using the stringify method
TRN.stringify('foo', 'bar'); // -> 'trn:bar:foo'

// Parse a URN to get its constituent parts
const parsed = TRN.parse('trn:bar:foo');
console.log(parsed); // -> {urn:'trn', nid: 'bar', nss: 'foo'}
```

## Features

- **Simple API**: JSON-inspired API for easy adoption
- **URN Parsing**: Parse URN strings into structured components
- **URN Stringifying**: Create URN strings from components
- **Custom Schemes**: Support for custom URN schemes beyond the standard `urn:`
- **Namespace Support**: Handle custom namespaces and identifiers
- **Class Inheritance**: Extend the base URN class for domain-specific implementations
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- **Validation**: Built-in validation for URN components (a-z, 0-9, case insensitive)

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
  static readonly nid = 'user';
}

// That will automatically create a URN with the proper namespace
UserTRN.stringify('1337'); // -> 'trn:user:1337'
```

### Custom URN Schemes

Create your own URN schemes for different domains:

```ts
// E-commerce system
class EcommerceURN extends URN {
  static readonly urn = 'ecommerce';
}

class ProductURN extends EcommerceURN {
  static readonly nid = 'product';
}

class OrderURN extends EcommerceURN {
  static readonly nid = 'order';
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

## Validation & Error Handling

The library validates URN and NID components to only contain valid characters (a-z, 0-9, case insensitive):

```ts
import { URN, InvalidError } from '@evanion/urn';

// This will throw an InvalidError for invalid NID
UserTRN.stringify('1337', 'f?o'); // -> will throw a NID ValidationError

// This will throw an InvalidError for invalid URN
UserTRN.stringify('1337', 'foo', 'b!r'); // -> will throw a URN ValidationError

// Handle errors gracefully
try {
  const urn = URN.stringify('invalid!character', 'namespace');
} catch (error) {
  if (error instanceof InvalidError) {
    console.log('Invalid URN:', error.message);
  }
}
```

The library won't add a namespace if it already exists:

```ts
UserTRN.stringify('user:1337'); // -> 'trn:user:1337'
```

## Important Caveats

Since classes aren't aware of sibling classes, stringifying a `NSS` that contains another namespace will cause duplication of namespaces:

```ts
UserTRN.stringify('order:42'); // -> 'trn:user:order:42' (duplicated!)
```

**Recommended solution**: Set the namespace to what you expect:

```ts
UserTRN.stringify('order:42', 'order'); // -> 'trn:order:42' (correct!)
```

## Common Use Cases

### Resource Identification

```ts
class ResourceURN extends URN {
  static readonly urn = 'resource';
}

// Identify different types of resources
const userUrn = ResourceURN.stringify('123', 'user');
const productUrn = ResourceURN.stringify('456', 'product');
const orderUrn = ResourceURN.stringify('789', 'order');
```

### Microservice Communication

```ts
class ServiceURN extends URN {
  static readonly urn = 'service';
}

// Identify services and their resources
const userServiceUrn = ServiceURN.stringify('user-service', 'service');
const userResourceUrn = ServiceURN.stringify('123', 'user-service');
```

## API Reference

### Static Methods

- `URN.stringify(nss, nid?, urn?)` - Creates a URN string from components
- `URN.parse(urnString)` - Parses a URN string into its components

### Class Properties

- `static urn: string` - The URN scheme (default: 'urn')
- `static separator: string` - The separator between components (default: ':')
- `static nid: string` - The namespace identifier (default: 'nid')

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
