# Feature Observation Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An application installs one observer at construction and receives one event per public entry point call, carrying the value that call returned. The observer may read and may never change an outcome.

**Architecture:** `createFeatures` takes a second optional parameter holding the observer and its settings. A private emit helper calls the observer, attaches a rejection handler to anything thenable, never awaits, and routes a throw or a rejection to `onObserveError` or to a local warning. `resolve`, `isEnabled`, `plan` and `toggle` each emit once, naming the entry point the application called. The internal resolutions inside `isEnabled` and `toggle` emit nothing, which an internal un-emitting function gives them.

**Tech Stack:** TypeScript 6.0.3, Vitest with `typecheck`, Nx.

**Spec:** `docs/specs/2026-09-23-feature-observation-seam.md`. Read its decisions and § 1 through § 6 before starting. § 1 argues why exposure tracking is not what this seam carries, and that argument decides the event set.

## Two reconciliations the spec needs

The spec predates the schema typing that landed in #330.

Its event shapes name `Decisions<F>`, `Decision<F>` and `Plan<F>`. Those are now `Decisions<S>`, `Decision<F, V, T>` and `Plan<S>`. Every event type in this plan uses the current names.

Its signature sketch shows one `createFeatures`. There are now two overloads and an implementation signature, so the options parameter goes on all three. The spec claims "TypeScript resolves those two overloads on the type-argument count, so a second value parameter disturbs neither". Task 1 proves that before anything depends on it.

## Global Constraints

- The package is unpublished. Any signature may change and no migration is owed.
- An observer may read what an entry point returned and may never change an outcome. Decision 5 of `docs/specs/2026-09-11-feature-toggles.md` says the store holds intent and resolution is computed on read and never written back, and an observer that alters a decision breaks that.
- One event per public entry point call. `resolve` emits one event holding every decision. No entry point emits one event per feature.
- The internal resolutions inside `isEnabled` and `toggle` emit nothing. `toggle` compares two resolutions to compute `willDisable`, so its silence is load-bearing.
- The observer signature is `(event) => void | Promise<unknown>`. The engine attaches a rejection handler to a thenable and never awaits it. An observer that blocks turns observability into an availability incident: a decision costs 0.58 microseconds at one feature and an audit transport can cost 40 milliseconds.
- An event carries no `EvaluationContext`. It carries the settled instant, the returned value, and a subject identifier copied out as a primitive.
- Evaluation performs no network call, and this seam does not change that.
- Tests are `*.spec.ts` beside the source; type tests are `*.test-d.ts` and the `typecheck` block in `libs/feature/vite.config.ts` runs them.
- `repo-checks` enforces a blank line before the first `expect` in a case that arranges anything above it.
- Prose in doc comments, `.mdx` and commit messages: no em-dashes, no "X rather than Y", no "instead of", no bold lead-ins, every sentence names who or what does the thing, no gerund phrase as a subject, no metaphor verb for a technical fact, no three-item rhythmic lists.
- CI runs `npx prettier --check .` as its own job.

## Review Focus

- `isEnabled` must emit one `is-enabled` event and its internal resolution must emit nothing. A double emit is the defect this design exists to avoid, and a suite that counts events without naming them would not see it. Pinned in Task 3, Step 7.
- `toggle` must emit one event and its two internal resolutions must emit nothing, and `willDisable` must still be correct afterwards. The comparison at `features.ts:164` reads both resolutions, so a change that silences them by skipping them breaks the write. Pinned in Task 4, Step 5.
- An observer that throws synchronously, and one that returns a rejected promise, must both leave the entry point's return value untouched and must not reach the caller. Pinned in Task 2, Step 9.
- An observer must not be able to mutate a decision that a later call reads. The engine deep-freezes the returned value when an observer is installed, which makes the readonly event type true at runtime for a JavaScript caller. Pinned in Task 5, Step 5.
- Installing no observer must cost nothing measurable. The freeze is conditional for that reason, measured at 15 to 18 microseconds against a 20 to 22 microsecond bare call. Pinned in Task 5, Step 7.

---

