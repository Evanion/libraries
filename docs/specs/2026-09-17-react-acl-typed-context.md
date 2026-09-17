# Carrying the typed builder's types through `@evanion/react-acl`

Status: proposed
Packages: `@evanion/react-acl`. `@evanion/acl` is read and not changed.
Depends on: `libs/react-acl/src/index.tsx` (the whole file),
`libs/acl/src/hydrate-policy.ts:297-359` (`Access<Sub, R>`, whose method
declarations decide § 1), `libs/acl/src/authoring.ts:156-163` (`Policy<Sub, R>`,
which accumulates `R` one `.for()` at a time),
`docs/specs/2026-09-17-acl-no-cascade.md` decisions 12, 21 and 22 (which built
the generic `Access` and the `build()` terminal this change consumes),
`apps/docs/content/react-acl/api.mdx:42-60` (the section that documents the gap),
`libs/react-widget/src/widget.tsx:51` (`createWidgets`, read and rejected as a
precedent in § 4).
Measured against: `origin/docs/react-acl-section` at `1378bfe`, which is PR #232
on top of `origin/feat/acl` at `ccefa5a`. TypeScript 6.0.3, `--strict`. Every
compile result below was run against that tree in this session.

## What is actually wrong

The brief said the typed access object is rejected by the provider's prop:
`policy<Shopper>().for<'listing', Listing>(…).build()` returns
`Access<Shopper, Record<'listing', Listing>>`, `PolicyProviderProps.access` is
declared `Access`, and a `can` accepting only `'listing'` is not assignable to
one accepting any string.

**That half does not reproduce.** Compiled against this tree:

```tsx
const typed = policy<Shopper>()
  .for<'listing', Listing>('listing', (p) => …)
  .build();

const a: Access = typed;                                  // compiles
const b: Access<Shopper, Record<'listing', Listing>> = wide; // also compiles
<PolicyProvider access={typed} subject={me} />;           // compiles
```

`Access` declares `can`, `canMany`, `canFields` and `capabilities` with method
syntax (`hydrate-policy.ts:308-331`). Method parameters are compared bivariantly,
and `strictFunctionTypes` does not change that for methods. So the two
instantiations are mutually assignable, in both directions, and nothing is
rejected at the provider or anywhere else.

**The defect is that nothing is rejected.** This compiles today:

```tsx
function Row() {
  return useCan('lsiting', 'update').allowed; // typo, no error
}
```

`useCan` takes `key: string` and `object?: Record<string, unknown>`
(`index.tsx:85-89`). The subject is `Subject`, so `Shopper.tier` is invisible to
a provider that has one. A consumer who authored a typed policy gets a
compile-time check at `policy()` and loses it at every hook in the tree. The
policy's whole claim is that a key is a key you declared, and the React binding
is where that claim stops holding.

So the change is the one the brief asked for and the reason for it is the
opposite of the one given. Nothing has to be unblocked. Something has to start
failing.

The second thing wrong is `api.mdx:53-56`, which documents the premise:

> `access` is the untyped `Access` the core's `hydratePolicy` returns.
> `policy<Subject>()` returns a narrower `Access` bound to the subject and object
> types it was built with, which does not satisfy this prop; hydrate the built
> policy's `matrix` to cross that, which is what a browser does in any case.

The clause after the semicolon describes a workaround for a compile error that
does not happen. It goes.

## Decisions

1. **`createPolicyContext(access)` is added, and it is the only new export.** It
   takes an `Access<Sub, R>`, infers both parameters from it, and returns
   `{ PolicyProvider, useCan, useCanMany, useCanFields, useCapabilities }` with
   `Sub` and `R` closed over. The caller names neither parameter and restates
   nothing. § 2 is the compile.
2. **It exists because a React context cannot carry a type parameter.** A
   component may be generic and infer `Sub` and `R` from its `access` prop at the
   JSX site. `createContext` produces a `Context<T>` for one fixed `T`, and
   `useContext(PolicyContext)` returns that `T` whatever the provider above it
   inferred. The types have to be bound where the provider and the hooks are
   created together, and a function that creates both is the only construct that
   does that. § 3 compiles the alternative and shows what the call sites become.
