# Feature Rule Ids Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the positional rule-id fallback in `@evanion/feature` with a content hash, so a rule keeps its name when the rule list is edited or a rollout is ramped.

**Architecture:** Two new modules under `libs/feature/src/lib/`. `canonical.ts` renders a value as text with object keys sorted, ported from `libs/acl/src/canonical.ts`. `rule-id.ts` derives an id from a rule's canonical text with FNV-1a, ported from `libs/acl/src/rule-id.ts` and adapted: there are no allow and deny sides here, a rule carries a `rollout`, and `rollout.percent` is excluded from the hash so an operator moving a ramp does not rename the rule. `evaluate.ts` stops threading an array index through `evaluateRule`.

**Tech Stack:** TypeScript 6.0.3, Vitest, Nx. Tests are `*.spec.ts` beside the source, which is this package's convention (`libs/acl` uses `*.test.ts`; do not copy that).

**Spec:** GitHub issue #245 and its two comments, which carry the resolution. `docs/specs/2026-09-23-feature-observation-seam.md` § 7 states why the seam depends on this. `docs/specs/2026-09-23-feature-config-distribution.md` decision 5 states how a control plane's assigned id interacts with the hash.

## Global Constraints

- The package is unpublished (`private: true`, 404 on npm). No migration path is owed to anyone and any existing signature may change.
- Evaluation is synchronous. Web Crypto's `digest` returns a promise, so the hash is FNV-1a and not a cryptographic digest. No security property rests on the cost of finding a second rule that hashes the same.
- An explicit `rule.id` always wins over a derived one.
- The hash covers a rule's `when` conditions and its rollout's `by` and `seed`. It excludes `rollout.percent`.
- Array order inside a condition value is preserved and never sorted. `in: ['a','b']` and `in: ['b','a']` are different documents.
- Object keys are sorted, so a producer in another language emitting the same rule with its keys in a different order derives the same id.
- Derived ids carry a `rule-` prefix, so a reader can tell a derived id from an authored one.
- Documentation values come from a run, never from reading the implementation.
- Prose in any `.mdx` or doc comment this plan touches: no em-dashes, no "X rather than Y" or "instead of", no bold lead-ins on paragraphs, every sentence names who or what does the thing.

## Review Focus

- A rule with neither `when` nor `rollout` hashes over empty text, and two such rules in one feature derive the same id. They decide identically, so a decision naming either names the rule that decided. Pinned in Task 2, Step 9.
- `rollout.percent` changing must leave the id alone, and `rollout.by` or `rollout.seed` changing must change it. Pinned in Task 2, Step 7.
- One instant written three ways (`Date`, ISO string, epoch milliseconds) must derive one id, because a producer in another language emits epoch milliseconds where a hand-authored document holds a `Date`. Pinned in Task 2, Step 11.
- An author writing `id: 'rule-deadbeef'`, which looks derived, still wins. Nothing detects or resolves a collision with a derived id. Pinned in Task 2, Step 13.
- `fnv1a` reads `charCodeAt`, which walks UTF-16 code units, so a condition value holding an emoji or any non-BMP character fixes the cross-language contract at UTF-16 and not at UTF-8. A Swift or Kotlin port matches code units. Pinned in Task 2, Step 15.

---

### Task 1: Canonical text

**Files:**

- Create: `libs/feature/src/lib/canonical.ts`
- Test: `libs/feature/src/lib/canonical.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `export function canonical(value: unknown): string`

`libs/feature/src/lib/canonical.ts` is a port of `libs/acl/src/canonical.ts`. Read that file before starting. `docs/specs/2026-09-23-feature-config-distribution.md` decision 4 needs the same function for `configDigest`, which is why this lands as its own module and not as a private helper inside `rule-id.ts`.

- [ ] **Step 1: Write the failing test**

Create `libs/feature/src/lib/canonical.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canonical } from './canonical.js';

