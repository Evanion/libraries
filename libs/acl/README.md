# @evanion/acl

**Consistent, local authorization across your entire stack.**

Stop making a network round-trip every time you need to hide a button or protect an API endpoint. `@evanion/acl` lets you define your authorization logic once as a serializable matrix and evaluate it **locally**—on your Node backend, in your Next.js server components, or directly in the browser.

## The Problem: The "Authorization Bottleneck"

In most apps, authorization is a choice between two bad options:
1. **Centralized (Slow)**: Every check is an API call to an auth service. Your UI feels sluggish, and your backend is hammered with "Can the user do X?" requests.
2. **Duplicated (Fragile)**: You write the logic in the backend and then *re-implement* a version of it in the frontend. The moment a rule changes, your UI diverges from your API, leading to "forbidden" errors for buttons the user thought they could click.

## The Solution: A Serializable Matrix

`@evanion/acl` introduces the **Access Control Matrix**. Instead of a function, your policy is a data structure. 

You author the policy on the server, serialize it to JSON, and ship it to the client. The client rebuilds the evaluator and makes the exact same decisions as the server—instantly, and without a network call.

### Core Concept: The Matrix in Action

```ts @import.meta.vitest
import { policy } from '@evanion/acl';

type Shopper = { id: string; roles: string[] };
type Question = { id: string; askedBy: string };

// 1. Define your policy once
const access = policy<Shopper, { question: Question }>()
  .for('question', (p) =>
    p.allow('delete', p.contains('subject.roles', 'bookseller')),
  )
  .build();

const bookseller = { id: 'staff-3', roles: ['bookseller'] };
const customer = { id: 'customer-41', roles: ['customer'] };
const question = { id: 'q7', askedBy: 'customer-41' };

// 2. Evaluate locally and instantly
access.can(bookseller, 'question', 'delete', question).allowed; // -> true
access.can(customer, 'question', 'delete', question).allowed; // -> false
```

## Key Features

- ⚡ **Zero Latency**: Decisions are local function calls. No `await`, no network, no lag.
- 🔄 **Perfect Sync**: Ship the matrix as JSON. Your frontend and backend stay in lockstep.
- 🛡️ **Fail-Closed**: Unknown permissions or malformed data result in a refusal, not a grant.
- 🎯 **Field-Level Control**: Don't just decide if a user can `update`; decide exactly *which fields* they can change using `canFields`.
- 🪶 **Zero Dependencies**: Lightweight, ESM-only, and runs on any modern JS runtime (Node, Bun, Deno, Browser).

## Installation

```bash
npm install @evanion/acl
```

## Beyond the Basics

The matrix is more than just a boolean check. It provides a rich set of tools for production-grade authorization:

- **`canFields`**: Prevent mass-assignment attacks by whitelisting specific fields for a given subject.
- **`capabilities`**: Generate a map of everything a user can do to build dynamic navigation menus.
- **`parseMatrix`**: Adopt policies published by other services to create a federated authorization layer.
- **`hydratePolicy`**: Efficiently rebuild evaluators from JSON payloads.

## Comprehensive Documentation & Security Contract

This library operates under a strict **security contract**:
- **Subject Authenticity**: The engine assumes the subject is authorized as handed over; resolving the subject is the consumer's responsibility.
- **Complete Mediation**: Covering every access path is the application's job.
- **Time of Check to Time of Use**: Decisions describe a snapshot; the gap to the write is the consumer's responsibility.
- **Self-Authorizing Fields**: Conditions may read fields that the subject can write, which may authorize its own writer (self-authorizing).
- **Advisory Decisions**: Browser-side decisions are advisory; authoritative checks must happen on the server.
- **Public Document**: The matrix structure and names are a public document shipped to the client.
- **Clock Parameters**: The clock is a parameter that may be supplied by the caller.
- **Live Reads**: Decisions read the subject and object bags field-by-field.

For deep dives into the security model, field-level permissions, and integration guides for Next.js and Express, visit our documentation site:

👉 **[docs.evanion.com/acl](https://docs.evanion.com/acl)**

## License
MIT