3. **The standalone `PolicyProvider`, `useCan`, `useCanMany`, `useCanFields` and
   `useCapabilities` keep their current signatures, exactly.** A browser that
   calls `hydratePolicy(matrix)` imports them, passes no type argument, calls no
   factory, and compiles against this change as it compiled before it. This is
   additive: no existing call site changes and nothing is deprecated.
4. **Each `createPolicyContext` call creates its own React context.** Two typed
   policies in one tree each check against their own keys, and the inner one does
   not silently retype the outer one's hooks. This is the property module
   augmentation cannot have (§ 4) and the reason the factory is worth its weight.
5. **The bound provider renders the shared provider too, so the untyped hooks
   keep working underneath it.** A component written against `useCan` from the
   package root reads the same decision whether the tree above it was mounted by
   the bound provider or the standalone one. Without this a consumer who adopts
   the factory breaks every third-party component that took the untyped import.
   One `useMemo` produces one context value and both providers publish it.
6. **The bound provider's `access` prop is optional and defaults to the access
   the factory was given.** The document is app-scoped and the subject is
   request-scoped, so the common mount is `<PolicyProvider subject={me}>`. The
   prop stays, typed `Access<Sub, R>`, because a per-tenant matrix and the
   browser's rehydrated copy are both documents a caller has to be able to hand
   in. Decision 9 is why the rehydrated copy fits the prop.
7. **`useCapabilities` keeps returning `Record<string, Decision>` in the bound
   form.** `capabilities` is keyed by permission key, `'listing.update'`, and `R`
   holds object kinds, `'listing'`. The key set is the cross product of kinds and
   actions, and actions are plain strings that the builder never collects
   (`authoring.ts` keeps them on `Draft.action` and nothing types them). Nothing
   in `R` can narrow this, and a narrowing derived from kinds alone would be
   wrong rather than loose.
8. **The bound hooks take `Partial<R[K]>` for the object, matching `Access`.** A
   list row carrying `{ id, sellerId }` and no more is the case `unevaluable`
   answers, and `hydrate-policy.ts:253-260` already settled that the object
   parameter is partial while the subject is complete. The React binding repeats
   that decision rather than making its own.
9. **A wide `Access` satisfies the bound provider's prop, and that is on
   purpose.** The SSR crossing is `hydratePolicy(JSON.parse(…))`, which returns
   `Access<Subject, AnyObjects>` and cannot return anything else: the matrix is
   JSON and the types were erased when it was serialized. Method bivariance means
   that value is assignable to `Access<Sub, R>` with no cast (§ 1), so the
   crossing needs no new API. The keys the hooks check come from the factory's
   argument, not from the prop, and the document the browser holds is
   non-authoritative in any case (§ 6).
10. **The factory is named for what it makes.** It creates a context and returns
    the provider and hooks bound to it. `bindPolicy` was considered and rejected
    because an implementation that only re-typed the existing hooks would have had
    to share one context, which loses decision 4.
11. **`api.mdx:53-56` loses the workaround paragraph** and the section documents
    the prop it has. The factory is documented on `api.mdx` and taught on
    `getting-started.mdx` after the hydrate path, which stays the page's spine.

Decision 4 is the one that decides the shape. Decision 5 is the one that would
have been a silent break. Decision 9 is the one that had to be compiled rather
than assumed, and it is the same bivariance that hid the defect in the first
place.

## 1. What the compiler actually says about the two instantiations

`Access.can` is declared as a method:

```ts
can<K extends keyof R & string>(
  subject: Sub,
  key: K,
  action: string,
  object?: Partial<R[K]>,
  now?: Instant,
): Decision;
```

Method syntax opts the parameters into bivariance. TypeScript compares the two
signatures by relating them in both directions and accepting either, so
`key: 'listing'` against `key: string` passes, and `subject: Shopper` against
`subject: Subject` passes. `strictFunctionTypes` narrows property declarations
written with an arrow type; it exempts methods by design, and every member of
`Access` is a method.

The consequence for this change is decision 9: the JSON crossing needs no cast
and no second prop type. The consequence for the brief is that the defect had to
be restated. A check that is never made is harder to see than a check that
fails, which is why `api.mdx` wrote it up as a compile error and why nothing in
`types.test-d.tsx` caught it: the file asserts that
`PolicyProviderProps['access']` equals `Access` (`:36`), which is true and is the
problem.