### Task 1: Prove the options parameter, then add the types

**Files:**

- Create: `libs/feature/src/lib/observe.ts`
- Create: `libs/feature/src/lib/observe.test-d.ts`
- Modify: `libs/feature/src/lib/features.ts` (signatures only)
- Modify: `libs/feature/src/index.ts`

**Interfaces:**

- Consumes: `Decisions`, `Decision`, `Plan`, `ToggleResult`, `Schema`, `FeatureKey` from `types.js`.
- Produces: `FeatureEvent`, `FeatureOptions`, and a `createFeatures` that accepts a second argument and ignores it.

The spec claims a second value parameter disturbs neither overload. Prove it before writing anything that depends on it. The two overloads resolve on type-argument count today. A second value parameter interacts with the `const` type parameter on the inferring overload, and that interaction is worth a compiler run.

- [ ] **Step 1: Probe the overload resolution**

Write a throwaway `.ts` file at the repository root, importing the real `createFeatures`, and compile it with `./node_modules/.bin/tsc --ignoreConfig --noEmit --strict --target es2022 --module esnext --moduleResolution bundler <file>`. Check four calls, asserting each with a strict type-equality helper and not with error text, because tsc's printer widens a literal union in this position:

```ts
type Exact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
const ok = <T extends true>(_: T) => {};
```

1. `createFeatures(defs)` with a literal still infers the variant union.
2. `createFeatures(defs, {})` with a literal still infers the variant union.
3. `createFeatures<MySchema>(defs)` still selects the explicit overload.
4. `createFeatures<MySchema>(defs, {})` still selects the explicit overload.

Report the compiler output for all four. If any degrades, stop and report it: the spec's claim is wrong and the shape needs a ruling before this task continues.

- [ ] **Step 2: Write the failing type test**

Create `libs/feature/src/lib/observe.test-d.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';
import { createFeatures } from './features.js';
import type { FeatureEvent } from './observe.js';

const defs = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
] as const;

describe('the options parameter', () => {
  it('leaves inference alone', () => {
    const features = createFeatures(defs, { observe: () => {} });

    expectTypeOf(features.variantOf('cta')).toEqualTypeOf<
      'control' | 'blue' | undefined
    >();
  });

  it('takes an observer returning nothing and one returning a promise', () => {
    createFeatures(defs, { observe: () => {} });
    createFeatures(defs, { observe: async () => {} });
  });
});

describe('FeatureEvent', () => {
  it('discriminates on type', () => {
    const read = (event: FeatureEvent) => {
      if (event.type === 'is-enabled') return event.key;
      if (event.type === 'resolve') return event.decisions;
      if (event.type === 'plan') return event.plan;
      return event.result;
    };

    expectTypeOf(read).toBeCallableWith({
      type: 'toggle',
      at: new Date(),
      result: { ok: false, key: 'cta', error: 'unknown-feature' },
    });
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx nx test feature -- observe`
Expected: FAIL, `./observe.js` does not exist.

- [ ] **Step 4: Write the event and options types**

Create `libs/feature/src/lib/observe.ts`:

```ts
import type {
  Decision,
  Decisions,
  FeatureKey,
  Plan,
  Schema,
  ToggleResult,
} from './types.js';

/**
 * What an entry point reports after it answered.
 *
 * One event per public call, carrying the value the caller received. `resolve`
 * reports every decision in one event, and no entry point reports one event per
 * feature. An auditor reading a `resolve` event knows the application asked for
 * every feature, and an auditor reading an `is-enabled` event knows it asked for
 * one.
 *
 * No event carries an `EvaluationContext`. An event carries the instant the
 * call settled on, the value it returned, and a subject identifier copied out
 * as a primitive.
 */
export type FeatureEvent<S extends Schema = Schema> =
  | {
      type: 'resolve';
      at: Date;
      decisions: Decisions<S>;
      subject?: string | number;
      version?: string;
    }
  | {
      type: 'is-enabled';
      at: Date;
      key: keyof S & FeatureKey;
      decision: Decision<keyof S & FeatureKey>;
      subject?: string | number;
      version?: string;
    }
  | {
      type: 'plan';
      at: Date;
      plan: Plan<S>;
      subject?: string | number;
      version?: string;
    }
  | {
      type: 'toggle';
      at: Date;
      result: ToggleResult<keyof S & FeatureKey>;
      subject?: string | number;
      version?: string;
    };

/** What an application installs at construction. */
export interface FeatureOptions<S extends Schema = Schema> {
  /**
   * Called once per public entry point call. The engine never awaits it.
   *
   * An observer that blocks turns an observability feature into an availability
   * incident. A decision costs under a microsecond and an audit transport on a
   * bad day costs forty milliseconds, so the engine attaches a rejection
   * handler to anything thenable and moves on.
   */
  observe?: (event: FeatureEvent<S>) => void | Promise<unknown>;
  /** Reports an observer that threw or rejected. Replaces the default warning. */
  onObserveError?: (error: unknown, event: FeatureEvent<S>) => void;
  /**
   * The context field whose value identifies the subject on an event. Defaults
   * to `targetingKey`. An application bucketing on a raw identifier points this
   * at a field carrying a pseudonym.
   */
  correlateBy?: string;
  /** The configuration version an event reports. */
  version?: string;
}
```

- [ ] **Step 5: Add the parameter to all three signatures**

In `libs/feature/src/lib/features.ts`, add `options?: FeatureOptions<...>` as a second parameter to both overloads and to the implementation signature. Do not read it yet. The implementation signature's schema parameter is the loose one it already uses.

- [ ] **Step 6: Run the type test**

Run: `npx nx test feature -- observe`
Expected: PASS.

- [ ] **Step 7: Export the two types**

In `libs/feature/src/index.ts`, export `FeatureEvent` and `FeatureOptions` as types, in alphabetical order in the existing block. `doc-export-coverage` will name them; add them to the allowance beside the existing type entries.

- [ ] **Step 8: Run the package suite and commit**

Run: `npx nx test feature && npx nx test repo-checks && npx nx build feature`

```bash
git add libs/feature/src/lib/observe.ts libs/feature/src/lib/observe.test-d.ts \
  libs/feature/src/lib/features.ts libs/feature/src/index.ts \
  tools/repo-checks/src/doc-export-coverage-allowance.json
git commit -m "feat(feature): declare what an observer receives"
```

---

### Task 2: The emit helper

**Files:**

- Modify: `libs/feature/src/lib/observe.ts`
- Create: `libs/feature/src/lib/observe.spec.ts`

**Interfaces:**

- Consumes: `FeatureEvent`, `FeatureOptions` from Task 1.
- Produces: `createEmitter(options)`, returning a function that takes an event and returns nothing.

This task builds the machinery and tests it directly, with no entry point wired. Wiring is Tasks 3 and 4.

- [ ] **Step 1: Write the failing test**

Create `libs/feature/src/lib/observe.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createEmitter } from './observe.js';
import type { FeatureEvent } from './observe.js';

const event: FeatureEvent = {
  type: 'toggle',
  at: new Date(0),
  result: { ok: false, key: 'cta', error: 'unknown-feature' },
};

describe('createEmitter', () => {
  it('returns a function that does nothing when no observer is installed', () => {
    const emit = createEmitter({});

    expect(() => emit(event)).not.toThrow();
  });

  it('calls the observer with the event', () => {
    const observe = vi.fn();
    const emit = createEmitter({ observe });

    emit(event);

    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(event);
  });

  it('returns before an async observer settles', async () => {
    let settled = false;
    const emit = createEmitter({
      observe: async () => {
        await Promise.resolve();
        settled = true;
      },
    });

    emit(event);

    expect(settled).toBe(false);
    await Promise.resolve();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx nx test feature -- observe.spec`
Expected: FAIL, `createEmitter` is not exported.

- [ ] **Step 3: Write the minimal emitter**

Add to `libs/feature/src/lib/observe.ts`:

```ts
export function createEmitter<S extends Schema>(
  options: FeatureOptions<S>,
): (event: FeatureEvent<S>) => void {
  const observe = options.observe;
  if (!observe) return () => {};
  return (event) => {
    observe(event);
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx nx test feature -- observe.spec`
Expected: PASS.

- [ ] **Step 5: Write the failing test for a synchronous throw**

Append to the `describe` block:

```ts
it('swallows a synchronous throw and reports it', () => {
  const onObserveError = vi.fn();
  const emit = createEmitter({
    observe: () => {
      throw new Error('transport down');
    },
    onObserveError,
  });

  expect(() => emit(event)).not.toThrow();
  expect(onObserveError).toHaveBeenCalledTimes(1);
  expect(onObserveError.mock.calls[0]?.[1]).toBe(event);
});

it('swallows a rejected promise and reports it', async () => {
  const onObserveError = vi.fn();
  const emit = createEmitter({
    observe: () => Promise.reject(new Error('transport down')),
    onObserveError,
  });

  emit(event);
  await Promise.resolve();
  await Promise.resolve();

  expect(onObserveError).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 6: Run and confirm they fail**

Run: `npx nx test feature -- observe.spec`
Expected: FAIL. The throw escapes and the rejection is unhandled.

- [ ] **Step 7: Handle both failures**

```ts
export function createEmitter<S extends Schema>(
  options: FeatureOptions<S>,
): (event: FeatureEvent<S>) => void {
  const observe = options.observe;
  if (!observe) return () => {};

  const report = (error: unknown, event: FeatureEvent<S>) => {
    if (options.onObserveError) {
      options.onObserveError(error, event);
      return;
    }
    warnOnce(error);
  };

  return (event) => {
    try {
      const returned = observe(event);
      if (isThenable(returned)) {
        returned.then(undefined, (error: unknown) => {
          report(error, event);
        });
      }
    } catch (error) {
      report(error, event);
    }
  };
}
```

Write `isThenable` as a local type guard reading `typeof value.then === 'function'` off an object, so a non-promise thenable is handled and a plain return value is not.

Write `warnOnce` as a module-local function that reports through `console.warn` the first time and stays silent afterwards, naming the package and saying that an observer failed and that `onObserveError` replaces this warning. One process should not flood a log because one transport is down.

- [ ] **Step 8: Run the tests**

Run: `npx nx test feature -- observe.spec`
Expected: PASS.

- [ ] **Step 9: Write the isolation test**

Append:

```ts
it('hands the caller its value whatever the observer does', () => {
  const emit = createEmitter({
    observe: () => {
      throw new Error('transport down');
    },
    onObserveError: () => {},
  });
  const value = { ok: true };

  emit(event);

  expect(value).toEqual({ ok: true });
});

it('warns once across several failures when no handler is supplied', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const emit = createEmitter({
    observe: () => {
      throw new Error('transport down');
    },
  });

  emit(event);
  emit(event);
  emit(event);

  expect(warn).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});
