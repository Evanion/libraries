# @evanion/acl

**Consistent, local authorization across your entire stack.**

Stop making a network round-trip every time you need to hide a button or protect an API endpoint. `@evanion/acl` lets you define your authorization logic once as a serializable matrix and evaluate it **locally**—on your Node backend, in your Next.js server components, or directly in the browser.

## The Problem: The "Authorization Bottleneck"

In most apps, authorization is a choice between two bad options:

1. **Centralized (Slow)**: Every check is an API call to an auth service. Your UI feels sluggish, and your backend is hammered with "Can the user do X?" requests.
2. **Duplicated (Fragile)**: You write the logic in the backend and then _re-implement_ a version of it in the frontend. The moment a rule changes, your UI diverges from your API, leading to "forbidden" errors for buttons the user thought they could click.

## The Solution: A Serializable Matrix

`@evanion/acl` introduces the **Access Control Matrix**. Instead of a function, your policy is a data structure.

You author the policy on the server, serialize it to JSON, and ship it to the client. The client rebuilds the evaluator and makes the exact same decisions as the server, without a network call.

### Core Concept: The Matrix in Action

The following example uses Baize, a board game shop, where booksellers can delete questions. To ensure consistency, the server builds the policy and sends `access.matrix` as JSON, which the browser then uses to rebuild an evaluator via `hydratePolicy`. This rebuilt evaluator provides the same answers as the server. This block runs in the package's test suite; each `// ->` comment indicates the expression's value.

<!-- #region first-copy -->

```ts @import.meta.vitest
import { hydratePolicy, policy } from '@evanion/acl';

type Shopper = { id: string; roles: string[] };
type Question = { id: string; askedBy: string };

const access = policy<Shopper, { question: Question }>()
  .for('question', (p) =>
    p.allow('delete', p.contains('subject.roles', 'bookseller')),
  )
  .build();

const bookseller = { id: 'staff-3', roles: ['bookseller'] };
const customer = { id: 'customer-41', roles: ['customer'] };
const question = { id: 'q7', askedBy: 'customer-41' };
// ---cut---
// The server sends the matrix as JSON text, and the browser rebuilds from it.
const json = JSON.stringify(access.matrix);
const inBrowser = hydratePolicy(JSON.parse(json));

inBrowser.can(bookseller, 'question', 'delete', question).allowed; // -> true
inBrowser.can(customer, 'question', 'delete', question).allowed; // -> false
```

<!-- #endregion first-copy -->

## Key Features

- ⚡ **Local Decisions**: A decision is a synchronous local function call, with no `await` and no network request.
- 🔄 **One Matrix**: The frontend answers from the same matrix as the backend, shipped as JSON. A copy answers from the version it holds until it fetches a new one.
- 🔒 **Fail-Closed**: Nothing is granted by default. An action an adopted document does not carry is refused, and a malformed document throws at construction.
- 🎯 **Field-Level Control**: Don't just decide if a user can `update`; decide exactly _which fields_ they can change using `canFields`.
- 📦 **Lightweight**: The package has no runtime or peer dependencies and ships its own types. It is ESM only and needs Node 20 or newer, and it runs in the browser.

## Installation

```bash
npm install @evanion/acl
```

## Security Contract

A decision is authoritative only where it runs in a trusted environment such as your server; in the browser the same `can` call is advisory and only changes what the user sees. Every layer decides for itself and trusts no earlier one. Because the matrix ships to the client in full, its names and structure are a public document; resolving the subject, covering every access path, and re-checking at write time remain your application's job. The full security contract is in [SECURITY.md](https://github.com/Evanion/libraries/blob/main/libs/acl/SECURITY.md) and on the [security page](https://docs.evanion.com/acl/security/).

## Documentation

For deep dives into the security model, field-level permissions, and integration guides for Next.js and Express, visit our documentation site:

👉 **[docs.evanion.com/acl](https://docs.evanion.com/acl/)**

## License

MIT