## 2. The factory, compiled

Written against this tree and compiled clean with `--strict`:

```tsx
const shop = policy<Shopper>()
  .for<'listing', Listing>('listing', (p) =>
    p.allow('update', p.eq('object.sellerId', 'subject.id')),
  )
  .build();

const { PolicyProvider, useCan } = createPolicyContext(shop);
```

No type argument is written. `Sub` is `Shopper` and `R` is
`Record<'listing', Listing>`, both read off the argument. Then, each asserted
with `@ts-expect-error`:

| Call site                                                              | Result                   |
| ---------------------------------------------------------------------- | ------------------------ |
| `useCan('listing', 'update', { sellerId: 'u1' })`                      | compiles                 |
| `useCan('lsiting', 'update')`                                          | rejected, unknown key    |
| `useCan('listing', 'update', { sellerid: 'u1' })`                      | rejected, unknown field  |
| `<PolicyProvider subject={{ id, roles }} />`                           | rejected, `tier` missing |
| `<PolicyProvider access={hydrated} subject={me} />`                    | compiles, the crossing   |
| `createPolicyContext(hydratePolicy(doc)).useCan('anything', 'at-all')` | compiles                 |

The last row is the untyped path taken through the factory. `hydratePolicy` with
no type arguments returns `Access<Subject, AnyObjects>`, `keyof R & string` is
`string`, and the bound hooks are the wide hooks. A consumer who has no typed
policy gains nothing from the factory and loses nothing by using it, which is
what makes decision 3 cheap: the two paths are one implementation at two
instantiations.

The object case wants one note. `Listing` has to be declared without an index
signature for the misspelled field to be caught. `interface Listing extends
Record<string, unknown>` accepts `sellerid` and every other key, and the check
disappears. That is a property of the type the consumer writes, not of this
design, and `getting-started.mdx` should show a plain interface.

## 3. A generic provider, and why the hooks cannot read it

The first alternative: leave one context, make `PolicyProvider` generic, and let
each hook call site say which policy it means.

The provider half works. Compiled:

```tsx
function PolicyProvider<Sub, R>({ access, subject, children }: {
  access: Access<Sub, R>; subject: Sub; children?: ReactNode;
}) { … }

<PolicyProvider access={shop} subject={me} />  // Sub and R inferred here
```

The hook half has nowhere to get them. `const Ctx = createContext<Value | null>`
fixes `Value` when the module loads, and `useContext(Ctx)` returns `Value` inside
a tree the generic provider mounted with `Shopper` and `Record<'listing',
Listing>`. The inference happened at the JSX site and there is no channel from
there to a hook called four components down. Nothing about React's context API
carries it: the context object is a value, its type parameter is fixed at
creation, and a hook's only input is that object and its own arguments.

So the types have to be restated at each hook. Two forms, both compiled:

```tsx
// naming the policy forces naming the key: TypeScript has no partial
// type-argument inference
useCanA<typeof shop, 'listing'>('listing', 'update');

// or curry, and pay a second call at every call site
const can = useCanB<typeof shop>();
can('listing', 'update');
```

The first restates the key as a type argument and as a value, which is a check
that checks the argument against itself. The second works and costs a line and a
local in every component that asks a question. Both put the policy's identity in
the component instead of in the tree, which is the thing a provider exists to
avoid.

The same no-partial-inference rule is why `policy<Sub>()` is a call returning a
builder rather than `policy<Sub>(config)` (`authoring.ts:283-290`). This package
meets the rule at the same place for the same reason.

## 4. Module augmentation, and what the second policy costs

The second alternative: one global declaration, the way React Router's typegen
registers route types.

```ts
// the library declares
export interface Register {}
type Registered = Register extends { policy: Access<infer Sub, infer R> }
  ? { sub: Sub; objects: R }
  : { sub: Subject; objects: AnyObjects };

// the app declares, once
declare module '@evanion/react-acl' {
  interface Register {
    policy: typeof shop;
  }
}
```

**It works, and it is the best call sites of the three.** Compiled against this
tree: `useCan('listing', 'update', { sellerId })` passes, `useCan('lsiting', …)`
is rejected, a subject missing `tier` is rejected, and no call site writes a type
argument, a factory or a destructure. A consumer adds four lines once and every
existing `useCan` in the codebase starts checking. The brief's read that most
apps have exactly one policy is correct, and for those apps this is less API than
decision 1 and less code at the mount.