```

`warnOnce` holds module state, so this test and any other reading it must reset that state. Export a test-only reset, or structure `warnOnce` so the emitter owns the flag per instance. Choose one, say which in your report, and make the suite order-independent either way.

- [ ] **Step 10: Run everything and commit**

Run: `npx nx test feature && npx nx test repo-checks`

```bash
git add libs/feature/src/lib/observe.ts libs/feature/src/lib/observe.spec.ts
git commit -m "feat(feature): call an observer without letting it break a decision"
```

---

### Task 3: Wire `resolve` and `isEnabled`

**Files:**

- Modify: `libs/feature/src/lib/features.ts`
- Test: `libs/feature/src/lib/observe.spec.ts`

**Interfaces:**

- Consumes: `createEmitter` from Task 2.
- Produces: `resolve` and `isEnabled` each emitting once.

Read `features.ts` in full. `resolve` is the public entry point and `isEnabled` calls it at `:178` and reads one key. Both must emit, each naming itself, and `isEnabled`'s internal resolution must emit nothing.

The shape that gives you this: an internal un-emitting resolution that both public entry points wrap. Name it so a reader can tell it from the public one.

- [ ] **Step 1: Write the failing test**

Append to `observe.spec.ts` a new `describe` for the wired entry points:

```ts
describe('resolve and isEnabled', () => {
  const defs = [
    { key: 'cta', enabled: true },
    { key: 'nav', enabled: true },
  ] as const;

  it('emits one resolve event carrying every decision', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    features.resolve({ targetingKey: 'u1' });

    expect(observe).toHaveBeenCalledTimes(1);
    const event = observe.mock.calls[0]?.[0];
    expect(event.type).toBe('resolve');
    expect(Object.keys(event.decisions)).toEqual(['cta', 'nav']);
  });

  it('emits one is-enabled event naming the key the caller asked for', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    features.isEnabled('cta', { targetingKey: 'u1' });

    expect(observe).toHaveBeenCalledTimes(1);
    const event = observe.mock.calls[0]?.[0];
    expect(event.type).toBe('is-enabled');
    expect(event.key).toBe('cta');
    expect(event.decision.key).toBe('cta');
  });
});
```

- [ ] **Step 2: Run and confirm both fail**

Run: `npx nx test feature -- observe.spec`
Expected: FAIL, the observer is never called.

- [ ] **Step 3: Split the resolution**

Extract the body of `resolve` into an internal function that emits nothing. `resolve` calls it and emits a `resolve` event. `isEnabled` calls it, reads its key, and emits an `is-enabled` event carrying that one decision.

- [ ] **Step 4: Run the tests**

Run: `npx nx test feature -- observe.spec`
Expected: PASS.

- [ ] **Step 5: Carry the instant and the subject**

Every event carries `at`, the instant the call settled on, which `withNow` already computes at `features.ts:104-107`. Read it from there and do not call the clock a second time, so an event and the decision it reports agree.

Every event carries `subject`, read from `context[options.correlateBy ?? 'targetingKey']` and copied when it is a string or a number. A value of any other type leaves `subject` absent.

Every event carries `version` when `options.version` is set.

- [ ] **Step 6: Test all three**

Write a case asserting `at` equals the `now` a caller passed, one asserting `subject` reads the bucketing field, one asserting a custom `correlateBy` reads its named field, one asserting an object-valued field leaves `subject` absent, and one asserting `version` appears when configured.

- [ ] **Step 7: Test the silence**

```ts
it('emits nothing from the resolution isEnabled runs internally', () => {
  const observe = vi.fn();
  const features = createFeatures(defs, { observe });

  features.isEnabled('cta', { targetingKey: 'u1' });

  // One event, not two. A resolve event here would tell an auditor the
  // application asked about every feature when it asked about one.
  expect(observe).toHaveBeenCalledTimes(1);
  expect(observe.mock.calls[0]?.[0].type).toBe('is-enabled');
});
```

Counting alone would not catch a double emit that replaced one event with another, so this case names the type as well as the count.

- [ ] **Step 8: Run everything and commit**

Run: `npx nx test feature && npx nx test repo-checks`

```bash
git add libs/feature/src/lib/features.ts libs/feature/src/lib/observe.spec.ts
git commit -m "feat(feature): report what resolve and isEnabled answered"
```

---

### Task 4: Wire `plan` and `toggle`

**Files:**

- Modify: `libs/feature/src/lib/features.ts`
- Test: `libs/feature/src/lib/observe.spec.ts`

**Interfaces:**

- Consumes: everything from Task 3.
- Produces: `plan` and `toggle` each emitting once, with `toggle`'s two internal resolutions silent.

`toggle` at `features.ts:142-168` resolves twice, at `:156` and `:160`, and compares the two at `:164` to compute `willDisable`. Those two resolutions are machinery for one write. Silencing them must not skip them.

- [ ] **Step 1: Write the failing test**

```ts
describe('plan and toggle', () => {
  const defs = [
    { key: 'parent', enabled: true },
    { key: 'child', enabled: true, dependsOn: ['parent'] },
  ] as const;

  it('emits one plan event carrying the partition', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    features.plan({ targetingKey: 'u1' });

    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls[0]?.[0].type).toBe('plan');
  });

  it('emits one toggle event and nothing from its two resolutions', () => {
    const observe = vi.fn();
    const features = createFeatures(defs, { observe });

    features.toggle('parent', false, { targetingKey: 'u1' });

    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls[0]?.[0].type).toBe('toggle');
  });
});
```

- [ ] **Step 2: Run and confirm they fail**

Run: `npx nx test feature -- observe.spec`

- [ ] **Step 3: Wire both**

`plan` emits one event carrying the `Plan` it returns. `toggle` emits one event carrying the `ToggleResult` it returns, and both its internal resolutions go through the un-emitting function from Task 3.

- [ ] **Step 4: Run the tests**

Run: `npx nx test feature -- observe.spec`
Expected: PASS.

- [ ] **Step 5: Test that silencing did not break the write**

```ts
it('still reports which dependants a toggle will disable', () => {
  const observe = vi.fn();
  const features = createFeatures(defs, { observe });

  const result = features.toggle('parent', false, { targetingKey: 'u1' });

  // The two resolutions toggle compares are silent, and they still run. A
  // change that silenced them by skipping them would empty this list.
  expect(result.ok).toBe(true);
  expect(result.ok && result.willDisable).toEqual(['child']);
});

