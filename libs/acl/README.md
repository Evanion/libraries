# @evanion/acl

**Consistent, local authorization across your entire stack.**

Most apps suffer from an "Authorization Bottleneck": you either make a slow network round-trip for every UI button and API endpoint, or you risk fragile bugs by duplicating the same logic in both the frontend and backend. `@evanion/acl` solves this by letting you define your authorization logic once as a serializable matrix and evaluate it locally—on your Node backend, in your Next.js server components, or directly in the browser.

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

## Capability Map

The `@evanion/acl` package provides the following capabilities:

- **Local Decisions**: Decisions are synchronous function calls with no `await` and no network requests.
- **Single Source of Truth**: The frontend and backend answer from the same matrix shipped as JSON.
- **Fail-Closed Security**: Nothing is granted by default; malformed documents throw at construction and uncarried actions are refused.
- **Field-Level Control**: Use `canFields` to decide exactly which fields a user can change.
- **Environment Agnostic**: Runs in the browser and Node 20+; it is ESM only with no runtime or peer dependencies.

## Installation

```bash
npm install @evanion/acl
```

## Security Contract

A decision is authoritative only where it runs in a trusted environment such as your server; in the browser the same `can` call is advisory and only changes what the user sees. Every layer decides for itself and trusts no earlier one. Because the matrix ships to the client in full, its names and structure are a public document; resolving the subject, covering every access path, and re-checking at write time remain your application's job. The full security contract is in [SECURITY.md](https://github.com/Evanion/libraries/blob/main/libs/acl/SECURITY.md) and on the [security page](https://libs.evanion.com/docs/acl/security/).

## Documentation

For deep dives into the security model, field-level permissions, and integration guides for Next.js and Express, visit our documentation site:

👉 **[libs.evanion.com/docs/acl](https://libs.evanion.com/docs/acl/)**

## License

MIT
