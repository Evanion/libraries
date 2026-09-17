Yes. Looking at [docs.evanion.com](https://docs.evanion.com) and the monorepo, the pattern is clear: one problem, framework-free core when possible, validate-at-construction, pure resolve with reasons, and explicit non-goals. You already have a next one queued (`baize-ui`). These are the gaps that fit the same DNA.

### Highest fit (same “small but deep” shape)

1. **`@evanion/capability` (or `permission`)** — sibling to `@evanion/feature`  
   Feature answers “is this on for this subject?” Capability answers “can this actor do this on this resource?” Same dependency cascade, same `reason` / `blockedBy` / `cause` chain, same never-write-on-resolve rule. Crowded at the SaaS layer (Casbin, Oso, Cedar); almost empty as a tiny typed TS core.

2. **`@evanion/context`** — extract the ALS core from Nest correlation-id  
   Correlation-id is the Nest adapter; the universal problem is “carry one bag through awaits.” Core: open/get/run/bind. Adapters: Nest middleware, `fetch` interceptor, Next middleware. Same split as `widget` → `react-widget` / `astro-widget`.

3. **`@evanion/problem`** — RFC 9457 Problem Details  
   Structured API errors with a JSON-class API (`parse` / `stringify`), typed `type` URNs (via `@evanion/urn`), optional correlation id hook. Stops at the document shape — no Express middleware farm.

4. **`@evanion/cursor`** — opaque pagination cursors on Luhn  
   Token is for humans; cursors are for machines that still get tampered with. Encode payload → check character → `validate` fails closed. Explicit non-goal: no DB, no sorting strategy.

5. **`@evanion/env`** — `createEnv` that freezes once  
   Same construction-time contract as `createLuhn` / `createFeatures`: coerce, validate, freeze; afterwards nothing can produce an invalid config. No dotenv, no framework.

### Strong secondary

6. **`@evanion/money`** — fixed-point + currency, `parse`/`stringify`, never float  
7. **`@evanion/clock`** — injectable `now` (feature already wants this; everyone reinvents it poorly)  
8. **`@evanion/window`** — pure time-window evaluation with reasons (the time half of feature, reusable)  
9. **More widget adapters** — Vue / Svelte / Solid; less “missed idea,” more completing the rendering cluster  
10. **`@evanion/idempotency`** — key protocol + store interface only (pairs with token + correlation)

### Already covered — don’t invent again
- Design system → `baize-ui` (spec exists)  
- Provider pyramids → `compose`  
- Human codes / check chars / namespaced ids → `token` / `luhn` / `urn`  
- CMS-as-data rendering → `widget` family  
- Flag dependencies / rollouts → `feature`

### Filter I’d use before starting one
Would you otherwise hand-roll it? Does it stop at one verb? Can the interesting part be pure + typed? Is the “what it does not do” section longer than the happy path? If yes on all four, it belongs in the set.

If I had to pick one next after shipping `feature` + `baize-ui`: **capability** (same architecture, different domain) or **context** (unlocks more adapters without growing Nest-specific surface).


Evanion:
Funny you should mention an ACL.. I have been thinking of it. CASL is what I use today, but it's setup feels clonky, especially if you want to setup syncing the policy matrix over an API between the backend and frontend, so you don't need to maintain two implementations of the matrix.

cursor:
CASL’s awkwardness for that use case is structural, not just DX.

CASL wants you to **build abilities in code** (`can` / `cannot` in a factory). Sync then becomes either:
- duplicate the factory on both sides, or
- `packRules` a **per-user** ability set over the wire

That second path mixes *who you are* into the document you ship. Subject classes and detect helpers don’t survive JSON cleanly, conditions drift toward Mongo-shaped queries, and the “one matrix” you wanted never actually exists as data.

What you already solved in `@evanion/feature` is the better split:

| Layer | Lives where | Synced? |
|---|---|---|
| **Matrix** (roles/actions/resources + rules) | JSON config | yes — one payload |
| **Context** (actor attrs, resource attrs, `now`) | per call | no |
| **Decision** (`allowed` + `reason` chain) | pure `resolve` | optional snapshot |

Backend and frontend both do `createCapabilities(matrix)` from the same document. Evaluation is local. No second implementation.

### Shape that would feel native next to `feature`

```ts
const acl = createCapabilities([
  {
    key: 'article.update',
    action: 'update',
    subject: 'Article',
    rules: [
      {
        id: 'author',
        when: [
          { field: 'actor.id', op: 'eq', path: 'resource.authorId' },
          { field: 'actor.roles', op: 'contains', value: 'writer' },
        ],
      },
      {
        id: 'editor',
        when: [{ field: 'actor.roles', op: 'contains', value: 'editor' }],
      },
    ],
  },
  {
    key: 'article.publish',
    action: 'publish',
    subject: 'Article',
    dependsOn: ['article.update'], // cascade like feature
    rules: [
      { id: 'editor-only', when: [{ field: 'actor.roles', op: 'contains', value: 'editor' }] },
    ],
  },
]);

acl.can('update', article, { actor });
acl.resolve({ actor, resource: article })['article.publish'];
// { allowed: false, reason: 'dependency-off', blockedBy: 'article.update', cause: … }
```

Construction validates the graph once (unknown deps, cycles, duplicate keys). `resolve` never writes. Reasons are output-only — same operator story as feature.

### The sync model that actually works

1. **Ship the matrix** (`GET /api/acl` or embed at build) — public-ish policy intent.
2. **Never ship secrets in conditions** — anything that needs payroll grade, internal flags, etc. stays server-only; either omit those rules from the client matrix or use a **decision snapshot** for that subset (`plan`-style).
3. **React adapter** mirrors feature: `CapabilityProvider` + `useCan(action, subject)` over an already-built store. The adapter decides nothing.

That gives you one matrix, two runtimes, zero duplicated factories — which is exactly what CASL makes you fight for.

### Hard boundary (worth deciding up front)

Don’t try to be Cedar/Oso. Stay in the feature niche:
- declarative rules over a flat context
- dependency cascade
- explainable deny
- JSON round-trip of the matrix

Explicit non-goals: ABAC policy language, obligation hooks, Redis-backed role graphs, “infer subject type from class”.

If you want, next step is a short spec in the same voice as `2026-09-11-feature-toggles.md` — especially the wire format for matrix sync and which fields are allowed in a client-shipped document.