describe('canonical', () => {
  it('sorts object keys', () => {
    expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }));
  });

  it('preserves array order', () => {
    expect(canonical(['a', 'b'])).not.toBe(canonical(['b', 'a']));
  });

  it('drops an undefined property', () => {
    expect(canonical({ a: 1, b: undefined })).toBe(canonical({ a: 1 }));
  });

  it('writes a date as its ISO string', () => {
    expect(canonical(new Date(0))).toBe('"1970-01-01T00:00:00.000Z"');
  });

  it('writes null', () => {
    expect(canonical(null)).toBe('null');
  });

  it('separates a nested object from a string that spells it', () => {
    expect(canonical({ a: { b: 1 } })).not.toBe(canonical({ a: '{"b":1}' }));
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx nx test feature -- canonical`
Expected: FAIL, "Cannot find module './canonical.js'".

- [ ] **Step 3: Write the implementation**

Create `libs/feature/src/lib/canonical.ts`:

```ts
/**
 * Canonical text for a value, with object keys in sorted order.
 *
 * Two documents differing only in key order or in whitespace state one
 * configuration. A rule id derived from the text of one must agree with a rule
 * id derived from the text of the other, and a producer in another language
 * emits its keys in whatever order its serializer chose.
 *
 * Array order is preserved. `in: ['a', 'b']` and `in: ['b', 'a']` test the same
 * membership, and sorting them here would claim a semantic equality this
 * function does not generally have. A document that reorders a list is a
 * document somebody edited.
 *
 * `undefined` properties are dropped, so an absent key and a key written as
 * `undefined` agree. A JSON document carries no `undefined`, and a document
 * built in memory can.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, each]) => each !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, each]) => `${JSON.stringify(key)}:${canonical(each)}`).join(',')}}`;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx nx test feature -- canonical`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add libs/feature/src/lib/canonical.ts libs/feature/src/lib/canonical.spec.ts
git commit -m "feat(feature): render a value as text with its keys in sorted order"
```

---

### Task 2: The rule id

**Files:**

- Create: `libs/feature/src/lib/rule-id.ts`
- Test: `libs/feature/src/lib/rule-id.spec.ts`

**Interfaces:**

- Consumes: `canonical(value: unknown): string` from Task 1.
- Produces: `export function ruleId(rule: Rule): string`

Read `libs/acl/src/rule-id.ts` before starting. Three things differ. This package has no allow and deny sides, so the prefix is a flat `rule-`. A `Rule` here carries a `rollout`, which the hash covers except for its `percent`. A `DayOfWeekCondition` carries a `zone`, which `libs/acl` has no equivalent of.

The condition shapes are at `libs/feature/src/lib/types.ts:21-47`: `WindowCondition` is `{ field: 'now', op: 'before' | 'after', value: Instant }`, `DayOfWeekCondition` is `{ field: 'now', op: 'day-of-week', zone: string, value: readonly Weekday[] }`, and `AttributeCondition` is `{ field: string, op: 'eq' | 'ne' | 'in' | 'not-in' | 'contains', value: unknown }`. `Instant` at `:16` is `string | number | Date`.

- [ ] **Step 1: Write the failing test for an explicit id**

Create `libs/feature/src/lib/rule-id.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ruleId } from './rule-id.js';
import type { Rule } from './types.js';

describe('ruleId', () => {
  it('returns an explicit id unchanged', () => {
    expect(ruleId({ id: 'staff-only', when: [] })).toBe('staff-only');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx nx test feature -- rule-id`
Expected: FAIL, "Cannot find module './rule-id.js'".

- [ ] **Step 3: Write the minimal implementation**

Create `libs/feature/src/lib/rule-id.ts`:

```ts
import type { Rule } from './types.js';

export function ruleId(rule: Rule): string {
  if (rule.id !== undefined) return rule.id;
  return 'rule-00000000';
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx nx test feature -- rule-id`
Expected: PASS, 1 test.

- [ ] **Step 5: Write the failing test for insertion and reordering**

Append to the `describe` block in `libs/feature/src/lib/rule-id.spec.ts`:

```ts
it('derives the same id for one rule wherever it sits in a list', () => {
  const rule: Rule = { when: [{ field: 'role', op: 'eq', value: 'staff' }] };
  const other: Rule = { when: [{ field: 'plan', op: 'eq', value: 'pro' }] };

  const before = [rule, other].map((each) => ruleId(each));
  const after = [other, rule].map((each) => ruleId(each));

  expect(before[0]).toBe(after[1]);
  expect(before[1]).toBe(after[0]);
});

it('derives different ids for rules with different conditions', () => {
  const a = ruleId({ when: [{ field: 'role', op: 'eq', value: 'staff' }] });
  const b = ruleId({ when: [{ field: 'role', op: 'eq', value: 'admin' }] });
  expect(a).not.toBe(b);
});

it('derives the same id whatever order a producer wrote the keys in', () => {
  const a = ruleId({ when: [{ op: 'eq', value: 'staff', field: 'role' }] });
  const b = ruleId({ when: [{ field: 'role', op: 'eq', value: 'staff' }] });
  expect(a).toBe(b);
});

it('prefixes a derived id so a reader can tell it from an authored one', () => {
  expect(ruleId({ when: [] })).toMatch(/^rule-[0-9a-f]{8}$/);
});
```

- [ ] **Step 6: Run the tests and confirm four fail**

Run: `npx nx test feature -- rule-id`
Expected: FAIL. The reorder test passes by accident because every rule currently returns one constant; the two "different" assertions fail.

- [ ] **Step 7: Write the failing test for the rollout**

Append to the same `describe` block:

```ts
it('leaves the id alone when an operator moves a ramp', () => {
  const at20 = ruleId({ rollout: { percent: 20 } });
  const at30 = ruleId({ rollout: { percent: 30 } });
  expect(at20).toBe(at30);
});

it('changes the id when the bucketing field changes', () => {
  const byDefault = ruleId({ rollout: { percent: 20 } });
  const byAccount = ruleId({ rollout: { percent: 20, by: 'accountId' } });
  expect(byDefault).not.toBe(byAccount);
});

it('changes the id when the rollout seed changes', () => {
  const unseeded = ruleId({ rollout: { percent: 20 } });
  const seeded = ruleId({ rollout: { percent: 20, seed: 'autumn' } });
  expect(unseeded).not.toBe(seeded);
});

it('separates a rule with a rollout from one without', () => {
  expect(ruleId({ rollout: { percent: 20 } })).not.toBe(ruleId({}));
});
```

- [ ] **Step 8: Run the tests and confirm the rollout tests fail**

Run: `npx nx test feature -- rule-id`
Expected: FAIL on the three "not.toBe" rollout assertions.

- [ ] **Step 9: Write the failing test for an unconditional rule**

Append to the same `describe` block:

```ts
it('derives one id for two rules that both match unconditionally', () => {
  expect(ruleId({})).toBe(ruleId({}));
});

it('reads an absent when and an empty when as the same rule', () => {
  expect(ruleId({})).toBe(ruleId({ when: [] }));
});
```

- [ ] **Step 10: Run the tests and confirm they pass**

Run: `npx nx test feature -- rule-id`
Expected: These two PASS against the constant implementation. They are the property this task must not lose.

- [ ] **Step 11: Write the failing test for instant spellings**

Append to the same `describe` block:

```ts
it('derives one id for one instant written three ways', () => {
  const asDate = ruleId({
    when: [{ field: 'now', op: 'after', value: new Date(1767225600000) }],
  });
  const asIso = ruleId({
    when: [{ field: 'now', op: 'after', value: '2026-01-01T00:00:00.000Z' }],
  });
  const asEpoch = ruleId({
    when: [{ field: 'now', op: 'after', value: 1767225600000 }],
  });

  expect(asIso).toBe(asDate);
  expect(asEpoch).toBe(asDate);
});

it('separates two different instants', () => {
  const early = ruleId({
    when: [{ field: 'now', op: 'after', value: 1767225600000 }],
  });
  const late = ruleId({
    when: [{ field: 'now', op: 'after', value: 1767225600001 }],
  });
  expect(early).not.toBe(late);
});

it('separates a before window from an after window', () => {
  const before = ruleId({
    when: [{ field: 'now', op: 'before', value: 1767225600000 }],
  });
  const after = ruleId({
    when: [{ field: 'now', op: 'after', value: 1767225600000 }],
  });
  expect(before).not.toBe(after);
});

it('reads the zone of a day-of-week condition', () => {
  const stockholm = ruleId({
    when: [
      {
        field: 'now',
        op: 'day-of-week',
        zone: 'Europe/Stockholm',
        value: ['mon'],
      },
    ],
  });
  const tokyo = ruleId({
    when: [
      { field: 'now', op: 'day-of-week', zone: 'Asia/Tokyo', value: ['mon'] },
    ],
  });
  expect(stockholm).not.toBe(tokyo);
});
```

- [ ] **Step 12: Run the tests and confirm the instant tests fail**

Run: `npx nx test feature -- rule-id`
Expected: FAIL on the three "not.toBe" assertions.

- [ ] **Step 13: Write the failing test for an authored id that looks derived**

Append to the same `describe` block:

```ts
it('returns an authored id that looks derived', () => {
  expect(ruleId({ id: 'rule-deadbeef', when: [] })).toBe('rule-deadbeef');
});
```

- [ ] **Step 14: Run the test and confirm it passes**

Run: `npx nx test feature -- rule-id`
Expected: PASS. Nothing detects a collision between an authored id and a derived one, and this test records that the author wins.

- [ ] **Step 15: Write the failing test for the cross-language contract**

Append to the same `describe` block:

```ts
it('derives a stable id for a non-BMP condition value', () => {
  const rule: Rule = { when: [{ field: 'tag', op: 'eq', value: '🎯' }] };
  // Pinned so a Swift or Kotlin port has a value to match. `fnv1a` walks
  // UTF-16 code units, so a surrogate pair contributes two of them.
  expect(ruleId(rule)).toBe(ruleId(rule));
  expect(ruleId(rule)).toMatch(/^rule-[0-9a-f]{8}$/);
});
```

- [ ] **Step 16: Run the test and confirm it passes**

Run: `npx nx test feature -- rule-id`
Expected: PASS.

- [ ] **Step 17: Write the full implementation**

Replace `libs/feature/src/lib/rule-id.ts` with:

```ts
import { canonical } from './canonical.js';
import type { Condition, Instant, Rule } from './types.js';

/** Epoch milliseconds, so one instant written three ways reads as one value. */
function instantText(value: Instant): string {
  if (value instanceof Date) return String(value.getTime());
  if (typeof value === 'number') return String(value);
  const parsed = Date.parse(value);
  // An unparseable string is a configuration error the conditions module
  // reports. Here it hashes as itself, so two rules holding it agree.
  return Number.isNaN(parsed) ? canonical(value) : String(parsed);
}

/** One condition as text, with its keys in a fixed order. */
function conditionText(condition: Condition): string {
  const { field, op } = condition;
  if (op === 'day-of-week') {
    return `${field}${op}${condition.zone}${canonical(condition.value)}`;
  }
  if (field === 'now') {
    return `${field}${op}${instantText(condition.value as Instant)}`;
  }
  return `${field}${op}${canonical(condition.value)}`;
}

/**
 * The rollout as text, without its percentage.
 *
 * `by` and `seed` decide which subjects a rule can reach. `percent` decides how
 * many of them it reaches now, and an operator moving it is running the same
 * rule harder. Hashing the percentage renames the rule on every ramp, and an
 * event stream from before the ramp then joins to nothing after it.
 *
 * The consequence: two rollout rules on one feature whose conditions match and
 * whose `by` and `seed` match derive one id. An author separates them with an
 * explicit `rule.id`.
 */
function rolloutText(rule: Rule): string {
  if (!rule.rollout) return '';
  const { by, seed } = rule.rollout;
  return `r${canonical({ by, seed })}`;
}

/**
 * FNV-1a, 32 bits, over text.
 *
 * Not a cryptographic digest: evaluation is synchronous and Web Crypto's
 * `digest` returns a promise. A rule id names a rule in a decision and in a
 * log, and no security property rests on the difficulty of finding a second
 * rule that hashes the same.
 *
 * `charCodeAt` walks UTF-16 code units, which fixes the cross-language
 * contract. An implementation in another language matches code units.
 */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * The id a rule carries into a `Decision`. An explicit `rule.id` wins.
 *
 * The fallback is derived from what the rule matches on, so it survives a rule
 * being inserted above it, the list being reordered, a ramp being moved, and
 * the same document being emitted by a producer in another language. A
 * positional `#0` survives none of those, and a log line holding one means
 * something different once the list moves on.
 *
 * A control plane that assigns an id at rule creation writes it as `rule.id`
 * and this derivation never runs. See
 * `docs/specs/2026-09-23-feature-config-distribution.md` decision 5.
 *
 * An author who wants a name in a log writes `id: 'staff-only'`, which reads
 * better than a hash and is what the docs recommend.
 */
export function ruleId(rule: Rule): string {
  if (rule.id !== undefined) return rule.id;
  const text =
    (rule.when ?? []).map(conditionText).join('') + rolloutText(rule);
  return `rule-${fnv1a(text)}`;
}
```

- [ ] **Step 18: Run the whole file and confirm every test passes**

Run: `npx nx test feature -- rule-id`
Expected: PASS, 16 tests.

- [ ] **Step 19: Commit**

```bash
git add libs/feature/src/lib/rule-id.ts libs/feature/src/lib/rule-id.spec.ts
git commit -m "feat(feature): name a rule by what it matches on"
```

---

### Task 3: Wire it into evaluation

**Files:**

- Modify: `libs/feature/src/lib/evaluate.ts:17-19` (the `ruleId` function), `:46-51` (`evaluateRule`'s signature), `:53` (the `ruleId` call), `:170` and `:255` (the two `evaluateRule` call sites)
- Modify: `libs/feature/src/lib/types.ts:68` (the `Rule.id` doc comment)
- Test: `libs/feature/src/lib/features.spec.ts`

**Interfaces:**

- Consumes: `ruleId(rule: Rule): string` from Task 2.
- Produces: `evaluateRule<F extends FeatureKey>(definition: FeatureDefinition<F>, rule: Rule, context: EvaluationContext): RuleOutcome`. The `index: number` parameter is gone. Task 4 and every later plan call it with three arguments.

Read `libs/feature/src/lib/evaluate.ts` fully before starting. The local `ruleId` at `:17-19` is the only reader of `evaluateRule`'s `index` parameter, so removing one removes the other.

- [ ] **Step 1: Write the failing test**

Append to `libs/feature/src/lib/features.spec.ts`, inside the existing top-level `describe`:

```ts
it('names a rule by its content when a rule is inserted above it', () => {
  const before = createFeatures([
    {
      key: 'k',
      enabled: true,
      rules: [{ when: [{ field: 'role', op: 'eq', value: 'staff' }] }],
    },
  ]);
  const after = createFeatures([
    {
      key: 'k',
      enabled: true,
      rules: [
        { when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
        { when: [{ field: 'role', op: 'eq', value: 'staff' }] },
      ],
    },
  ]);

  const beforeId = before.resolve({ role: 'staff' }).k.rule;
  const afterId = after.resolve({ role: 'staff' }).k.rule;

  expect(beforeId).toMatch(/^rule-[0-9a-f]{8}$/);
  expect(afterId).toBe(beforeId);
});

it('names every rule in a breakdown by its content', () => {
  const features = createFeatures([
    {
      key: 'k',
      enabled: true,
      rules: [
        { when: [{ field: 'role', op: 'eq', value: 'staff' }] },
        { id: 'named', when: [{ field: 'plan', op: 'eq', value: 'pro' }] },
      ],
    },
  ]);

  const decision = features.resolve({ role: 'customer', plan: 'free' }).k;

  expect(decision.reason).toBe('no-rule-matched');
  expect(decision.rules?.[0]?.rule).toMatch(/^rule-[0-9a-f]{8}$/);
  expect(decision.rules?.[1]?.rule).toBe('named');
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx nx test feature -- features`
Expected: FAIL. The received value is `'#0'`, which does not match `/^rule-[0-9a-f]{8}$/`.

- [ ] **Step 3: Replace the local generator**

In `libs/feature/src/lib/evaluate.ts`, delete lines 17 to 19:

```ts
function ruleId(rule: Rule, index: number): string {
  return rule.id ?? `#${index}`;
}
```

Add to the import block at the top of the file, after the `conditions.js` import:

```ts
import { ruleId } from './rule-id.js';
```

- [ ] **Step 4: Drop the index parameter from `evaluateRule`**

In the same file, change `evaluateRule`'s signature and its first statement from:

```ts
export function evaluateRule<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  rule: Rule,
  index: number,
  context: EvaluationContext,
): RuleOutcome {
  const id = ruleId(rule, index);
```

to:

```ts
export function evaluateRule<F extends FeatureKey>(
  definition: FeatureDefinition<F>,
  rule: Rule,
  context: EvaluationContext,
): RuleOutcome {
  const id = ruleId(rule);
```

- [ ] **Step 5: Update the two call sites**

In `decide`, change:

```ts
  for (const [index, rule] of rules.entries()) {
    const outcome = evaluateRule(definition, rule, index, context);
```

to:

```ts
  for (const rule of rules) {
    const outcome = evaluateRule(definition, rule, context);
```

In `planFeature`, change:

```ts
    for (const [index, rule] of rules.entries()) {
      const missing = ruleFields(rule).filter((field) => !available.has(field));
      if (missing.length) {
        for (const field of missing) ownNeeds.add(field);
        continue;
      }
      if (evaluateRule(definition, rule, index, context).matched) {
```

to:

```ts
    for (const rule of rules) {
      const missing = ruleFields(rule).filter((field) => !available.has(field));
      if (missing.length) {
        for (const field of missing) ownNeeds.add(field);
        continue;
      }
      if (evaluateRule(definition, rule, context).matched) {
```

- [ ] **Step 6: Update the `Rule.id` doc comment**

In `libs/feature/src/lib/types.ts`, replace line 68:

```ts
/** Used in `reason`. Defaults to the rule's index, as `#0`, `#1`, ... */
```

with:

```ts
/**
 * Used in `reason`. Defaults to a hash of what the rule matches on, as
 * `rule-a3f1b2c8`, which survives the list being edited and a ramp being
 * moved. Name a rule you expect to read in a log.
 */
```

- [ ] **Step 7: Run the whole package suite**

Run: `npx nx test feature`
Expected: The two new tests PASS. Existing tests asserting `'#0'` or `'#1'` FAIL. Read each failure and update the expected value to the derived id the run reports, because a documented value comes from a run and never from reading the implementation. Do not change any assertion whose rule carries an explicit `id`.

- [ ] **Step 8: Run the whole package suite again**

Run: `npx nx test feature`
Expected: PASS, every file.

- [ ] **Step 9: Commit**

```bash
git add libs/feature/src/lib/evaluate.ts libs/feature/src/lib/types.ts libs/feature/src/lib/features.spec.ts
git commit -m "fix(feature): keep a rule's name when the list around it changes"
```

---

### Task 4: Export it, and correct the documentation

**Files:**

- Modify: `libs/feature/src/index.ts`
- Modify: `libs/feature/README.md`
- Modify: `apps/docs/content/feature/api.mdx:82`
- Modify: `apps/docs/content/feature/configuration.mdx:117-118`
- Modify: `apps/docs/content/feature/decisions.mdx:89-91`, `:108`
- Test: `npx nx test repo-checks`

**Interfaces:**

- Consumes: `ruleId` from Task 2, `canonical` from Task 1.
- Produces: `ruleId` and `canonical` on the package's public entry, which `docs/specs/2026-09-23-feature-config-distribution.md` decision 4 needs for `configDigest`.

`tools/repo-checks/src/doc-exports.test.ts` holds G5: no documentation fence imports a name its package does not export. `apps/docs/content/feature/decisions.mdx` carries an em-dash on an existing line near your edit. Leave lines you are not editing alone.

- [ ] **Step 1: Add the exports**

In `libs/feature/src/index.ts`, after the `export { evaluateCondition } from './lib/conditions.js';` line, add:

```ts
export { canonical } from './lib/canonical.js';
export { ruleId } from './lib/rule-id.js';
```

- [ ] **Step 2: Get the real values from a run**

Create a scratch file outside the repository and run it, so every documented id comes from the implementation rather than from a guess:

```bash
cat > /tmp/rule-ids.ts <<'EOF'
import { ruleId } from './libs/feature/src/lib/rule-id.js';
console.log('staff:', ruleId({ when: [{ field: 'role', op: 'eq', value: 'staff' }] }));
console.log('ramp :', ruleId({ rollout: { percent: 10 } }));
EOF
npx tsx --tsconfig libs/feature/tsconfig.lib.json /tmp/rule-ids.ts
```

If `tsx` cannot resolve the import, print the values from a throwaway test
instead, which runs under the configuration the package already has:

```bash
cat > libs/feature/src/lib/print-ids.spec.ts <<'EOF'
import { it } from 'vitest';
import { ruleId } from './rule-id.js';
it('prints', () => {
  console.log('staff:', ruleId({ when: [{ field: 'role', op: 'eq', value: 'staff' }] }));
  console.log('ramp :', ruleId({ rollout: { percent: 10 } }));
});
EOF
npx nx test feature -- print-ids
rm libs/feature/src/lib/print-ids.spec.ts
```

Write the two printed ids down. Every value in the following steps uses them, and a value that disagrees with the run is a documentation defect.

- [ ] **Step 3: Correct `api.mdx`**

In `apps/docs/content/feature/api.mdx`, replace:

```ts
  id?: string; // defaults to '#0', '#1', … by index
```

with, substituting the id printed for `staff` in Step 2:

```ts
  id?: string; // defaults to a hash of the rule, e.g. 'rule-<from the run>'
```

- [ ] **Step 4: Correct `configuration.mdx`**

In `apps/docs/content/feature/configuration.mdx`, replace:

```md
`id` is used in `reason` and defaults to the rule's index, as `#0`, `#1`. Name
them: an operator reading `rule: '#1'` has to count.
```

with:

```md
`id` is used in `reason`. A rule that declares none is named by a hash of what
it matches on, so the name holds when a rule is inserted above it and when an
operator moves a ramp. Name a rule you expect to read in a log: `staff-only`
tells an operator more than a hash does.
```

- [ ] **Step 5: Correct `decisions.mdx`**

In `apps/docs/content/feature/decisions.mdx`, replace the two `'#0'` occurrences in the fence with the id printed for `staff` in Step 2, and replace:

```md
Rule ids default to `#0`, `#1` and so on. Name them.
```

with:

```md
A rule that declares no `id` is named by a hash of what it matches on. The name
holds when a rule is inserted above it and when an operator moves a ramp, so a
log line from last week still names the rule it named then. Name a rule you
expect to read.
```

- [ ] **Step 6: Check the README for the same claim**

Run: `grep -n "#0\|#1\|by index" libs/feature/README.md`
Correct any line that states the positional default, using the same wording as Step 4. If the command prints nothing, this step is done.

- [ ] **Step 7: Run the documentation checks**

Run: `npx nx test repo-checks`
Expected: PASS. A failure from `doc-exports` names a fence importing something the package does not export, which Step 1 should have covered.

- [ ] **Step 8: Run the full affected suite**

Run: `npx nx affected -t test lint build`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
rm -f /tmp/rule-ids.ts
git add libs/feature/src/index.ts libs/feature/README.md apps/docs/content/feature/
git commit -m "docs(feature): state how a rule without an id is named"
```
