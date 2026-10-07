# @evanion/feature

**Dependency-aware feature flags: a feature whose parent resolves off resolves off with it.**

> **Not on npm yet.** `package.json` carries `private: true`, so a release run
> versions and tags the package without publishing it, and
> `npm install @evanion/feature` does not resolve until the first version is
> published by hand. See [RELEASING.md](../../RELEASING.md).

Express pickup only exists inside the new checkout, so a customer who gets express pickup without the new checkout sees a broken page. `@evanion/feature` resolves a feature off whenever a feature it depends on resolves off, so no feature is ever on without its prerequisites.

## Flags that depend on other flags

Baize offers express pickup inside the new checkout, and demo night booking inside express pickup. With independent flags, every component that renders the booking repeats the whole chain:

```tsx
if (flags.newCheckout && flags.expressPickup && flags.demoNightBooking) {
  return <DemoNightBooking />;
}
```

Turn the new checkout off, and every component that left one of those checks out still offers the booking.

## The cascade

`@evanion/feature` takes a dependency graph. If a parent feature resolves off, all of its dependants resolve off with it, transitively, on the same call. Nothing is written back into your configuration.

## What it does

- Dependencies are transitive. If express pickup depends on the new checkout, and demo night booking on express pickup, turning off the new checkout takes both off.
- Rollouts hash the customer's id, so one customer gets the same answer in every session and every service.
- Variants split customers across named versions of a feature by relative weight.
- A rule can open or close a feature at an ISO 8601 instant, such as `2026-10-01T00:00:00Z`.
- A rule can match any field of the context you pass, such as a role.
- The core imports no framework, so the same store runs in an API, a build script, or under the `@evanion/feature/react` provider.

## Installation

```bash
npm install @evanion/feature
```

The package needs Node 20 or later and ships ES modules. It has two entry points. `@evanion/feature` is the core and imports no framework. `@evanion/feature/react` carries the provider and hooks, is client code, and needs React 18 or 19, an optional peer dependency.

## Beyond the basics

A feature moves from booksellers only to every customer through rules, rollouts and variants. The sections below also cover:

- `plan()`, which splits features into those a build can resolve and those deferred to the request.
- Variant pinning, which overrides the weights for a matching rule, such as pinning booksellers to the `blue` variant.
- Sticky assignments, which hand back an assignment your application stored, so a customer keeps a variant when you change the weights.
- The `observe` callback, which reports each decision the store made for a request.

## Rolling Out by Date and Share

A rule can combine a time window with a percentage rollout. Express pickup below is offered only to a customer the new checkout is already on for:

`cust-0042` and `cust-0107` differ because the 25% rollout put them in different buckets, and the answer for each is the same on every request. Without the cascade, a quarter of customers would get the new checkout and all of them would get its pickup option.

## Writing Definitions

A feature is stored intent. `createFeatures` validates the dependency graph, deep-clones and freezes your definitions, and returns the store. Your own array stays editable:

Dependencies are transitive and one-way, and a definition may name a feature declared after it. A feature that is off takes every feature behind it along and leaves the feature it depends on alone:

### Configuration Errors

`createFeatures` refuses a broken graph at construction. Every error it throws extends `FeatureConfigError`, and `resolve`, `plan` and `toggle` never throw:

### Rules and Conditions

Rules are OR-ed, the conditions inside one rule are AND-ed, and a rollout is one more conjunct of the rule that carries it:

A condition over a field the context does not carry never holds, the negative operators included. `ne` on an absent field is unevaluable, so it is false:

A time window's string has to name one instant on every host: a date-time carrying `Z` or an offset, or a date with no time, which ECMA-262 fixes to UTC. `createFeatures` refuses the rest:

### Typing the Keys and the Variants

A store built from an array literal needs no type argument. When your configuration arrives as JSON, or from a variable typed `FeatureDefinition<Flag>[]`, name a schema:

## Reading a Decision

`resolve` returns one decision per feature. `enabled` is the decision, and everything else explains it:

| `reason`          | Meaning                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `default-on`      | enabled, no rules                                                 |
| `rule-match`      | enabled, a rule matched; carries `rule`                           |
| `explicitly-off`  | `enabled === false`                                               |
| `no-rule-matched` | enabled, rules present, none passed; carries a per-rule breakdown |
| `dependency-off`  | a parent resolved off; carries `blockedBy` and `cause`            |

`reason` is output only. Nothing in this library reads it back to decide anything.

One `resolve` per request answers every flag on the page:

`blockedBy` names the immediate parent and `cause` the first ancestor that is off for a reason of its own. Down a chain the two differ:

A `no-rule-matched` decision carries one outcome per rule. A condition that failed is named in `failed`, and a rollout that left the customer out reports its numbers in `rollout`:

## Toggling and Inspecting the Store

`toggle` is the only writer. It sets `enabled` on the stored definition and reports which dependants went off with it:

`willDisable` lists only the dependants that were on and are now off, and it is empty when enabling. A key the store was not built with returns a result and never throws:

The store also answers what it holds:

## Rollouts

A rollout's answer is a pure hash of a seed and the customer's bucketing value, so the same customer gets the same answer in every process:

The bucket does not depend on the percentage, so raising a percentage only adds members:

The seed defaults to the feature key, which puts one customer in unrelated buckets for two features:

`by` names the context field a rollout buckets on, and `seed` replaces the feature key as the hash seed. Gift cards below take the new checkout's seed, so they reach the same customers the new checkout's 25% does:

A context with no value for `by` is outside every rollout, even at 100%. A `percent` of `0` includes nobody:

The primitives work without a store, for snapshot tests or for asking which customers a rollout reaches:

## Variants

A feature can resolve to more than on and off. It can split its subjects across named variants:

Weights are relative and normalised across the set, so `3` and `1` split 75%/25% and never have to sum to 100:

`order` fixes a variant's position in the bucketing walk. Without it the array index decides, so a control plane that reorders the array reassigns a subject. With it, the same reorder moves nobody:

`variantSeed` defaults to `${seed ?? key}:variant`, a value distinct from the rollout's own seed. The same seed on both correlates the two: every member of a 50% rollout falls below the same 0.5 boundary a 50/50 split uses, so all of them get the control:

A rule can pin a variant, overriding the weights entirely:

`stickyVariants` holds a prior assignment, keyed by feature, that your application stored. A stored entry naming a declared variant wins over the weights:

With no sticky entry and no usable value for `variantBy`, the subject takes the control, the first variant in bucketing order, and `assignment.source` reads `'fallback'`:

`variant`, `value` and `assignment` are absent on a feature that resolves off:

## Build-time Planning

`plan()` partitions every feature into resolvable now and deferred, for a build that does not have the whole evaluation context. A build that renders one page per game knows the game and not the customer:

A rule the context already refutes needs nothing more. Conditions within a rule are AND-ed, so one failing condition settles the rule whatever an absent field holds:

`plan()` withholds `now` from a feature's rules unless the feature sets `freezeTimeAtBuild`, so a window stays deferred even when the build's clock is past it:

A planned breakdown names a failed condition only where every request would name the same one. Where `plan()` stepped over a condition it could not read, the outcome names the rule and drops `failed`:

`plan()` settles enablement and the variant split separately. A deferred entry still carries a `decision` when only the split is outstanding:

The two halves of a plan go to different places. The settled decisions ship with the build, and the deferred keys are what the request still resolves:

## Observing

An application installs one observer at construction. The store calls it once for each `resolve`, `plan` and `toggle` call, and for each `isEnabled` call on a configured key, with the value that call returned. `variantOf` and `valueOf` report nothing:

`isEnabled` resolves every feature to answer about one, and it reports the one decision the caller received:

An observer changes no outcome. The engine never awaits it, and an observer that throws or rejects reaches `onObserveError` while the caller keeps the value the entry point computed:

An event carries no `EvaluationContext`. It carries a subject identifier copied out as a primitive, and `correlateBy` names the context field it is read off, defaulting to `targetingKey`:

Because the engine never awaits an observer, an asynchronous transport buffers events and drains them at a concurrency the application controls:

This seam does not record exposure. `resolve` decides every configured feature, so an observer fired from it records an exposure for every feature the request never rendered. The application records exposure where it renders, off the decision `useFeature` already holds:

The server render ran no effect, so it recorded nothing. The browser runs `useEffect` when it mounts the button, and that is the exposure.

## React

`FeatureProvider` resolves a store once for a context and hands the decisions to every hook below it:

Resolution is memoised on the `context` object's identity, so a component that builds the context holds it in a `useMemo`:

`useFeature` and `useVariant` throw for a key the provider does not carry, so a typo never reads as a feature that is off. `isEnabled` on the store answers `false` for the same key:

`decisions` hands the provider a record resolved elsewhere. The provider uses that record as it is and resolves nothing beside it, so a key missing from the record throws:

`createFeatureContext` binds the provider and hooks to one store's schema, so a misspelled key is a compile error and `useVariant` answers the variant union that store declares:

`FeatureProvider` uses `createContext` and `useMemo`, so it is client code. The core is not. Resolve in a Server Component and hand the decisions down. They are plain objects, so they cross the boundary as serialised props:

The full API reference and the guides are at [docs.evanion.com/feature](https://docs.evanion.com/feature).

## License

MIT