it('reports the same willDisable with no observer installed', () => {
  const observed = createFeatures(defs, { observe: () => {} });
  const plain = createFeatures(defs);

  const a = observed.toggle('parent', false, { targetingKey: 'u1' });
  const b = plain.toggle('parent', false, { targetingKey: 'u1' });

  expect(a).toEqual(b);
});
```

- [ ] **Step 6: Test a toggle that fails**

`toggle` returns `{ ok: false, error: 'unknown-feature' }` for a key nobody configured. Confirm that still emits one event carrying that result, since an auditor wants the refused write as much as the accepted one.

- [ ] **Step 7: Run everything and commit**

Run: `npx nx test feature && npx nx test repo-checks`

```bash
git add libs/feature/src/lib/features.ts libs/feature/src/lib/observe.spec.ts
git commit -m "feat(feature): report a plan and a toggle once each"
```

---

### Task 5: Freeze what an observer can reach

**Files:**

- Modify: `libs/feature/src/lib/features.ts`
- Test: `libs/feature/src/lib/observe.spec.ts`

**Interfaces:**

- Consumes: everything from Task 4.
- Produces: an entry point that deep-freezes its return value when an observer is installed.

Decision 9. The event types are readonly, and a JavaScript caller ignores a readonly type. The freeze makes the type true at runtime.

It is conditional because it costs. A measurement on an M1 Pro put `deepFreeze` at 15 to 18 microseconds against a bare `resolve` of 20 to 22 microseconds for 40 features. A store with no observer pays none of it.

The package already has `deepFreeze` at `features.ts:56-61`, used on the configuration at construction.

- [ ] **Step 1: Write the failing test**

```ts
describe('what an observer can reach', () => {
  const defs = [{ key: 'cta', enabled: true }] as const;

  it('hands the observer a frozen value', () => {
    let seen: unknown;
    const features = createFeatures(defs, {
      observe: (event) => {
        seen = event.type === 'resolve' ? event.decisions : undefined;
      },
    });

    features.resolve({ targetingKey: 'u1' });

    expect(Object.isFrozen(seen)).toBe(true);
  });

  it('refuses a write an observer attempts', () => {
    const features = createFeatures(defs, {
      observe: (event) => {
        if (event.type !== 'resolve') return;
        // A readonly type stops a TypeScript caller. The freeze stops the rest.
        expect(() => {
          (event.decisions.cta as { enabled: boolean }).enabled = false;
        }).toThrow();
      },
    });

    const decisions = features.resolve({ targetingKey: 'u1' });

    expect(decisions.cta.enabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run and confirm they fail**

Run: `npx nx test feature -- observe.spec`

- [ ] **Step 3: Freeze conditionally**

Freeze the value an entry point returns when an observer is installed, before emitting. Every entry point returns the frozen value, so a caller and an observer hold the same object and neither can edit it.

- [ ] **Step 4: Run the tests**

Run: `npx nx test feature -- observe.spec`
Expected: PASS.

- [ ] **Step 5: Test that a later call is unaffected**

```ts
it('lets no observer change what a later call answers', () => {
  const features = createFeatures(
    [
      { key: 'parent', enabled: true },
      { key: 'child', enabled: true, dependsOn: ['parent'] },
    ] as const,
    {
      observe: (event) => {
        if (event.type !== 'resolve') return;
        try {
          (event.decisions.parent as { enabled: boolean }).enabled = false;
        } catch {
          // a frozen object refuses in strict mode, which is what we want
        }
      },
    },
  );

  features.resolve({ targetingKey: 'u1' });
  const second = features.resolve({ targetingKey: 'u1' });

  expect(second.child.enabled).toBe(true);
});
```

- [ ] **Step 6: Confirm no observer means no freeze**

```ts
it('leaves the value unfrozen when nobody is observing', () => {
  const features = createFeatures(defs);

  const decisions = features.resolve({ targetingKey: 'u1' });

  // The freeze exists to make the event's readonly type true. A store with no
  // observer pays none of its cost.
  expect(Object.isFrozen(decisions)).toBe(false);
});
```

- [ ] **Step 7: Measure the cost and record it**

Write a throwaway script, outside the repository, resolving a 40-feature store 500 times after a 50-iteration warm-up, with and without an observer installed. Report both numbers and the ratio in your report. Delete the script.

If the observed path costs more than roughly twice the unobserved one, say so and stop: the freeze is the suspect and the plan wants a ruling before it continues.

- [ ] **Step 8: Run everything and commit**

Run: `npx nx test feature && npx nx test repo-checks`

```bash
git add libs/feature/src/lib/features.ts libs/feature/src/lib/observe.spec.ts
git commit -m "feat(feature): freeze what an observer holds"
```

---

### Task 6: The documentation

**Files:**

- Create: `apps/docs/content/feature/observing.mdx`
- Modify: `apps/docs/content/feature/_meta.ts`
- Modify: `apps/docs/content/feature/api.mdx`
- Modify: `libs/feature/README.md`

**Interfaces:**

- Consumes: the whole seam.
- Produces: a page a reader can follow.

Read `apps/docs/content/feature/variants.mdx` for the shape a page takes here, and its doctested regions in `libs/feature/README.md` for how a value on a page stays true.

- [ ] **Step 1: Write the page**

`observing.mdx` covers, in this order: what an observer is and where it installs; the four events and what each one names; that an observer never awaits and never changes an outcome; what happens when one throws; `correlateBy` and what reaches an event; and the section that matters most, why exposure tracking is not what this seam carries.

That last section is the one a reader most needs and most easily misreads. `resolve` decides every configured feature, so an observer firing from it records exposures for features nobody rendered. Say it plainly, say the application records exposure at the render site off the decision it already holds, and point at the variants page for what a decision carries.

- [ ] **Step 2: List the page**

In `_meta.ts`, add `observing: 'Observing'` after `build-time`. A reader meets it once they know what a decision is and how one is planned. Extend the file's doc comment to say why it sits there, matching the reasoning already written for the other entries.

- [ ] **Step 3: Doctest every value**

Any event object a page prints comes from a run and sits in an `@import.meta.vitest` region in the README, the way the variants values do. A page value outside a region drifts silently; `doc-fence.test.ts` ratchets the count of unexplained fences in the section, so a plain fence carrying a computed value fails the build.

- [ ] **Step 4: Update the API reference**

`api.mdx` gains `FeatureEvent` and `FeatureOptions` in its type list, and the `createFeatures` signature gains its second parameter.

- [ ] **Step 5: Run everything**

Run: `npx nx affected -t test lint build --base=main`
Then: `npx prettier --check` on every file you touched.
Expected: PASS. `docs-navigation` fails on a `_meta.ts` key with no page behind it, and `doc-exports` fails on a fence importing a name the package does not export.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/content/feature libs/feature/README.md
git commit -m "docs(feature): document what an observer sees"
```
