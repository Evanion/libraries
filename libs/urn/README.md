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

# urn

A URN Library that makes it easier to work with more meaningful identifiers.
The API is inspired by, and designed to be as simple as the JSON class.

```ts
import { URN } from '@Evanion/urn';

// You can easily extend the base class to create your own base schema
class TRN extends URN {
  static readonly urn = 'trn';
}

// Then you can generate a URN using the stringify method
TRN.stringify('foo', 'bar'); // -> 'trn:bar:foo'
```

## What is a URN?

URN stands for `Universal Resource Name` and is part of the URI spec in [RFC8141](https://datatracker.ietf.org/doc/html/rfc8141). And you might have seen it in use at some major companies like AWS (strings that start with `ARN:...`). It's used to identify resources with a more descriptive string, than just a plain identifier, by also adding a namespace and schema.

## Why should you use a URN

How many times have you seen a random DocumentID being thrown around in a conversation,
and you wonder what type of DocumentID it is? Is it a `product` or `productCategory` ID?  
A URN will help, by always include information about the namespace that the ID is referring to.

## Philosophy

The idea with this library to make it as easy to work with URNs as it is to work with `JSON`.
And the libraries API is inspired by the `JSON` API.

## Declare namespace

You can easily create a namespace specific class

```ts
// You can create namespace specific URN classes
class UserTRN extends TRN {
  static readonly nid = 'user';
}

// That will automatically create a URN with the proper namespace
UserTRN.stringify('1337'); // -> 'trn:user:1337'
```

## Parse urn

Parsing a URN will decode it in to it's constituent parts

```ts
const parsed = UserTRN.parse('trn:user:1337');
console.log(parsed); // -> {urn:'trn', nid: 'user', nss: '1337'}
```

If you parse a URN from another namespace ID, it will retain the namespace ID in the NSS.
This way, each namespace should only work with plain ids when it's inside it's own namespace, and retain the namespace information if it's from another namespace ID

```ts
const parsed = UserTRN.parse('trn:order:42');
console.log(parsed); // -> {urn: 'trn', nid: 'order', nss: 'order:42'}
```

## Validation

The library will attempt to validate the URN and NIDs to only contain valid characters (a-z 0-9 case insensitive)

```ts
UserTRN.stringify('1337', 'f?o'); // -> will throw a NID ValidationError
```

```ts
UserTRN.stringify('1337', 'foo', 'b!r'); // -> will throw a URN ValidationError
```

It will won't add a namespace if it already exists

```ts
UserTRN.stringify('user:1337'); // -> 'trn:user:1337'
```

## Caveats

Since classes aren't aware of sibling classes, strignifying a `NSS` that contains another namespace
will cause duplication of namespaces

```ts
UserTRN.stringify('order:42'); // -> 'trn:user:order:42'
```

so the recommended solution is to set the namespace to what you expect

```ts
UserTRN.stringify('order:42', 'order'); // -> 'trn:order:42'
```
