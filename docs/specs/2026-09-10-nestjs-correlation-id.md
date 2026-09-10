# nestjs-correlation-id: ESM-only, AsyncLocalStorage, platform-neutral

Status: #32 approved. #31, #33, #34 designed but not separately approved.
Package: `@evanion/nestjs-correlation-id` (repo 2.0.0, npm 1.1.0 — breaking changes are free until 2.0.0 ships)
Closes: #32. Designs #31, #33, #34.

## Ordering

#31 and #33 both rewrite files that #30's landed fix touches, so the order
matters more than usual here.

1. #32 packaging. Independent of everything else, do it first.
2. #33's platform-neutral middleware decision. It changes which request and
   response APIs exist, and #28/#29/#30's code is written against the Express
   ones. Decide before touching the middleware again.
3. #31's AsyncLocalStorage rewrite. #29's landed fix injects
   `CORRELATION_CONFIG_TOKEN` into a factory that also injects the
   request-scoped `CorrelationService`, which is the scope bubbling #31 removes.
4. #34's tests last. They must assert post-rewrite behaviour.

## #32: ship one format

Drop dual publishing. Ship ESM only, peers narrowed to NestJS 12.

This closes the hazard by construction. One build means one module graph, one
`CorrelationService` class object, so class-token injection is safe and no
token-based workaround is needed.

### Evidence

Read from published `package.json`, not from documentation:

- No first-party `@nestjs/*` package dual-publishes. `@nestjs/common@10.4.0` and
  `@nestjs/core@11.0.0` are CJS with no `exports` map; `12.0.1` is
  `"type": "module"` with no `require` condition. The format flips wholesale at
  the v12 boundary.
- `@nestjs/axios@12.0.0` is ESM-only and still peers
  `^10.0.0 || ^11.0.0 || ^12.0.0`. Nest 10 and 11 apps consume it through
  `require(esm)`.
- `nestjs-cls@6.3.0`, the closest analog — AsyncLocalStorage request context
  injected through DI — peers `>=10 <13`, ships single-format CJS, no `exports`
  map at all. Zero hazard by construction.
- `nestjs-pino@5.1.0` and `@golevelup/nestjs-rabbitmq@9.0.2`: single-format CJS.
- Node's packaging docs no longer carry the dual-package-hazard prose; it is one
  line pointing at `nodejs/package-examples`. Since `require(esm)` went
  unflagged in Node 20.19 and 22.12, dual publishing is the legacy workaround.

### Changes

- Delete `nest/correlation-id/tsconfig.lib.cjs.json`. Its header comment says it
  exists solely to emit `require()` calls for NestJS 10 and 11.
- Delete `nest/correlation-id/tools/write-cjs-marker.mjs`. With `"type": "module"`
  at the package root, `dist` is ESM by default and needs no marker.
- Collapse `exports` to one condition, keeping `@evanion/source` for workspace
  resolution.
- `peerDependencies`: `@nestjs/common` and `@nestjs/axios` become `^12.0.0`.
- Add `engines.node: ">= 20"`, matching `@nestjs/core@12.0.1`. `@nestjs/axios@12`
  declares `^20.19.0 || ^22.12.0 || >=24.0.0`, but it is an optional peer.

Dropping the 10 and 11 peers is a deliberate narrowing. NestJS 12 has been out
long enough that following first-party is the right default.

## #31: AsyncLocalStorage

`withCorrelation` builds `HttpModuleOptions` through a `useFactory` that injects
`CorrelationService`, which is `@Injectable({ scope: Scope.REQUEST })`. Scope is
contagious upward: the generated `HTTP_MODULE_OPTIONS` provider becomes
request-scoped, so `HttpService` becomes request-scoped for every consumer in
that module.

Two consequences, both silent. Singleton services holding `HttpService` are
re-instantiated per request. `onModuleInit` never fires on request-scoped
providers, so warmers and cron registration no-op.

Fix:

- `CorrelationService` becomes a plain singleton backed by `AsyncLocalStorage`.
- `withCorrelation` becomes a static factory with no request-scoped dependency.
- The header is attached by an axios request interceptor that reads the store at
  request time, rather than baking a value into the options object at
  construction time.

Reading at request time is more correct under concurrency regardless. Today the
value is only right per-request because of the scope, which is itself the bug.

Breaking: anything calling `module.resolve(CorrelationService, contextId)`, which
the current spec does.

`nestjs-cls` is the reference implementation of this shape.

## #33: platform-neutral middleware

Decide before rewriting the middleware. The middleware currently uses `req.get`,
`res.set` and `res.get`, which are Express-only, and `express` is a peer.

Moving to `IncomingMessage` and `ServerResponse` with `req.headers` and
`res.setHeader` makes the package work under Fastify and lets the `express` peer
go. It also means #28's and #30's landed fixes must be re-expressed against raw
headers.

Remaining #33 cleanups, all independent and low-risk:

- `CORRELATION_CONFIG_TOKEN` namespacing. If it becomes a symbol it must be
  `Symbol.for()`. A bare `Symbol()` is not stable across duplicate module copies
  and would reintroduce exactly the hazard #32 removes. With #32's single build
  the risk is gone either way, so a plain namespaced string is fine.
- Lazy generator, so `randomUUID` is not called at module load.
- `vite.config.ts` coverage `include` is too broad.
- The changelog narrative left in `index.ts:6-9`.

## #34: tests

No e2e tests exist; only two `.spec.ts` unit files. Needs `@nestjs/testing` plus
`supertest`, asserting:

- header casing on the wire, post-#28
- a genuine request-scope test — the current two-module test does not exercise
  scope
- `withCorrelation` coverage, which has none
- that a singleton holding `HttpService` is constructed once across requests,
  the regression guard for #31
- `onModuleInit` fires, the other #31 symptom

## Migration

| Before | After |
| --- | --- |
| `require('@evanion/nestjs-correlation-id')` | ESM `import` only |
| NestJS 10 or 11 | NestJS 12 |
| Node 18 | Node 20 |
| `CorrelationService` request-scoped | singleton over `AsyncLocalStorage` |
| `module.resolve(CorrelationService, contextId)` | `module.get(CorrelationService)` |
| `express` peer required for middleware types | platform-neutral, peer optional or removed |