It is rejected for what happens when the program holds two. `Register` is one
interface, so a second `policy` member is a second declaration of the same
property. Measured, with two augmentations in one program:

```
error TS2717: Subsequent property declarations must have the same type.
  Property 'policy' must be of type 'Access<Admin, Record<"ticket", Ticket>>',
  but here has type 'Access<Shopper, Record<"listing", Listing>>'.
error TS2345: Argument of type '"listing"' is not assignable to parameter of
  type '"ticket"'.
```

The second error is the one that matters. The first policy's call sites break,
in files that declared nothing, because a different file in the same program
registered a different policy. The failure lands away from its cause.

Three consequences follow from that, and each is a case this library has to
serve:

- **A library cannot ship a policy.** A component package that authors its own
  policy and augments `Register` takes the single slot, and every application
  that installs it loses its own. There is no second slot and no way to scope
  one. A library that wants two policies cannot have one.
- **A monorepo that type-checks two apps together gets whichever augmentation
  loaded.** The repository this lives in is exactly that shape.
- **Every untyped call site in the program narrows.** A component written
  against `useCan(key: string, …)` and passing a key from a variable stops
  compiling when an application it has never heard of registers a policy. The
  augmentation reaches code that did not opt in, which is the inverse of
  decision 3.

React Router can take this trade because a program has one router and typegen
writes the declaration from files on disk. A policy is a value a consumer
constructs, an application may hold more than one, and nothing generates the
declaration. The conditions that make the pattern safe there are absent here.

## 5. Why `createWidgets` is not the argument

`createWidgets({ components })` (`react-widget/src/widget.tsx:51`) infers a
registry once and carries it into the `Widgets` component and `defineItems`, and
it is the closest thing in this repository to decision 1. It is not the reason
for decision 1, and the spec should not lean on it.

`createWidgets` is a factory for a reason this package does not share, stated in
its own doc comment: "There is no provider and no hook, because React's
`react-server` export condition has neither `createContext` nor `useContext`".
It returns a component because it cannot return a context. `@evanion/react-acl`
is a `'use client'` module (`index.tsx:1`) and has both. Its reason is the one in
decision 2, which is about what a context can carry rather than about what is
importable.

The two landing on the same shape is a coincidence worth one sentence and no
weight. If `createContext` could take a type parameter per subtree, this package
would not have a factory and `react-widget` would still have one.

## 6. What this does not change about the boundary

A decision in a browser toggles what a reader sees. It refuses nothing. The
server that owns the data evaluates the same policy again, against a subject it
resolved itself, and trusts nothing the client sent.

Typing the keys does not move that line, and it is worth saying where it could be
misread. The check decision 1 adds is a compile-time check over the key a
developer wrote. It says the key exists in the policy the factory was handed. It
says nothing about the document the provider was given at runtime, which arrived
as JSON, which the browser cannot authenticate, and which a user can edit. A
`useCan('listing', 'update')` that compiles and answers `allowed` is a claim
about what to render.

The one shape a reader might take the wrong way is decision 9. A wide `Access`
satisfying a bound provider's prop means the types at the hooks are the factory's
types while the document is whatever was passed. Those two can disagree, at
runtime, with no error: a matrix missing `listing.update` answers
`unknown-action` from a `useCan('listing', 'update')` that compiled. That is the
correct outcome. The alternative is refusing the crossing the docs teach as
normal, to protect a guarantee the browser could not have had.

## 7. The surface after

```ts
// unchanged, and what the hydrate path imports
function PolicyProvider(props: PolicyProviderProps): ReactElement;
function useCan(
  key: string,
  action: string,
  object?: Record<string, unknown>,
): Decision;
function useCanMany(
  key: string,
  action: string,
  objects: readonly Record<string, unknown>[],
): Decision[];
function useCanFields(
  key: string,
  action: string,
  object: Record<string, unknown>,
  axis: 'read' | 'write',
  proposed?: Record<string, unknown>,
): FieldDecision;
function useCapabilities(): Record<string, Decision>;

// added
function createPolicyContext<Sub, R>(
  access: Access<Sub, R>,
): PolicyContext<Sub, R>;

interface PolicyContext<Sub, R> {
  PolicyProvider(props: BoundPolicyProviderProps<Sub, R>): ReactElement;
  useCan<K extends keyof R & string>(
    key: K,
    action: string,
    object?: Partial<R[K]>,
  ): Decision;
  useCanMany<K extends keyof R & string>(
    key: K,
    action: string,
    objects: readonly Partial<R[K]>[],
  ): Decision[];
  useCanFields<K extends keyof R & string>(
    key: K,
    action: string,
    object: Partial<R[K]>,
    axis: 'read' | 'write',
    proposed?: Partial<R[K]>,
  ): FieldDecision;
  useCapabilities(): Record<string, Decision>;
}

interface BoundPolicyProviderProps<Sub, R> {
  access?: Access<Sub, R>;
  subject: Sub;
  context?: { now?: Instant };
  children?: ReactNode;
}
```

One added function, two added types. The memo keys, the error a hook throws
outside a provider, and the `now` default are the existing ones: the bound hooks
and the standalone hooks are the same bodies, and the factory instantiates them
at narrower types.

## Testing

- `types.test-d.tsx`: `useCan('lsiting', 'update')` from a bound context is
  refused with `@ts-expect-error`, and `useCan('listing', 'update')` from the
  same context compiles. Those two are the change. Everything else in the file is
  supporting.
- `types.test-d.tsx`: `createPolicyContext(shop)` written with no type argument,
  asserting `Sub` and `R` through a call rather than through `expectTypeOf`, so
  the test fails if inference starts needing a restatement.
- `types.test-d.tsx`: the existing assertions on `PolicyProviderProps` stay
  unchanged and unmoved. They are the regression guard for decision 3, and they
  pass today, which is the point.
- `types.test-d.tsx`: a misspelled field on the object argument is refused, and
  the same field on an object declared `extends Record<string, unknown>` is
  accepted. The second half is written so the § 2 note about index signatures is
  a fact in the suite rather than a paragraph.
- `types.test-d.tsx`: a wide `Access` passed to a bound provider compiles. This
  is decision 9, it rests on method bivariance, and a TypeScript release that
  changed that would break the SSR crossing silently.
- `index.test.tsx`: a component calling the untyped `useCan` inside a bound
  provider gets the same decision as the same component inside the standalone
  provider. This is decision 5 and it is the one a refactor would drop.
- `index.test.tsx`: two `createPolicyContext` calls nested in one tree, each
  hook reading its own provider's access. This is decision 4 at runtime; § 4
  argues it at the type level and the runtime half is what makes the argument
  worth anything.
- `index.test.tsx`: the bound provider mounted without `access`, deciding
  against the factory's argument, and mounted with one, deciding against that.
  Decision 6.
- `examples.test.tsx` already executes every region the docs transclude, so a
  new region for the factory is covered by the existing suite rather than by a
  new one.

## Where I am guessing

- That the brief's compile error was never observed. I reproduced the assignment
  and the JSX both ways on TypeScript 6.0.3 and they compile, and `api.mdx`
  documents the error as fact. Either it was true on an earlier TypeScript, or
  `Access` was a property-typed interface when the paragraph was written, or the
  paragraph was reasoned rather than run. I did not check the history to find
  out, and the fix is the same either way.
- That one policy per tree is common and two is rare. § 4 rejects module
  augmentation on the second case, and I have no instance of it in this
  repository: `apps/docs` holds one matrix. The argument rests on a library
  shipping a policy, which is a shape nobody here has built yet.
- That decision 6's optional `access` is worth the divergence between the two
  provider prop types. A consumer reading `api.mdx` meets `access` required in
  one section and optional in the next, and the reason is a sentence. Making it
  required in both is one word and loses the shortest mount.
- That the untyped hooks stay used. Decision 3 keeps them because the docs teach
  the hydrate path as normal and a browser cannot produce a typed `Access`. If
  every consumer ends up importing the typed policy module for its types, the
  standalone hooks become the internals of the factory and the export is dead
  weight. I would rather find that out from a consumer than guess it now.
- That `useCapabilities` should stay wide. Decision 7 says actions are not
  collected anywhere, and that is true of the builder as it stands. A later
  change that typed actions on `.allow()` would make a narrower return possible,
  and this decision would deserve re-opening rather than carrying forward.
