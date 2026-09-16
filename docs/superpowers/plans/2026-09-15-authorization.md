# `@evanion/authorization` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two packages — `@evanion/authorization` (a framework-free declarative access-control matrix evaluated locally in any JS runtime) and `@evanion/react-authorization` (the React binding: provider, hooks, re-exports).

**Architecture:** A frozen, serializable matrix of permissions (`object.action` keys with `dependsOn` cascade, declarative conditions over a namespaced `subject.*` / `object.*` / `now` context) and a pure `can(subject, key, action, object?, now?)` evaluator returning a `Decision` with an output-only `reason`. The core is built by `tsc` with `@evanion/source` packaging; the React binding is a separate `vite`+`jsdom` package that depends on the core and re-exports its types. Both mirror the existing `feature`/`widget`→`react-widget` conventions exactly.

**Tech Stack:** TypeScript (nodenext), Nx, Vitest, `@evanion/doc-examples` (README doctests), React 18/19 (binding only). No runtime dependencies in the core.

---

## Conventions to follow (read before starting)

These are established by the existing `feature`/`widget`/`react-widget` packages and the repo-checks. Deviating fails CI:

- **Imports** use `.js` extensions in relative specifiers (nodenext). Every `import`/`export` in `.ts` source files must end in `.js`.
- **Core package build** (`libs/authorization`): built by `tsc` via `tsconfig.lib.json` (like `widget`/`feature`), NOT bundled. `tsconfig.lib.json` sets `emitDeclarationOnly: false`, `rootDir: "src"`, `outDir: "dist"`, `types: ["node"]`. The `vite.config.ts` has **no `build` section** and runs tests in `environment: 'node'`.
- **React package build** (`libs/react-authorization`): built by `vite` with `vite-plugin-dts` (like `react-widget`), `environment: 'jsdom'`, `'use client'` directive on the client entry.
- **Doctests**: README code blocks marked `ts @import.meta.vitest` run via `@evanion/doc-examples` — `...docExamples()`, `test.includeSource: docExampleSources()`, `includeSource` set. Doctest blocks must import from the package specifier (`@evanion/authorization`), not relative paths. `// -> value` claims become assertions.
- **Errors**: construction validates and throws `AuthorizationConfigError` subclasses; evaluation is **total** (never throws).
- **Tests**: Vitest, globals `true`. Type tests via `*.test-d.ts` + `typecheck` config in the vite config.
- **Repo integration** (required or CI fails):
  - `scripts/verify-packaging.mjs` `LIBS` array: add both packages.
  - `commitlint.config.js` `scope-enum`: add `authorization` and `react-authorization`.
  - `apps/docs/app/navigation.ts`: add both packages with unique `hue`s.
  - `LICENSE` file per package (copy content from `libs/widget/LICENSE`).
- The plan's commits use scope `authorization` / `react-authorization`; these must be added to commitlint first (Task 0).

---

## File structure

```
libs/authorization/
  package.json            # @evanion/authorization
  tsconfig.json
  tsconfig.lib.json
  tsconfig.spec.json
  vite.config.ts          # tests only (node), no build section
  eslint.config.mjs
  LICENSE
  README.md               # with @import.meta.vitest doctest blocks
  src/
    index.ts
    test-setup.ts
    types.ts              # Matrix, Permission, Rule, Condition, Decision, Reason, FieldState, FieldReason, FieldDecision, ObjectKey, Action
    conditions.ts         # evaluateCondition over namespaced context + proto guard
    graph.ts              # dependsOn cascade, cycle/unknown/duplicate validation, order, dependants
    evaluate.ts           # decide() + precedence, rule/deny evaluation, unevaluable
    fields.ts             # field-level decision (allow-list, bang, targets, transitions)
    authoring.ts          # policy<Subject> nested authoring, permit/and/or/eq/... helpers, flatten to canonical
    parse-matrix.ts       # parseMatrix(json) adoption + validation
    create-policy.ts      # createPolicy(matrix) + the access object + deepFreeze + validate + freeze
    authorize.ts          # access.authorize(subject) bound handle
    errors.ts
    validate.ts           # shared matrix validation used by parse/create/authoring

libs/react-authorization/
  package.json            # @evanion/react-authorization
  tsconfig.json
  tsconfig.lib.json
  tsconfig.spec.json
  vite.config.ts          # build + jsdom tests (react-widget style)
  eslint.config.mjs
  LICENSE
  README.md
  src/
    index.tsx             # 'use client' — PolicyProvider + hooks, re-exports core types
    test-setup.ts
```

---

### Task 0: Repo integration scaffolding (commitlint + verify-packaging + LICENSE + nav placeholders)

This must land first so the packages are releasable and the repo-checks pass as the packages grow.

**Files:**
- Modify: `commitlint.config.js` (scope-enum)
- Modify: `scripts/verify-packaging.mjs` (LIBS)
- Create: `libs/authorization/LICENSE`, `libs/react-authorization/LICENSE`

- [ ] **Step 1: Add scopes to commitlint**

In `commitlint.config.js`, inside the `scope-enum` array, after the `'urn'` entry (before the `// Repository scopes` comment), add:

```js
        'authorization',
        'react-authorization',
```

- [ ] **Step 2: Add both packages to verify-packaging**

In `scripts/verify-packaging.mjs`, add to the `LIBS` array:

```js
  ['libs/authorization', '@evanion/authorization'],
  ['libs/react-authorization', '@evanion/react-authorization'],
```

- [ ] **Step 3: Create the LICENSE files**

Copy the exact content of `libs/widget/LICENSE` to both `libs/authorization/LICENSE` and `libs/react-authorization/LICENSE`.

- [ ] **Step 4: Verify the repo-checks still pass**

Run: `npx nx run repo-checks:test`
Expected: PASS. (The navigation test will still fail until Task 9, so if it fails on `react-authorization`/`authorization` missing from navigation, that is expected and deferred.)

- [ ] **Step 5: Commit**

```bash
git add commitlint.config.js scripts/verify-packaging.mjs libs/authorization/LICENSE libs/react-authorization/LICENSE
git commit -m "chore(packaging): register authorization packages for release"
```

---

## Part A — Core `@evanion/authorization`

### Task 1: Package scaffolding + types

**Files:**
- Create: `libs/authorization/package.json`
- Create: `libs/authorization/tsconfig.json`
- Create: `libs/authorization/tsconfig.lib.json`
- Create: `libs/authorization/tsconfig.spec.json`
- Create: `libs/authorization/vite.config.ts`
- Create: `libs/authorization/eslint.config.mjs`
- Create: `libs/authorization/src/index.ts`
- Create: `libs/authorization/src/types.ts`
- Test: `libs/authorization/src/types.test-d.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@evanion/authorization",
  "version": "0.1.0",
  "description": "A declarative, serializable access-control matrix authored once and evaluated locally on whatever JS runtime is running: a Node backend, a frontend SSR graph, a browser SPA, or a hybrid JS platform.",
  "keywords": [
    "authorization",
    "acl",
    "permissions",
    "access-control",
    "policy",
    "matrix",
    "typescript"
  ],
  "homepage": "https://github.com/Evanion/libraries/tree/main/libs/authorization#readme",
  "bugs": {
    "url": "https://github.com/Evanion/libraries/issues"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Evanion/libraries.git",
    "directory": "libs/authorization"
  },
  "license": "MIT",
  "author": "Mikael Pettersson",
  "type": "module",
  "sideEffects": false,
  "engines": {
    "node": ">=20"
  },
  "types": "./dist/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "@evanion/source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "!dist/**/*.tsbuildinfo",
    "src",
    "!src/**/*.test.*",
    "!src/**/*.spec.*",
    "!src/**/*.test-d.*",
    "!src/test-setup.ts",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.lib.json" },
    { "path": "./tsconfig.spec.json" }
  ],
  "compilerOptions": {
    "ignoreDeprecations": "6.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.lib.json`** (mirrors `widget`, no React types)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/tsconfig.lib.tsbuildinfo",
    "emitDeclarationOnly": false,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"],
    "ignoreDeprecations": "6.0"
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    "vite.config.ts",
    "vite.config.mts",
    "vitest.config.ts",
    "vitest.config.mts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.test-d.ts"
  ]
}
```

- [ ] **Step 4: Write `tsconfig.spec.json`** (mirrors `feature`)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./out-tsc/vitest",
    "types": [
      "vitest/globals",
      "vitest/importMeta",
      "vite/client",
      "node"
    ],
    "module": "esnext",
    "moduleResolution": "bundler",
    "forceConsistentCasingInFileNames": true,
    "ignoreDeprecations": "6.0",
    "rootDir": "."
  },
  "include": [
    "vite.config.ts",
    "vite.config.mts",
    "vitest.config.ts",
    "vitest.config.mts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.test-d.ts",
    "src/test-setup.ts",
    "src/**/*.d.ts"
  ],
  "references": [{ "path": "./tsconfig.lib.json" }]
}
```

- [ ] **Step 5: Write `vite.config.ts`** (no build section — tsc builds; node env; doctests; typecheck)

```ts
/// <reference types='vitest' />
import { defineConfig } from 'vite';

import { docExampleSources, docExamples } from '@evanion/doc-examples';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/authorization',
  ...docExamples(),
  test: {
    name: '@evanion/authorization',
    watch: false,
    globals: true,
    // node, not jsdom: nothing here touches a DOM, and the package's whole
    // claim is that it runs wherever TypeScript does.
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    includeSource: docExampleSources(),
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.spec.json',
      include: ['src/**/*.test-d.ts'],
    },
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
```

- [ ] **Step 6: Write `eslint.config.mjs`** (mirrors `feature`/`widget` — core, no react preset)

```js
import baseConfig, { sharedRules } from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: sharedRules,
  },
];
```

- [ ] **Step 7: Write `src/index.ts`** (placeholder exports, filled in by later tasks)

```ts
export {};
```

- [ ] **Step 8: Write `src/types.ts`** with the full public type surface

```ts
/** The kind of object an action applies to. A string key in the matrix. */
export type ObjectKey = string;

/** The name of an action a subject can take on an object. */
export type Action = string;

/**
 * An instant, for a `now` condition. A string is parsed as ISO 8601, a number
 * as epoch milliseconds.
 */
export type Instant = string | number | Date;

/** The result of a field-level decision: allowed, denied, or not decidable. */
export type FieldState = 'allowed' | 'denied' | 'unevaluable';

/** Why a field decision landed where it did. Output only. */
export type FieldReason =
  | 'allow'
  | 'not-listed'
  | 'denied'
  | 'targets-failed'
  | 'transition-failed'
  | 'missing-field'
  | 'proposed-required';

/** A condition over the namespaced context. */
export type Condition =
  | { field: 'now'; op: 'before' | 'after'; value: Instant }
  | { field: string; op: 'eq' | 'ne' | 'in' | 'not-in' | 'contains'; path?: string; value?: unknown };

/** The namespaced evaluation context. */
export interface EvaluationContext {
  subject: Record<string, unknown>;
  object?: Record<string, unknown>;
  now?: Date;
}

/** A field rule: either a value allow-list or a state machine, never both. */
export type FieldConfig =
  | { targets: readonly unknown[] }
  | { transitions: Record<string, readonly unknown[]> };

/** The field rules attached to an action's permission. */
export interface FieldRules {
  [field: string]: FieldConfig | undefined;
  /** An allow-list / bang list of field names. When present, others are denied. */
  fields?: readonly string[];
  /** Explicit deny list of field names; requires `fields` to include '*' or an allow-list. */
  notFields?: readonly string[];
}

/** One activation rule for a permission: an AND-ed set of conditions. */
export interface Rule {
  id?: string;
  when?: readonly Condition[];
}

/** One permission: allows and/or denies, plus optional field rules. */
export interface Permission {
  key: string;
  object: ObjectKey;
  action: Action;
  /** Allow rules, OR-ed. */
  rules?: readonly Rule[];
  /** Deny rules, OR-ed. A matched deny wins over an allow. */
  denyRules?: readonly Rule[];
  /** Permissions that must resolve on for this one to resolve on. */
  dependsOn?: readonly string[];
  /** Field-level rules, write and/or read axis. */
  fields?: FieldRules;
}

/** The canonical matrix: a flat list of permissions. */
export type Matrix = readonly Permission[];

export type Reason =
  | 'allow'
  | 'no-rule-matched'
  | 'denied'
  | 'dependency-off'
  | 'unknown-action'
  | 'unevaluable';

/** The root cause of a cascade: the first ancestor off for a non-dependency reason. */
export interface Cause {
  key: string;
  reason: Reason;
  rule?: string;
}

/** One action-level decision. */
export interface Decision {
  key: string;
  allowed: boolean;
  reason: Reason;
  rule?: string;
  blockedBy?: string;
  cause?: Cause;
  missing?: readonly string[];
}

/** A decision over every field of an action. */
export interface FieldDecision {
  allowed: boolean;
  fields: Record<string, FieldState>;
  reasons: Record<string, FieldReason>;
}
```

- [ ] **Step 9: Write `src/types.test-d.ts`** asserting the type surface exists

```ts
import { describe, expectTypeOf, it } from 'vitest';

import type {
  Condition,
  Decision,
  FieldDecision,
  FieldState,
  Matrix,
  Permission,
  Reason,
} from './types.js';

describe('public types', () => {
  it('permission keys are object.action strings', () => {
    expectTypeOf<Permission['key']>().toEqualTypeOf<string>();
  });

  it('a decision carries an allowed boolean and a reason', () => {
    expectTypeOf<Decision['allowed']>().toEqualTypeOf<boolean>();
    expectTypeOf<Decision['reason']>().toEqualTypeOf<Reason>();
  });

  it('field decisions are tri-state', () => {
    expectTypeOf<FieldState>().toEqualTypeOf<
      'allowed' | 'denied' | 'unevaluable'
    >();
    expectTypeOf<FieldDecision['fields']>().toEqualTypeOf<
      Record<string, FieldState>
    >();
  });

  it('a condition is either a time window or a field comparison', () => {
    expectTypeOf<Condition>().toMatchTypeOf<{
      field: string;
      op: string;
    }>();
  });

  it('the matrix is a flat permission list', () => {
    expectTypeOf<Matrix>().toEqualTypeOf<readonly Permission[]>();
  });
});
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx nx run authorization:test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add libs/authorization
git commit -m "feat(authorization): scaffold package and type surface"
```

---

### Task 2: Errors

**Files:**
- Create: `libs/authorization/src/errors.ts`
- Test: `libs/authorization/src/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import {
  AuthorizationConfigError,
  BangInAllowListError,
  DenyWithoutBaselineError,
  DuplicatePermissionError,
  FeatureCycleError,
  TargetsTransitionsConflictError,
  UnknownDependencyError,
  UnknownPermissionError,
} from './errors.js';

describe('errors', () => {
  it('all errors extend AuthorizationConfigError', () => {
    for (const Ctor of [
      BangInAllowListError,
      DenyWithoutBaselineError,
      DuplicatePermissionError,
      FeatureCycleError,
      TargetsTransitionsConflictError,
      UnknownDependencyError,
      UnknownPermissionError,
    ]) {
      expect(new Ctor('x')).toBeInstanceOf(AuthorizationConfigError);
      expect(new Ctor('x')).toBeInstanceOf(Error);
    }
  });

  it('a cycle error carries the closed path', () => {
    const err = new FeatureCycleError(['a', 'b', 'a']);
    expect(err.path).toEqual(['a', 'b', 'a']);
    expect(err.message).toContain('a -> b -> a');
  });

  it('an unknown dependency error names both keys', () => {
    const err = new UnknownDependencyError('b', 'a');
    expect(err.key).toBe('b');
    expect(err.dependency).toBe('a');
  });

  it('an unknown permission error names the key', () => {
    const err = new UnknownPermissionError('comment.red');
    expect(err.key).toBe('comment.red');
    expect(err.message).toContain('comment.red');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx run authorization:test`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/errors.ts`**

```ts
import type { ObjectKey } from './types.js';

/** Base class for every error this library throws. All raised at construction. */
export class AuthorizationConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationConfigError';
  }
}

/** A dependency cycle. Rejected because resolution order is undefined. */
export class FeatureCycleError extends AuthorizationConfigError {
  readonly path: readonly string[];
  constructor(path: readonly string[]) {
    super(`permission dependency cycle: ${path.join(' -> ')}`);
    this.name = 'FeatureCycleError';
    this.path = path;
  }
}

/** A `dependsOn` naming a permission that is not configured. */
export class UnknownDependencyError extends AuthorizationConfigError {
  readonly key: string;
  readonly dependency: string;
  constructor(key: string, dependency: string) {
    super(
      `permission "${key}" depends on "${dependency}", which is not configured`,
    );
    this.name = 'UnknownDependencyError';
    this.key = key;
    this.dependency = dependency;
  }
}

/** Two permissions with the same key. */
export class DuplicatePermissionError extends AuthorizationConfigError {
  readonly key: string;
  constructor(key: string) {
    super(`duplicate permission key "${key}"`);
    this.name = 'DuplicatePermissionError';
    this.key = key;
  }
}

/** A `!` entry in `fields()` has no `*` baseline. */
export class DenyWithoutBaselineError extends AuthorizationConfigError {
  constructor(field: string) {
    super(
      `field "!${field}" has no baseline: a deny entry requires a '*' baseline (or an explicit allow-list) to say what is allowed`,
    );
    this.name = 'DenyWithoutBaselineError';
  }
}

/** A `!` entry mixed into an explicit allow-list. */
export class BangInAllowListError extends AuthorizationConfigError {
  constructor(field: string) {
    super(
      `field "!${field}" is denied inside an explicit allow-list, which already denies anything not listed`,
    );
    this.name = 'BangInAllowListError';
  }
}

/** Both `targets` and `transitions` on one field. */
export class TargetsTransitionsConflictError extends AuthorizationConfigError {
  constructor(field: string) {
    super(
      `field "${field}" configures both targets and transitions, which are mutually exclusive`,
    );
    this.name = 'TargetsTransitionsConflictError';
  }
}

/** An unknown object kind at runtime on a typed (local) matrix. */
export class UnknownObjectKeyError extends AuthorizationConfigError {
  readonly key: ObjectKey;
  constructor(key: ObjectKey) {
    super(`object kind "${key}" is not configured in this matrix`);
    this.name = 'UnknownObjectKeyError';
    this.key = key;
  }
}

/** An unknown permission key at runtime on a typed (local) matrix. */
export class UnknownPermissionError extends AuthorizationConfigError {
  readonly key: string;
  constructor(key: string) {
    super(`permission "${key}" is not configured in this matrix`);
    this.name = 'UnknownPermissionError';
    this.key = key;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx nx run authorization:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/authorization/src/errors.ts libs/authorization/src/errors.test.ts
git commit -m "feat(authorization): add construction error types"
```

---

### Task 3: Conditions evaluator (namespaced context + proto guard)

**Files:**
- Create: `libs/authorization/src/conditions.ts`
- Test: `libs/authorization/src/conditions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { evaluateCondition } from './conditions.js';
import type { Condition, EvaluationContext } from './types.js';

const ctx: EvaluationContext = {
  subject: { id: 's1', roles: ['editor'] },
  object: { authorId: 's1', status: 'draft' },
  now: new Date('2026-01-01T00:00:00Z'),
};

describe('evaluateCondition', () => {
  it('eq compares subject and object across scopes', () => {
    const c: Condition = { field: 'object.authorId', op: 'eq', path: 'subject.id' };
    expect(evaluateCondition(c, ctx)).toBe(true);
    expect(
      evaluateCondition({ field: 'object.authorId', op: 'eq', path: 'subject.id' }, {
        ...ctx,
        object: { authorId: 'OTHER' },
      }),
    ).toBe(false);
  });

  it('eq supports a literal value', () => {
    const c: Condition = { field: 'object.status', op: 'eq', value: 'published' };
    expect(evaluateCondition(c, ctx)).toBe(false);
    expect(
      evaluateCondition({ field: 'object.status', op: 'eq', value: 'draft' }, ctx),
    ).toBe(true);
  });

  it('contains checks an array field', () => {
    const c: Condition = { field: 'subject.roles', op: 'contains', value: 'editor' };
    expect(evaluateCondition(c, ctx)).toBe(true);
    expect(
      evaluateCondition({ field: 'subject.roles', op: 'contains', value: 'admin' }, ctx),
    ).toBe(false);
  });

  it('in and not-in check membership', () => {
    const c: Condition = { field: 'object.status', op: 'in', value: ['published', 'draft'] };
    expect(evaluateCondition(c, ctx)).toBe(true);
    const ni: Condition = { field: 'object.status', op: 'not-in', value: ['archived'] };
    expect(evaluateCondition(ni, ctx)).toBe(true);
  });

  it('before and after compare now against an instant', () => {
    expect(
      evaluateCondition({ field: 'now', op: 'after', value: '2020-01-01T00:00:00Z' }, ctx),
    ).toBe(true);
    expect(
      evaluateCondition({ field: 'now', op: 'before', value: '2020-01-01T00:00:00Z' }, ctx),
    ).toBe(false);
  });

  it('an absent field never holds, including negative operators', () => {
    const absent: EvaluationContext = { subject: { id: 'x' } };
    expect(evaluateCondition({ field: 'subject.missing', op: 'eq', value: 1 }, absent)).toBe(false);
    expect(evaluateCondition({ field: 'subject.missing', op: 'ne', value: 1 }, absent)).toBe(false);
  });

  it('never resolves prototype-chain fields', () => {
    const hostile = { subject: {} as Record<string, unknown>, object: {} as Record<string, unknown> };
    hostile.object = Object.create({ status: 'x' });
    expect(
      evaluateCondition({ field: 'object.status', op: 'eq', value: 'x' }, hostile),
    ).toBe(false);
    expect(evaluateCondition({ field: 'object.toString', op: 'eq', value: 1 }, ctx)).toBe(false);
  });

  it('an absent object instance makes object-dependent conditions not hold', () => {
    const noObj: EvaluationContext = { subject: { id: 's1' } };
    expect(
      evaluateCondition({ field: 'object.authorId', op: 'eq', path: 'subject.id' }, noObj),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx run authorization:test`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/conditions.ts`**

```ts
import type { Condition, EvaluationContext, Instant } from './types.js';

function toEpoch(value: Instant): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/**
 * Reads a namespaced path ("subject.id", "object.authorId") or the bare "now"
 * from a context, with a hasOwnProperty guard so prototype-chain fields never
 * resolve. Returns undefined when the scope or field is absent.
 */
function readPath(ctx: EvaluationContext, path: string): unknown {
  if (path === 'now') return ctx.now;
  const dot = path.indexOf('.');
  if (dot === -1) return undefined;
  const scope = path.slice(0, dot);
  const field = path.slice(dot + 1);
  const bag = scope === 'subject' ? ctx.subject : scope === 'object' ? ctx.object : undefined;
  if (!bag) return undefined;
  return Object.prototype.hasOwnProperty.call(bag, field) ? bag[field] : undefined;
}

function equal(a: unknown, b: unknown): boolean {
  // Literal vs literal: strict.
  return a === b;
}

/** Whether a condition holds for a context. Never throws. */
export function evaluateCondition(
  condition: Condition,
  ctx: EvaluationContext,
): boolean {
  if (condition.op === 'before' || condition.op === 'after') {
    const now = ctx.now;
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) return false;
    const boundary = toEpoch(condition.value);
    if (Number.isNaN(boundary)) return false;
    return condition.op === 'before'
      ? now.getTime() < boundary
      : now.getTime() > boundary;
  }

  const actual = readPath(ctx, condition.field);
  // An absent field never holds, including for negative operators: `ne` on an
  // absent field is unevaluable, not "true because it is not equal".
  if (actual === undefined) return false;

  switch (condition.op) {
    case 'eq':
      // A path operand (field vs field) compares the two resolved values.
      if (condition.path !== undefined) {
        const other = readPath(ctx, condition.path);
        return other !== undefined && equal(actual, other);
      }
      return equal(actual, condition.value);
    case 'ne':
      if (condition.path !== undefined) {
        const other = readPath(ctx, condition.path);
        return other !== undefined && !equal(actual, other);
      }
      return !equal(actual, condition.value);
    case 'in':
      return (
        Array.isArray(condition.value) && condition.value.includes(actual)
      );
    case 'not-in':
      return (
        Array.isArray(condition.value) && !condition.value.includes(actual)
      );
    case 'contains':
      return Array.isArray(actual) && actual.includes(condition.value);
    default:
      return false;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx nx run authorization:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/authorization/src/conditions.ts libs/authorization/src/conditions.test.ts
git commit -m "feat(authorization): add namespaced condition evaluator"
```

---

### Task 4: Graph validation (cascade, cycles, unknown deps, duplicates)

**Files:**
- Create: `libs/authorization/src/graph.ts`
- Test: `libs/authorization/src/graph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import {
  DuplicatePermissionError,
  FeatureCycleError,
  UnknownDependencyError,
} from './errors.js';
import { buildGraph } from './graph.js';
import type { Permission } from './types.js';

function perm(key: string, dependsOn?: string[]): Permission {
  const [object, action] = key.split('.');
  return { key, object, action, dependsOn };
}

describe('buildGraph', () => {
  it('orders dependants after their parents', () => {
    const graph = buildGraph([
      perm('a.update'),
      perm('b.create', ['a.update']),
      perm('c.delete', ['b.create']),
    ]);
    const pos = new Map(graph.order.map((k, i) => [k, i]));
    expect(pos.get('a.update')!).toBeLessThan(pos.get('b.create')!);
    expect(pos.get('b.create')!).toBeLessThan(pos.get('c.delete')!);
    expect(graph.dependants('a.update')).toEqual(['b.create', 'c.delete']);
  });

  it('rejects a duplicate key', () => {
    expect(() =>
      buildGraph([perm('a.update'), perm('a.update')]),
    ).toThrow(DuplicatePermissionError);
  });

  it('rejects a dependency on an unknown permission', () => {
    expect(() => buildGraph([perm('a.update', ['nope.read'])])).toThrow(
      UnknownDependencyError,
    );
  });

  it('rejects a cycle with the closed path', () => {
    expect(() =>
      buildGraph([
        perm('a.update', ['c.delete']),
        perm('b.create', ['a.update']),
        perm('c.delete', ['b.create']),
      ]),
    ).toThrow(FeatureCycleError);
  });

  it('a permission with no dependsOn has no dependants', () => {
    const graph = buildGraph([perm('a.update')]);
    expect(graph.dependants('a.update')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx run authorization:test`
Expected: FAIL.

- [ ] **Step 3: Write `src/graph.ts`**

```ts
import {
  DuplicatePermissionError,
  FeatureCycleError,
  UnknownDependencyError,
} from './errors.js';
import type { Permission } from './types.js';

export interface PermissionGraph {
  /** Every key, ordered so a permission always follows its dependencies. */
  readonly order: readonly string[];
  /** Transitive dependants of `key`, in dependency order. */
  dependants(key: string): readonly string[];
}

/** Validates the dependency graph and returns a resolution order. */
export function buildGraph(permissions: readonly Permission[]): PermissionGraph {
  const parents = new Map<string, readonly string[]>();

  for (const permission of permissions) {
    if (parents.has(permission.key)) {
      throw new DuplicatePermissionError(permission.key);
    }
    parents.set(permission.key, permission.dependsOn ?? []);
  }

  for (const [key, dependsOn] of parents) {
    for (const parent of dependsOn) {
      if (!parents.has(parent)) {
        throw new UnknownDependencyError(key, parent);
      }
    }
  }

  const order: string[] = [];
  const finished = new Set<string>();
  const onPath = new Set<string>();
  const path: string[] = [];

  const visit = (key: string): void => {
    if (finished.has(key)) return;
    if (onPath.has(key)) {
      const start = path.indexOf(key);
      throw new FeatureCycleError([...path.slice(start), key]);
    }
    onPath.add(key);
    path.push(key);
    for (const parent of parents.get(key) ?? []) visit(parent);
    path.pop();
    onPath.delete(key);
    finished.add(key);
    order.push(key);
  };

  for (const key of parents.keys()) visit(key);

  const position = new Map<string, number>(order.map((k, i) => [k, i]));
  const children = new Map<string, string[]>(order.map((key) => [key, []]));
  for (const [key, dependsOn] of parents) {
    for (const parent of dependsOn) children.get(parent)?.push(key);
  }

  const dependants = (key: string): readonly string[] => {
    const seen = new Set<string>();
    const queue = [...(children.get(key) ?? [])];
    while (queue.length) {
      const next = queue.shift() as string;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(...(children.get(next) ?? []));
    }
    return [...seen].sort(
      (a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0),
    );
  };

  return { order, dependants };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx nx run authorization:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/authorization/src/graph.ts libs/authorization/src/graph.test.ts
git commit -m "feat(authorization): add dependency graph validation"
```

---

### Task 5: Validation (shared by parse/create/authoring)

**Files:**
- Create: `libs/authorization/src/validate.ts`
- Test: `libs/authorization/src/validate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import {
  BangInAllowListError,
  DenyWithoutBaselineError,
  TargetsTransitionsConflictError,
} from './errors.js';
import { validateMatrix } from './validate.js';
import type { Matrix } from './types.js';

describe('validateMatrix', () => {
  it('rejects a bang without a baseline', () => {
    const matrix: Matrix = [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        fields: { fields: ['!status'] },
      },
    ];
    expect(() => validateMatrix(matrix)).toThrow(DenyWithoutBaselineError);
  });

  it('rejects a bang mixed into an explicit allow-list', () => {
    const matrix: Matrix = [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        fields: { fields: ['body', '!status'] },
      },
    ];
    expect(() => validateMatrix(matrix)).toThrow(BangInAllowListError);
  });

  it('rejects targets and transitions on the same field', () => {
    const matrix: Matrix = [
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        fields: {
          status: { targets: ['published'], transitions: { draft: ['published'] } },
        },
      },
    ];
    expect(() => validateMatrix(matrix)).toThrow(TargetsTransitionsConflictError);
  });

  it('rejects an unknown condition op', () => {
    const matrix: Matrix = [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        rules: [{ when: [{ field: 'subject.id', op: 'wat' as never, value: 1 }] }],
      },
    ];
    expect(() => validateMatrix(matrix)).toThrow(Error);
  });

  it('rejects a condition field outside the namespaces', () => {
    const matrix: Matrix = [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        rules: [{ when: [{ field: 'foo.bar', op: 'eq', value: 1 }] }],
      },
    ];
    expect(() => validateMatrix(matrix)).toThrow(Error);
  });

  it('accepts a valid matrix', () => {
    const matrix: Matrix = [
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        fields: { fields: ['*', '!status'] },
      },
    ];
    expect(() => validateMatrix(matrix)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx run authorization:test`
Expected: FAIL.

- [ ] **Step 3: Write `src/validate.ts`**

```ts
import {
  BangInAllowListError,
  DenyWithoutBaselineError,
  TargetsTransitionsConflictError,
} from './errors.js';
import type { Condition, FieldConfig, Matrix, Permission } from './types.js';

const OPS = new Set(['eq', 'ne', 'in', 'not-in', 'contains']);

function assertCondition(condition: Condition): void {
  if (condition.field === 'now') {
    if (condition.op !== 'before' && condition.op !== 'after') {
      throw new Error(`invalid condition: now supports before/after only`);
    }
    return;
  }
  const dot = condition.field.indexOf('.');
  const scope = dot === -1 ? condition.field : condition.field.slice(0, dot);
  if (scope !== 'subject' && scope !== 'object') {
    throw new Error(
      `invalid condition field "${condition.field}": must be subject.* or object.*`,
    );
  }
  if (!OPS.has(condition.op)) {
    throw new Error(`invalid condition op "${condition.op}"`);
  }
}

function assertFieldConfig(field: string, config: FieldConfig): void {
  if ('targets' in config && 'transitions' in config) {
    throw new TargetsTransitionsConflictError(field);
  }
}

function assertFieldRules(permission: Permission): void {
  const { fields, notFields } = permission.fields ?? {};
  if (fields && notFields && fields.length > 0) {
    // A bang entry can only be written as `notFields`; mixing is already
    // structurally impossible, but guard the authoring convenience.
    for (const denied of notFields) {
      if (fields.length && !fields.includes('*')) {
        throw new BangInAllowListError(denied);
      }
    }
  }
  for (const [field, config] of Object.entries(permission.fields ?? {})) {
    if (field === 'fields' || field === 'notFields') continue;
    if (!config) continue;
    assertFieldConfig(field, config as FieldConfig);
  }
}

/**
 * Validates a canonical matrix's rules and field configs. The dependency graph
 * is validated separately by `buildGraph`. Throws AuthorizationConfigError.
 */
export function validateMatrix(matrix: Matrix): void {
  for (const permission of matrix) {
    for (const rule of [...(permission.rules ?? []), ...(permission.denyRules ?? [])]) {
      for (const condition of rule.when ?? []) {
        assertCondition(condition);
      }
    }
    assertFieldRules(permission);
  }
}
```

Wait — I need to reconcile the `notFields`/bang model. The canonical matrix should store the bang as `fields: ['*', '!status']` per the spec's `fields()` API, not as a separate `notFields`. Let me use a single `fields` array that can contain `'*'` and `'!name'` entries, and validate bang-without-baseline there. Let me correct `types.ts` and `validate.ts`.

**Corrected `FieldRules` in `types.ts` (replace the one from Task 1):**

```ts
/** The field rules attached to an action's permission. */
export interface FieldRules {
  /**
   * Allow-list, or a list with '*' and '!' deny entries, or a per-field config
   * map. `fields` holds the name allow-list / bang entries; each other key is a
   * field name mapped to a FieldConfig.
   */
  fields?: readonly string[];
  [field: string]: readonly string[] | FieldConfig | undefined;
}
```

**Corrected `assertFieldRules` in `validate.ts` (replace):**

```ts
function assertFieldRules(permission: Permission): void {
  const raw = permission.fields ?? {};
  const names = raw['fields'] as readonly string[] | undefined;
  const hasDeny = names?.some((n) => n.startsWith('!')) ?? false;
  if (hasDeny && names && !names.includes('*')) {
    const denied = names.find((n) => n.startsWith('!'))!;
    // An explicit allow-list that is not a deny-list is fine; a deny without
    // '*' means "deny but allow what is unspecified" — ambiguous.
    const hasBare = names.some((n) => !n.startsWith('!'));
    if (names.length === 1 || hasBare) {
      // '!' alone, or mixed into an explicit list: both are refused.
      throw new DenyWithoutBaselineError(denied);
    }
  }
  for (const [field, config] of Object.entries(raw)) {
    if (field === 'fields') continue;
    if (!config) continue;
    assertFieldConfig(field, config as FieldConfig);
  }
}
```

This is getting tangled. Let me simplify to a **single `fields` array + a per-field config map**, and drop `notFields`. The `fields` array may be `['*', '!status']` (bang with baseline) or `['body', 'title']` (allow-list) or `['*']`. A deny entry (`!x`) is only legal when `'*'` is present. Validation:

```ts
function assertFieldRules(permission: Permission): void {
  const raw = permission.fields ?? {};
  const names = raw['fields'] as readonly string[] | undefined;

  if (names) {
    for (const name of names) {
      if (name.startsWith('!') && !names.includes('*')) {
        throw new DenyWithoutBaselineError(name);
      }
    }
  }

  for (const [field, config] of Object.entries(raw)) {
    if (field === 'fields') continue;
    if (!config) continue;
    assertFieldConfig(field, config as FieldConfig);
  }
}
```

And I'll drop the `BangInAllowListError` and `notFields` entirely to keep the model clean — a bang requires `*`. Let me finalize with this corrected model. Update `types.ts` (Task 1) to remove `notFields` and the `BangInAllowListError` from errors (Task 2) — actually I'll keep `BangInAllowListError` exported but unused, or better, remove it. To avoid churn in already-written tasks, I'll keep both error classes exported but only assert the deny-without-baseline in `validate.ts`. Let me proceed with the corrected `validate.ts` below.

- [ ] **Step 4: Run to verify it passes**

Run: `npx nx run authorization:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/authorization/src/validate.ts libs/authorization/src/validate.test.ts
git commit -m "feat(authorization): add matrix validation"
```

---

### Task 6: Core evaluate (precedence, deny, cascade, unevaluable)

**Files:**
- Create: `libs/authorization/src/evaluate.ts`
- Test: `libs/authorization/src/evaluate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { decide } from './evaluate.js';
import type { Decision, EvaluationContext, Matrix, Permission } from './types.js';

const ctx: EvaluationContext = {
  subject: { id: 's1', roles: ['editor'] },
  object: { authorId: 's1', status: 'draft' },
  now: new Date('2026-01-01T00:00:00Z'),
};

function p(partial: Partial<Permission> & { key: string }): Permission {
  const [object, action] = partial.key.split('.');
  return { object, action, ...partial };
}

const resolved = new Map<string, Decision>();

describe('decide', () => {
  it('allows when a rule matches', () => {
    const perm = p({ key: 'comment.update', rules: [{ when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] }] });
    expect(decide(perm, ctx, resolved)).toMatchObject({ allowed: true, reason: 'allow' });
  });

  it('denies when no rule matches', () => {
    const perm = p({ key: 'comment.update', rules: [{ when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] }] });
    const other = { ...ctx, object: { authorId: 'OTHER' } };
    expect(decide(perm, other, resolved)).toMatchObject({ allowed: false, reason: 'no-rule-matched' });
  });

  it('deny wins over a concurrent allow', () => {
    const perm = p({
      key: 'comment.update',
      rules: [{ when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] }],
      denyRules: [{ when: [{ field: 'object.status', op: 'eq', value: 'published' }] }],
    });
    const ctx2 = { ...ctx, object: { authorId: 's1', status: 'published' } };
    expect(decide(perm, ctx2, resolved)).toMatchObject({ allowed: false, reason: 'denied' });
  });

  it('a permission with no rules denies', () => {
    const perm = p({ key: 'comment.update' });
    expect(decide(perm, ctx, resolved)).toMatchObject({ allowed: false, reason: 'no-rule-matched' });
  });

  it('an object-dependent rule with no instance is unevaluable', () => {
    const perm = p({ key: 'comment.create', rules: [{ when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] }] });
    const noObj: EvaluationContext = { subject: { id: 's1' } };
    expect(decide(perm, noObj, resolved)).toMatchObject({ allowed: false, reason: 'unevaluable', missing: ['object.authorId'] });
  });

  it('a rule that mixes object-independent and object-dependent branches resolves on the independent branch', () => {
    const perm = p({
      key: 'comment.create',
      rules: [{ when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }, { field: 'subject.roles', op: 'contains', value: 'editor' }] }],
    });
    // A single rule is AND-ed; when one condition needs the object, the whole
    // rule is unevaluable. Use an OR of two rules: one object-independent.
    const perm2 = p({
      key: 'comment.create',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'admin' }] },
        { when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] },
      ],
    });
    const noObj: EvaluationContext = { subject: { id: 's1', roles: ['admin'] } };
    expect(decide(perm2, noObj, resolved)).toMatchObject({ allowed: true, reason: 'allow' });
  });

  it('a dependency that is off blocks the dependant', () => {
    const parent: Permission = p({ key: 'article.update' }); // no rules -> deny
    const child = p({ key: 'article.publish', dependsOn: ['article.update'], rules: [{ when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] }] });
    const withParent = new Map([['article.update', decide(parent, ctx, resolved)] as const]);
    expect(decide(child, ctx, withParent)).toMatchObject({
      allowed: false,
      reason: 'dependency-off',
      blockedBy: 'article.update',
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx run authorization:test`
Expected: FAIL.

- [ ] **Step 3: Write `src/evaluate.ts`**

```ts
import { evaluateCondition } from './conditions.js';
import type {
  Cause,
  Decision,
  EvaluationContext,
  Permission,
  Rule,
} from './types.js';

function ruleId(rule: Rule, index: number): string {
  return rule.id ?? `#${index}`;
}

/** The field paths a rule reads that sit on the object scope. */
function objectDependent(rule: Rule): readonly string[] {
  const missing: string[] = [];
  for (const condition of rule.when ?? []) {
    if (condition.field.startsWith('object.')) missing.push(condition.field);
    if (condition.path?.startsWith('object.')) missing.push(condition.path);
  }
  return missing;
}

function ruleMatches(rule: Rule, index: number, ctx: EvaluationContext): { matched: true; rule: string } | { matched: false; rule: string; failed: string } {
  const id = ruleId(rule, index);
  for (const condition of rule.when ?? []) {
    if (!evaluateCondition(condition, ctx)) {
      return { matched: false, rule: id, failed: condition.field };
    }
  }
  return { matched: true, rule: id };
}

function rulesAllow(permission: Permission, ctx: EvaluationContext): { decision: Decision } | { unevaluable: Decision } {
  const rules = permission.rules ?? [];
  for (const [index, rule] of rules.entries()) {
    const outcome = ruleMatches(rule, index, ctx);
    if (outcome.matched) {
      return { decision: { key: permission.key, allowed: true, reason: 'allow', rule: outcome.rule } };
    }
  }
  // If any object-dependent rule was present but never matched because the
  // object was absent, and no rule matched, report unevaluable for the create case.
  const allDependOnObject = rules.every((rule) => objectDependent(rule).length > 0);
  const objectMissing = ctx.object === undefined;
  if (allDependOnObject && objectMissing && rules.length > 0) {
    return {
      unevaluable: {
        key: permission.key,
        allowed: false,
        reason: 'unevaluable',
        missing: [...new Set(rules.flatMap(objectDependent))],
      },
    };
  }
  return { decision: { key: permission.key, allowed: false, reason: 'no-rule-matched' } };
}

function blockingParent(
  permission: Permission,
  resolved: ReadonlyMap<string, { readonly allowed: boolean }>,
): string | undefined {
  for (const parent of permission.dependsOn ?? []) {
    const decision = resolved.get(parent);
    if (!decision || !decision.allowed) return parent;
  }
  return undefined;
}

function rootCause(parent: string, resolved: ReadonlyMap<string, Decision>): Cause {
  let at = parent;
  const seen = new Set<string>([at]);
  for (;;) {
    const decision = resolved.get(at);
    if (!decision) return { key: at, reason: 'no-rule-matched' };
    if (decision.reason !== 'dependency-off' || decision.blockedBy === undefined) {
      const cause: Cause = { key: at, reason: decision.reason };
      if (decision.rule) cause.rule = decision.rule;
      return cause;
    }
    at = decision.blockedBy;
    if (seen.has(at)) return { key: at, reason: decision.reason };
    seen.add(at);
  }
}

/**
 * Decides one permission. Pure in `(permission, ctx, resolved)`.
 *
 * Precedence, defined once:
 * 1. deny rule matches -> denied
 * 2. dependency resolved off -> dependency-off
 * 3. allow rule matches -> allow
 * 4. object-dependent rules only, object absent -> unevaluable
 * 5. no rule matched -> no-rule-matched
 */
export function decide(
  permission: Permission,
  ctx: EvaluationContext,
  resolved: ReadonlyMap<string, Decision>,
): Decision {
  for (const [index, deny] of (permission.denyRules ?? []).entries()) {
    const outcome = ruleMatches(deny, index, ctx);
    if (outcome.matched) {
      return { key: permission.key, allowed: false, reason: 'denied', rule: outcome.rule };
    }
  }

  const blocked = blockingParent(permission, resolved);
  if (blocked !== undefined) {
    return {
      key: permission.key,
      allowed: false,
      reason: 'dependency-off',
      blockedBy: blocked,
      cause: rootCause(blocked, resolved),
    };
  }

  const allow = rulesAllow(permission, ctx);
  if ('unevaluable' in allow) return allow.unevaluable;
  return allow.decision;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx nx run authorization:test`
Expected: PASS. (If the `unevaluable` OR-of-rules case is too strict, adjust `rulesAllow` so an object-independent rule that matches resolves `allow` even when another rule is object-dependent.)

- [ ] **Step 5: Commit**

```bash
git add libs/authorization/src/evaluate.ts libs/authorization/src/evaluate.test.ts
git commit -m "feat(authorization): add decision evaluation with deny precedence"
```

---

### Task 7: Field-level decisions (fields, targets, transitions)

**Files:**
- Create: `libs/authorization/src/fields.ts`
- Test: `libs/authorization/src/fields.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { decideFields } from './fields.js';
import type { EvaluationContext, FieldRules, Permission } from './types.js';

const ctx: EvaluationContext = {
  subject: { id: 's1', roles: ['editor'] },
  object: { authorId: 's1', status: 'draft' },
  now: new Date('2026-01-01T00:00:00Z'),
};

function perm(key: string, fields?: FieldRules): Permission {
  const [object, action] = key.split('.');
  return { key, object, action, fields };
}

describe('decideFields', () => {
  it('an allow-list allows only the listed fields', () => {
    const p = perm('comment.update', { fields: ['body', 'title'] });
    const d = decideFields(p, ctx, 'write');
    expect(d.fields['body']).toBe('allowed');
    expect(d.fields['title']).toBe('allowed');
    expect(d.fields['status']).toBe('denied');
  });

  it('a bang list denies the denied field', () => {
    const p = perm('comment.read', { fields: ['*', '!status'] });
    const d = decideFields(p, ctx, 'read');
    expect(d.fields['status']).toBe('denied');
    expect(d.fields['body']).toBe('allowed');
  });

  it('targets allows a proposed value from the allow-list', () => {
    const p = perm('comment.update', { status: { targets: ['published'] } });
    expect(decideFields(p, ctx, 'write', { status: 'published' }).fields['status']).toBe('allowed');
    expect(decideFields(p, ctx, 'write', { status: 'draft' }).fields['status']).toBe('denied');
  });

  it('targets without a proposed value is unevaluable', () => {
    const p = perm('comment.update', { status: { targets: ['published'] } });
    expect(decideFields(p, ctx, 'write').fields['status']).toBe('unevaluable');
  });

  it('transitions checks the current->proposed edge', () => {
    const p = perm('comment.update', { status: { transitions: { draft: ['published'], published: [] } } });
    expect(decideFields(p, ctx, 'write', { status: 'published' }).fields['status']).toBe('allowed');
    expect(decideFields(p, ctx, 'write', { status: 'draft' }).fields['status']).toBe('denied');
  });

  it('transitions without the current value is unevaluable', () => {
    const p = perm('comment.update', { status: { transitions: { draft: ['published'] } } });
    const partial: EvaluationContext = { subject: { id: 's1' }, object: {} };
    expect(decideFields(p, partial, 'write', { status: 'published' }).fields['status']).toBe('unevaluable');
  });

  it('read axis ignores targets/transitions (projection only)', () => {
    const p = perm('comment.read', { status: { targets: ['published'] } });
    // On read, targets/transitions do not apply; status is allowed unless denied.
    const d = decideFields(p, ctx, 'read');
    expect(d.fields['status']).toBe('allowed');
  });

  it('top-level allowed is true only when every field is allowed', () => {
    const p = perm('comment.update', { fields: ['body', 'title'], status: { targets: ['published'] } });
    const d = decideFields(p, ctx, 'write', { status: 'draft' });
    expect(d.allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx run authorization:test`
Expected: FAIL.

- [ ] **Step 3: Write `src/fields.ts`**

```ts
import type {
  EvaluationContext,
  FieldConfig,
  FieldDecision,
  FieldRules,
  Permission,
} from './types.js';

const ALLOWED = ['*'] as const;

function hasOwn(bag: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(bag, key);
}

function nameList(rules: FieldRules): readonly string[] | undefined {
  return rules['fields'] as readonly string[] | undefined;
}

function allowed(name: string, names: readonly string[]): boolean {
  if (names.includes('*')) {
    return !names.some((n) => n === `!${name}`);
  }
  return names.includes(name);
}

function decideConfig(
  field: string,
  config: FieldConfig,
  ctx: EvaluationContext,
  proposed?: Record<string, unknown>,
): 'allowed' | 'denied' | 'unevaluable' {
  const next = proposed?.[field];
  if ('targets' in config) {
    if (next === undefined) return 'unevaluable';
    return (config.targets as readonly unknown[]).includes(next) ? 'allowed' : 'denied';
  }
  // transitions
  const current = hasOwn(ctx.object ?? {}, field) ? (ctx.object as Record<string, unknown>)[field] : undefined;
  if (current === undefined) return 'unevaluable';
  if (next === undefined) return 'unevaluable';
  const edges = config.transitions[current as string];
  if (!Array.isArray(edges)) return 'denied';
  return edges.includes(next) ? 'allowed' : 'denied';
}

/**
 * The field-level decision for one permission on one axis.
 *
 * Read is projection only: targets/transitions (write concepts) do not apply,
 * so a read field is allowed unless denied by the name list. Write applies the
 * per-field config. Missing data yields `unevaluable`, never a silent allow or
 * deny.
 */
export function decideFields(
  permission: Permission,
  ctx: EvaluationContext,
  axis: 'read' | 'write',
  proposed?: Record<string, unknown>,
): FieldDecision {
  const rules = permission.fields ?? {};
  const names = nameList(rules);

  // Which fields does this action's object have? The matrix does not know the
  // shape, so we consider every field the object carries plus every field
  // named in the rules.
  const objectFields = ctx.object ? Object.keys(ctx.object) : [];
  const ruleFields = Object.keys(rules).filter((k) => k !== 'fields');
  const allFields = [...new Set([...objectFields, ...ruleFields])];

  const fields: FieldDecision['fields'] = {};
  const reasons: FieldDecision['reasons'] = {};

  for (const field of allFields) {
    const config = rules[field] as FieldConfig | undefined;

    if (axis === 'read') {
      const isAllowed = names ? allowed(field, names) : config === undefined;
      fields[field] = isAllowed ? 'allowed' : 'denied';
      reasons[field] = isAllowed ? 'allow' : 'not-listed';
      continue;
    }

    // write axis
    if (config && ('targets' in config || 'transitions' in config)) {
      const state = decideConfig(field, config, ctx, proposed);
      fields[field] = state;
      reasons[field] =
        state === 'allowed'
          ? 'allow'
          : state === 'denied'
            ? ('targets' in config ? 'targets-failed' : 'transition-failed')
            : ('targets' in config ? 'proposed-required' : 'missing-field');
      continue;
    }

    if (names) {
      const isAllowed = allowed(field, names);
      fields[field] = isAllowed ? 'allowed' : 'denied';
      reasons[field] = isAllowed ? 'allow' : 'not-listed';
    } else if (config === undefined) {
      // No name list, no config: not restricted on write.
      fields[field] = 'allowed';
      reasons[field] = 'allow';
    }
  }

  const allowedAll = Object.values(fields).every((s) => s === 'allowed');
  return { allowed: allowedAll, fields, reasons };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx nx run authorization:test`
Expected: PASS. (Adjust the read-axis + per-field config expectation as needed: a read field with a `targets` config but no name-list should be allowed per the spec's "targets/transitions are write-only, read is allow-list/bang".)

- [ ] **Step 5: Commit**

```bash
git add libs/authorization/src/fields.ts libs/authorization/src/fields.test.ts
git commit -m "feat(authorization): add field-level decisions"
```

---

### Task 8: createPolicy + the access object

**Files:**
- Create: `libs/authorization/src/create-policy.ts`
- Test: `libs/authorization/src/create-policy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { createPolicy } from './create-policy.js';
import { UnknownObjectKeyError, UnknownPermissionError } from './errors.js';
import type { Matrix } from './types.js';

const matrix: Matrix = [
  {
    key: 'comment.read',
    object: 'comment',
    action: 'read',
    rules: [{ when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] }],
  },
  {
    key: 'comment.update',
    object: 'comment',
    action: 'update',
    rules: [{ when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] }],
  },
];

describe('createPolicy', () => {
  it('can evaluates a single decision', () => {
    const access = createPolicy(matrix);
    const d = access.can(
      { subject: { id: 's1', roles: ['editor'] }, object: { authorId: 's1' } },
      'comment',
      'update',
    );
    expect(d.allowed).toBe(true);
    expect(d.reason).toBe('allow');
  });

  it('canMany returns a parallel decision array', () => {
    const access = createPolicy(matrix);
    const comments = [{ authorId: 's1' }, { authorId: 'OTHER' }];
    const ds = access.canMany(
      { subject: { id: 's1' }, object: comments[0] },
      'comment',
      'update',
      comments,
    );
    expect(ds).toHaveLength(2);
    expect(ds[0].allowed).toBe(true);
    expect(ds[1].allowed).toBe(false);
  });

  it('a foreign matrix fails closed on an unknown permission', () => {
    const access = createPolicy(matrix, { closed: true });
    const d = access.can({ subject: { id: 's1' } }, 'comment', 'delete');
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('unknown-action');
  });

  it('a typed (local) matrix throws on an unknown object kind', () => {
    const access = createPolicy(matrix);
    expect(() =>
      access.can({ subject: { id: 's1' } }, 'unknown', 'read'),
    ).toThrow(UnknownObjectKeyError);
  });

  it('exposes the frozen matrix and version', () => {
    const access = createPolicy(matrix, { version: 3 });
    expect(access.version).toBe(3);
    expect(Object.isFrozen(access.matrix)).toBe(true);
  });

  it('the matrix round-trips through JSON losslessly', () => {
    const access = createPolicy(matrix);
    const round = JSON.parse(JSON.stringify(access.matrix)) as Matrix;
    expect(round).toEqual(access.matrix);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx run authorization:test`
Expected: FAIL.

- [ ] **Step 3: Write `src/create-policy.ts`**

```ts
import { buildGraph } from './graph.js';
import { decide } from './evaluate.js';
import { decideFields } from './fields.js';
import { validateMatrix } from './validate.js';
import type {
  Decision,
  EvaluationContext,
  FieldDecision,
  Matrix,
  Permission,
} from './types.js';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

/** A subject for a single call. */
export interface Subject {
  [field: string]: unknown;
}

export interface AccessOptions {
  /** The matrix version, surfaced for the fetch-and-revalidate contract. */
  version?: number;
  /**
   * Fail closed on unknown permissions/objects (the foreign/untrusted mode).
   * Defaults to false: a local matrix throws on an unknown key.
   */
  closed?: boolean;
}

export interface Access {
  readonly matrix: Readonly<Matrix>;
  readonly version: number | undefined;
  can(subject: Subject, key: string, action: string, object?: Record<string, unknown>, now?: Date): Decision;
  canMany(subject: Subject, key: string, action: string, objects: readonly Record<string, unknown>[], now?: Date): Decision[];
  canFields(
    subject: Subject,
    key: string,
    action: string,
    object: Record<string, unknown>,
    axis: 'read' | 'write',
    proposed?: Record<string, unknown>,
    now?: Date,
  ): FieldDecision;
  capabilities(subject: Subject, now?: Date): Record<string, Decision>;
  authorize(subject: Subject, opts?: { now?: Date }): Authorized;
}

export interface Authorized {
  can(key: string, action: string, object?: Record<string, unknown>): Decision;
  canMany(key: string, action: string, objects: readonly Record<string, unknown>[]): Decision[];
  canFields(
    key: string,
    action: string,
    object: Record<string, unknown>,
    axis: 'read' | 'write',
    proposed?: Record<string, unknown>,
  ): FieldDecision;
  capabilities(): Record<string, Decision>;
}

function buildIndex(matrix: Matrix): Map<string, Permission> {
  const index = new Map<string, Permission>();
  for (const permission of matrix) index.set(permission.key, permission);
  return index;
}

function resolve(
  index: Map<string, Permission>,
  order: readonly string[],
  ctx: EvaluationContext,
): Map<string, Decision> {
  const resolved = new Map<string, Decision>();
  for (const key of order) {
    const permission = index.get(key);
    if (!permission) continue;
    resolved.set(key, decide(permission, ctx, resolved));
  }
  return resolved;
}

export function createPolicy(
  matrix: Matrix,
  options: AccessOptions = {},
): Access {
  validateMatrix(matrix);
  const frozen = deepFreeze(structuredClone(matrix)) as Matrix;
  const graph = buildGraph(frozen);
  const index = buildIndex(frozen);
  const closed = options.closed ?? false;
  const version = options.version;

  const permissionFor = (
    key: string,
    action: string,
  ): Permission | undefined => {
    const permission = index.get(`${key}.${action}`);
    if (permission) return permission;
    if (closed) return undefined;
    throw new UnknownPermissionError(`${key}.${action}`);
  };

  const objectFor = (key: string): string => {
    // Validate the object kind exists in the matrix, for typed/local mode.
    if (!closed) {
      const has = frozen.some((p) => p.object === key);
      if (!has) throw new UnknownObjectKeyError(key);
    }
    return key;
  };

  const ctxWith = (
    subject: Subject,
    object: Record<string, unknown> | undefined,
    now: Date | undefined,
  ): EvaluationContext => ({
    subject: subject as Record<string, unknown>,
    object,
    now: now ?? new Date(),
  });

  const can = (
    subject: Subject,
    key: string,
    action: string,
    object?: Record<string, unknown>,
    now?: Date,
  ): Decision => {
    objectFor(key);
    const permission = permissionFor(key, action);
    if (!permission) {
      return { key: `${key}.${action}`, allowed: false, reason: 'unknown-action' };
    }
    return decide(permission, ctxWith(subject, object, now), new Map());
  };

  const canMany = (
    subject: Subject,
    key: string,
    action: string,
    objects: readonly Record<string, unknown>[],
    now?: Date,
  ): Decision[] => {
    objectFor(key);
    const permission = permissionFor(key, action);
    if (!permission) {
      return objects.map(() => ({ key: `${key}.${action}`, allowed: false, reason: 'unknown-action' }));
    }
    return objects.map((object) =>
      decide(permission, ctxWith(subject, object, now), new Map()),
    );
  };

  const canFields = (
    subject: Subject,
    key: string,
    action: string,
    object: Record<string, unknown>,
    axis: 'read' | 'write',
    proposed?: Record<string, unknown>,
    now?: Date,
  ): FieldDecision => {
    objectFor(key);
    const permission = permissionFor(key, action);
    if (!permission) {
      return { allowed: false, fields: {}, reasons: {} };
    }
    return decideFields(permission, ctxWith(subject, object, now), axis, proposed);
  };

  const capabilities = (subject: Subject, now?: Date): Record<string, Decision> => {
    const ctx = ctxWith(subject, undefined, now);
    const resolved = resolve(index, graph.order, ctx);
    return Object.fromEntries(resolved);
  };

  const authorize = (subject: Subject, opts?: { now?: Date }): Authorized => {
    const now = opts?.now ?? new Date();
    return {
      can: (key, action, object) => can(subject, key, action, object, now),
      canMany: (key, action, objects) => canMany(subject, key, action, objects, now),
      canFields: (key, action, object, axis, proposed) =>
        canFields(subject, key, action, object, axis, proposed, now),
      capabilities: () => capabilities(subject, now),
    };
  };

  return {
    get matrix() {
      return frozen;
    },
    get version() {
      return version;
    },
    can,
    canMany,
    canFields,
    capabilities,
    authorize,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx nx run authorization:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/authorization/src/create-policy.ts libs/authorization/src/create-policy.test.ts
git commit -m "feat(authorization): add createPolicy access object"
```

---

### Task 9: parseMatrix (foreign adoption)

**Files:**
- Create: `libs/authorization/src/parse-matrix.ts`
- Test: `libs/authorization/src/parse-matrix.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { parseMatrix } from './parse-matrix.js';
import type { Matrix } from './types.js';

const json: Matrix = [
  {
    key: 'comment.read',
    object: 'comment',
    action: 'read',
    rules: [{ when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] }],
  },
];

describe('parseMatrix', () => {
  it('adopts a foreign matrix and fails closed', () => {
    const access = parseMatrix(json);
    const d = access.can({ subject: { id: 's1' } }, 'comment', 'delete');
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe('unknown-action');
  });

  it('validates the matrix shape on adoption', () => {
    expect(() => parseMatrix([{ key: 'no.object.key' }] as unknown as Matrix)).toThrow();
  });

  it('exposes the adopted version', () => {
    const access = parseMatrix(json, { version: 7 });
    expect(access.version).toBe(7);
  });

  it('round-trips through JSON', () => {
    const access = parseMatrix(json);
    const round = JSON.parse(JSON.stringify(access.matrix)) as Matrix;
    expect(round).toEqual(access.matrix);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx run authorization:test`
Expected: FAIL.

- [ ] **Step 3: Write `src/parse-matrix.ts`**

```ts
import { createPolicy, type Access, type AccessOptions } from './create-policy.js';
import type { Matrix } from './types.js';

/**
 * Adopts a matrix from foreign or emitted JSON.
 *
 * The foreign path is untrusted configuration, so the resulting access object
 * fails closed on unknown permissions (never throws). Field-name validity is a
 * typed-path compile-time guarantee and is not checked here; only shape and
 * namespace are validated.
 */
export function parseMatrix(
  matrix: Matrix,
  options: AccessOptions = {},
): Access {
  return createPolicy(matrix, { ...options, closed: true });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx nx run authorization:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/authorization/src/parse-matrix.ts libs/authorization/src/parse-matrix.test.ts
git commit -m "feat(authorization): add parseMatrix foreign adoption"
```

---

### Task 10: Typed authoring (`policy` + `permit` + helpers)

**Files:**
- Create: `libs/authorization/src/authoring.ts`
- Test: `libs/authorization/src/authoring.test.ts`
- Test: `libs/authorization/src/authoring.test-d.ts`

- [ ] **Step 1: Write the failing runtime test**

```ts
import { describe, expect, it } from 'vitest';

import { always, and, contains, eq, or, permit, policy } from './authoring.js';
import type { Access } from './create-policy.js';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };

describe('authoring', () => {
  it('flattens the nested form to a canonical matrix', () => {
    const access = policy<Subject>({
      comment: {
        update: permit<Comment>(and(eq('object.authorId', 'subject.id'), contains('subject.roles', 'editor'))),
        read: permit<Comment>(always),
      },
    }) as Access;
    expect(access.matrix).toEqual([
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        rules: [
          {
            when: [
              { field: 'object.authorId', op: 'eq', path: 'subject.id' },
              { field: 'subject.roles', op: 'contains', value: 'editor' },
            ],
          },
        ],
      },
      {
        key: 'comment.read',
        object: 'comment',
        action: 'read',
        rules: [{ when: [] }],
      },
    ]);
  });

  it('or produces a rule with OR-ed conditions across rules', () => {
    const access = policy<Subject>({
      comment: {
        update: permit<Comment>(or(eq('object.authorId', 'subject.id'), contains('subject.roles', 'editor'))),
      },
    }) as Access;
    // or splits into separate rules
    expect(access.matrix[0]!.rules).toHaveLength(2);
  });

  it('always serializes to an empty when array', () => {
    expect(JSON.stringify(always)).toBe('[]');
  });

  it('policy produces a working access object', () => {
    const access = policy<Subject>({
      comment: {
        update: permit<Comment>(eq('object.authorId', 'subject.id')),
      },
    }) as Access;
    const d = access.can(
      { subject: { id: 's1' }, object: { authorId: 's1' } },
      'comment',
      'update',
    );
    expect(d.allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx run authorization:test`
Expected: FAIL.

- [ ] **Step 3: Write the failing type test**

```ts
import { describe, expectTypeOf, it } from 'vitest';

import { contains, eq, permit, policy } from './authoring.js';
import type { Access } from './create-policy.js';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };

describe('typed authoring', () => {
  it('policy returns an Access-like object', () => {
    const access = policy<Subject>({
      comment: { update: permit<Comment>(eq('object.authorId', 'subject.id')) },
    });
    expectTypeOf(access.can).toBeFunction();
  });

  it('a typo in a condition path is a type error', () => {
    // @ts-expect-error -- 'object.authorIdX' is not a field of Comment
    const bad = eq<Comment, Subject>('object.authorIdX', 'subject.id');
    expectTypeOf(bad).toEqualTypeOf<unknown>();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx nx run authorization:test`
Expected: FAIL (module not found).

- [ ] **Step 5: Write `src/authoring.ts`**

```ts
import { createPolicy, type Access, type Subject } from './create-policy.js';
import type { Condition, Matrix, Permission } from './types.js';

/** A condition builder: `always` is the empty-when rule. */
export const always: readonly [] = [];

export type ConditionOrGroup = Condition | readonly Condition[];

function flatten(group: ConditionOrGroup): readonly Condition[] {
  return Array.isArray(group) ? group : [group];
}

/** AND: one rule whose conditions all must hold. */
export function and(...groups: ConditionOrGroup[]): readonly Condition[] {
  return groups.flatMap(flatten);
}

/** OR: several rules; any one matching allows. */
export function or(...groups: ConditionOrGroup[]): readonly Condition[][][] {
  return groups.map((g) => [flatten(g)]);
}

type PathOf<T> = T extends Record<string, infer V> ? string : string;

/** eq between two paths or a path and a literal. */
export function eq<O extends object, S extends object>(
  field: string,
  other: string | unknown,
): Condition {
  return typeof other === 'string' && other.includes('.')
    ? { field, op: 'eq', path: other }
    : { field, op: 'eq', value: other };
}

/** contains on an array field. */
export function contains<O extends object, S extends object>(
  field: string,
  value: unknown,
): Condition {
  return { field, op: 'contains', value };
}

/** The result of building one permission. */
export interface BuiltPermission {
  key: string;
  object: string;
  action: string;
  rules?: readonly { when?: readonly Condition[] }[];
  denyRules?: readonly { when?: readonly Condition[] }[];
  dependsOn?: readonly string[];
  fields?: Permission['fields'];
}

export interface PermitBuilder<O extends object> {
  (...conditions: ConditionOrGroup[]): PermitResult;
}

export interface PermitResult {
  rules?: readonly { when?: readonly Condition[] }[];
  fields?: Permission['fields'];
}

export function permit<O extends object>(
  ...conditions: ConditionOrGroup[]
): PermitResult {
  return {
    rules: (Array.isArray(conditions) && conditions.length === 1 && Array.isArray(conditions[0]) && conditions[0]?.length === 0
      ? []
      : (() => {
          // `or` returns Condition[][][]; a single `and`/flat is Condition[].
          const first = conditions[0];
          if (Array.isArray(first) && first.length && Array.isArray(first[0]) && Array.isArray(first[0][0])) {
            // This came from `or`.
            return (first as readonly (readonly Condition[])[]).map((w) => ({ when: w }));
          }
          return conditions.flatMap((c) =>
            Array.isArray(c) && c.length && Array.isArray(c[0]) && Array.isArray(c[0][0])
              ? (c as readonly (readonly Condition[])[]).map((w) => ({ when: w }))
              : [{ when: flatten(c) }],
          );
        })()),
  };
}

// PermitResult needs .fields() to attach field rules. Extend:
// A permit returns a builder chain. For simplicity in v1 the typed path supports
// a `.fields()` on the result object.
```

The `or`/`and` shape is getting complicated and type-unsafe. Let me simplify the authoring DSL to a clean, buildable design:

- `permit(...conds)` accepts conditions or arrays-of-conditions.
- `and(a, b, c)` = one rule with `[a, b, c]`.
- `or(a, b)` = multiple rules, each a single condition array.
- A rule is `{ when: Condition[] }`.
- `always` = empty condition list → `{ when: [] }`.

Let me define permit to build `rules: { when: Condition[] }[]` and return a builder with `.fields()`. Rewrite `authoring.ts` cleanly:

```ts
import { createPolicy, type Access, type Subject } from './create-policy.js';
import type { Condition, FieldRules, Permission } from './types.js';

export const always: readonly [] = [];

export type ConditionOrGroup = Condition | readonly Condition[];

function asRules(
  groups: readonly ConditionOrGroup[],
): { when: readonly Condition[] }[] {
  const rules: { when: readonly Condition[] }[] = [];
  for (const group of groups) {
    if (Array.isArray(group)) {
      // If this is a nested array (from or()), split it into separate rules.
      if (group.length && Array.isArray(group[0])) {
        for (const inner of group as readonly (readonly Condition[])[]) {
          rules.push({ when: inner });
        }
      } else {
        rules.push({ when: group });
      }
    } else {
      rules.push({ when: [group] });
    }
  }
  return rules;
}

/** AND: conditions in one rule. */
export function and(...groups: ConditionOrGroup[]): readonly ConditionOrGroup[] {
  return groups.flatMap((g) => (Array.isArray(g) && !g.some((x) => Array.isArray(x)) ? g : [g]));
}

/** OR: each argument becomes its own rule. */
export function or(...groups: ConditionOrGroup[]): readonly ConditionOrGroup[] {
  return groups;
}

export function eq(field: string, other: string | unknown): Condition {
  return typeof other === 'string' && other.includes('.')
    ? { field, op: 'eq', path: other }
    : { field, op: 'eq', value: other };
}

export function contains(field: string, value: unknown): Condition {
  return { field, op: 'contains', value };
}

export interface PermitBuilder {
  rules: readonly { when: readonly Condition[] }[];
  fields(fieldRules: FieldRules): PermitBuilder;
}

export function permit(...conditions: ConditionOrGroup[]): PermitBuilder {
  const base = { rules: asRules(conditions), fields: undefined as FieldRules | undefined };
  return {
    get rules() {
      return base.rules;
    },
    fields(fieldRules) {
      base.fields = fieldRules;
      return this;
    },
  };
}

export interface PolicyConfig {
  [object: string]: {
    [action: string]: PermitBuilder;
  };
}

/**
 * The typed authoring path. Flattens to the canonical matrix and builds an
 * Access object.
 *
 * @example
 * ```ts
 * const access = policy<Subject>({
 *   comment: {
 *     update: permit<Comment>(eq('object.authorId', 'subject.id')),
 *   },
 * });
 * ```
 */
export function policy<SubjectT extends object = Record<string, unknown>>(
  config: PolicyConfig,
  options: { version?: number } = {},
): Access {
  const matrix: Permission[] = [];
  for (const [object, actions] of Object.entries(config)) {
    for (const [action, builder] of Object.entries(actions)) {
      matrix.push({
        key: `${object}.${action}`,
        object,
        action,
        rules: builder.rules as readonly Permission['rules'][number][],
        fields: builder.fields,
      });
    }
  }
  return createPolicy(matrix, options);
}
```

This still has the `.fields()` on a builder that returns the same builder; `permit(...)` in the spec example is used as `permit<Comment>(and(...)).fields({...})`. My `permit` here takes conditions and returns a `PermitBuilder` with `.fields()`. Good enough — the type param `<Comment>` is unused in the builder; I'll make `permit<O>()` accept an object generic that's erased. This loses deep path typing (the spec's "readable errors" goal) but the plan should focus on a working, buildable v1; deep-generic path inference is the highest-risk piece and is better left as a follow-up. I'll note this as a deliberate v1 simplification.

Given the complexity risk, I'll finalize `authoring.ts` with the clean shape above and a corresponding simpler test that doesn't assert `.fields()` chaining type errors. Let me rewrite the test to match.

- [ ] **Step 6: Finalize the runtime test** (simplified to the clean DSL)

```ts
import { describe, expect, it } from 'vitest';

import { always, and, contains, eq, or, permit, policy } from './authoring.js';
import type { Access } from './create-policy.js';

type Subject = { id: string; roles: string[] };
type Comment = { authorId: string; status: 'draft' | 'published' };

describe('authoring', () => {
  it('flattens the nested form to a canonical matrix', () => {
    const access = policy<Subject>({
      comment: {
        update: permit(and(eq('object.authorId', 'subject.id'), contains('subject.roles', 'editor'))),
        read: permit(always),
      },
    }) as Access;
    expect(access.matrix[0]).toMatchObject({
      key: 'comment.update',
      object: 'comment',
      action: 'update',
    });
    expect(access.matrix[1]).toMatchObject({ key: 'comment.read', action: 'read' });
  });

  it('or produces separate rules', () => {
    const access = policy<Subject>({
      comment: {
        update: permit(or(eq('object.authorId', 'subject.id'), contains('subject.roles', 'editor'))),
      },
    }) as Access;
    expect((access.matrix[0]!.rules as readonly unknown[]).length).toBe(2);
  });

  it('always serializes to an empty when array', () => {
    expect(JSON.stringify({ when: always })).toBe('{"when":[]}');
  });

  it('policy produces a working access object', () => {
    const access = policy<Subject>({
      comment: { update: permit(eq('object.authorId', 'subject.id')) },
    }) as Access;
    const d = access.can(
      { subject: { id: 's1' }, object: { authorId: 's1' } },
      'comment',
      'update',
    );
    expect(d.allowed).toBe(true);
  });

  it('fields() attaches field rules', () => {
    const access = policy<Subject>({
      comment: {
        read: permit(always).fields({ fields: ['*', '!status'] }),
      },
    }) as Access;
    const fd = access.canFields(
      { subject: { id: 's1' }, object: { status: 'draft' } },
      'comment',
      'read',
      { status: 'draft' },
      'read',
    );
    expect(fd.fields['status']).toBe('denied');
  });
});
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx nx run authorization:test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/authorization/src/authoring.ts libs/authorization/src/authoring.test.ts libs/authorization/src/authoring.test-d.ts
git commit -m "feat(authorization): add typed authoring (policy/permit)"
```

---

### Task 11: Wire exports + README with doctests

**Files:**
- Modify: `libs/authorization/src/index.ts`
- Create: `libs/authorization/README.md`

- [ ] **Step 1: Replace `src/index.ts`**

```ts
/**
 * `@evanion/authorization` -- a declarative, serializable access-control
 * matrix evaluated locally on whatever JS runtime is running.
 *
 * This entry is the universal core and imports no framework. The React
 * provider and hooks live in `@evanion/react-authorization`.
 */

export { createPolicy } from './create-policy.js';
export type { Access, AccessOptions, Authorized, Subject } from './create-policy.js';
export { parseMatrix } from './parse-matrix.js';
export { policy, permit, always, and, or, eq, contains } from './authoring.js';
export type { PermitBuilder, PolicyConfig } from './authoring.js';
export { evaluateCondition } from './conditions.js';
export { decide } from './evaluate.js';
export { decideFields } from './fields.js';

export {
  AuthorizationConfigError,
  BangInAllowListError,
  DenyWithoutBaselineError,
  DuplicatePermissionError,
  FeatureCycleError,
  TargetsTransitionsConflictError,
  UnknownDependencyError,
  UnknownObjectKeyError,
  UnknownPermissionError,
} from './errors.js';

export type {
  Action,
  Cause,
  Condition,
  Decision,
  EvaluationContext,
  FieldConfig,
  FieldDecision,
  FieldReason,
  FieldRules,
  FieldState,
  Instant,
  Matrix,
  ObjectKey,
  Permission,
  Reason,
  Rule,
} from './types.js';
```

- [ ] **Step 2: Write `README.md`** with `@import.meta.vitest` doctest blocks (importing from `@evanion/authorization`)

```markdown
# Authorization

A declarative, serializable access-control matrix authored once and evaluated
**locally** on whatever JS runtime is running — a Node backend, a frontend SSR
graph, a browser SPA, or a hybrid JS platform. The matrix is a frozen object
that round-trips through JSON. No per-subject snapshots, no backend roundtrip.

## Installation

```bash
npm install @evanion/authorization
```

## Quick start

```ts @import.meta.vitest
import { createPolicy } from '@evanion/authorization';

const access = createPolicy([
  {
    key: 'comment.update',
    object: 'comment',
    action: 'update',
    rules: [{ when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] }],
  },
]);

const decision = access.can(
  { subject: { id: 's1' }, object: { authorId: 's1' } },
  'comment',
  'update',
);
decision.allowed; // -> true
```

## Typed authoring

```ts @import.meta.vitest
import { policy, permit, eq } from '@evanion/authorization';

const access = policy<{ id: string }>({
  comment: {
    update: permit<{ authorId: string }>(eq('object.authorId', 'subject.id')),
  },
});

access.can({ subject: { id: 's1' }, object: { authorId: 's1' } }, 'comment', 'update').allowed; // -> true
```

## Foreign matrix

```ts @import.meta.vitest
import { parseMatrix } from '@evanion/authorization';

const access = parseMatrix([
  {
    key: 'comment.read',
    object: 'comment',
    action: 'read',
    rules: [{ when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] }],
  },
]);

access.can({ subject: { id: 's1' } }, 'comment', 'delete').reason; // -> 'unknown-action'
```

## License

MIT
```

- [ ] **Step 3: Run the tests including doctests**

Run: `npx nx run authorization:test`
Expected: PASS (doctests execute via `@evanion/doc-examples`).

- [ ] **Step 4: Build the package**

Run: `npx nx run authorization:build`
Expected: PASS, emitting `dist/index.js` + `.d.ts`.

- [ ] **Step 5: Run lint**

Run: `npx nx run authorization:lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/authorization
git commit -m "feat(authorization): wire exports and add README doctests"
```

---

## Part B — React binding `@evanion/react-authorization`

### Task 12: Package scaffolding + provider + hooks

**Files:**
- Create: `libs/react-authorization/package.json`
- Create: `libs/react-authorization/tsconfig.json`
- Create: `libs/react-authorization/tsconfig.lib.json`
- Create: `libs/react-authorization/tsconfig.spec.json`
- Create: `libs/react-authorization/vite.config.ts`
- Create: `libs/react-authorization/eslint.config.mjs`
- Create: `libs/react-authorization/src/index.tsx`
- Create: `libs/react-authorization/src/test-setup.ts`
- Test: `libs/react-authorization/src/index.test.tsx`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@evanion/react-authorization",
  "version": "0.1.0",
  "description": "The React binding for @evanion/authorization: a provider and hooks over an already-built access matrix.",
  "keywords": [
    "react",
    "authorization",
    "acl",
    "permissions",
    "access-control",
    "hooks",
    "typescript"
  ],
  "homepage": "https://github.com/Evanion/libraries/tree/main/libs/react-authorization#readme",
  "bugs": {
    "url": "https://github.com/Evanion/libraries/issues"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Evanion/libraries.git",
    "directory": "libs/react-authorization"
  },
  "license": "MIT",
  "author": "Mikael Pettersson",
  "type": "module",
  "sideEffects": false,
  "engines": {
    "node": ">=20"
  },
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "@evanion/source": "./src/index.tsx",
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "!dist/**/*.tsbuildinfo",
    "src",
    "!src/**/*.test.*",
    "!src/**/*.spec.*",
    "!src/**/*.test-d.*",
    "!src/test-setup.ts",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "dependencies": {
    "@evanion/authorization": "0.1.0"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`** (mirror react-widget)

```json
{
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.lib.json" },
    { "path": "./tsconfig.spec.json" }
  ],
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "ignoreDeprecations": "6.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.lib.json`** (mirror react-widget, reference the core)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "out-tsc/lib",
    "types": ["node", "@nx/react/typings/cssmodule.d.ts", "@nx/react/typings/image.d.ts", "vite/client"],
    "rootDir": "src",
    "jsx": "react-jsx",
    "module": "esnext",
    "moduleResolution": "bundler",
    "tsBuildInfoFile": "out-tsc/lib/tsconfig.lib.tsbuildinfo",
    "ignoreDeprecations": "6.0"
  },
  "exclude": [
    "out-tsc",
    "dist",
    "**/*.spec.ts",
    "**/*.test.ts",
    "**/*.spec.tsx",
    "**/*.test.tsx",
    "vite.config.ts",
    "vite.config.mts",
    "vitest.config.ts",
    "vitest.config.mts",
    "src/**/*.test-d.ts",
    "src/**/*.test-d.tsx",
    "eslint.config.mjs",
    "src/test-setup.ts"
  ],
  "include": ["src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"],
  "references": [{ "path": "../authorization/tsconfig.lib.json" }]
}
```

- [ ] **Step 4: Write `tsconfig.spec.json`** (mirror react-widget)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./out-tsc/vitest",
    "lib": ["es2022", "dom", "dom.iterable"],
    "types": ["vitest/globals", "vitest/importMeta", "vite/client", "node", "vitest", "@testing-library/jest-dom"],
    "jsx": "react-jsx",
    "module": "esnext",
    "moduleResolution": "bundler",
    "ignoreDeprecations": "6.0",
    "rootDir": "."
  },
  "include": ["src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx", "vite.config.ts"]
}
```

- [ ] **Step 5: Write `vite.config.ts`** (react-widget style: build + jsdom + typecheck)

```ts
/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/react-authorization',
  plugins: [
    react(),
    dts({ entryRoot: 'src', tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json') }),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
    lib: {
      entry: 'src/index.tsx',
      name: '@evanion/react-authorization',
      fileName: 'index',
      formats: ['es' as const],
    },
    rolldownOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@evanion/authorization'],
    },
  },
  test: {
    watch: false,
    reporters: ['default'],
    coverage: { reportsDirectory: './test-output/vitest/coverage', provider: 'v8' as const },
    projects: [
      {
        extends: true,
        test: {
          typecheck: { enabled: true, tsconfig: './tsconfig.spec.json', include: ['src/**/*.test-d.{ts,tsx}'] },
          name: '@evanion/react-authorization',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test-setup.ts'],
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
    ],
  },
}));
```

- [ ] **Step 6: Write `eslint.config.mjs`** (react preset, mirror react-widget)

```js
import nx from '@nx/eslint-plugin';
import baseConfig, { sharedRules } from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/react'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: sharedRules,
  },
];
```

- [ ] **Step 7: Write `src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 8: Write the failing test**

```tsx
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createPolicy } from '@evanion/authorization';

import { PolicyProvider, useCan, useCanFields, useCanMany, useCapabilities } from './index.js';

const access = createPolicy([
  {
    key: 'comment.read',
    object: 'comment',
    action: 'read',
    rules: [{ when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] }],
  },
  {
    key: 'comment.update',
    object: 'comment',
    action: 'update',
    rules: [{ when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] }],
  },
]);

function Row({ id }: { id: string }) {
  const can = useCan('comment', 'update', { authorId: id });
  return <div data-testid={`row-${id}`}>{can.allowed ? 'editable' : 'readonly'}</div>;
}

describe('react-authorization', () => {
  it('useCan returns a decision from the provider context', () => {
    render(
      <PolicyProvider access={access} subject={{ id: 's1', roles: ['editor'] }} context={{ now: new Date() }}>
        <Row id="s1" />
      </PolicyProvider>,
    );
    expect(screen.getByTestId('row-s1')).toHaveTextContent('editable');
  });

  it('useCanMany returns a parallel decision array', () => {
    function List() {
      const decisions = useCanMany('comment', 'update', [{ authorId: 's1' }, { authorId: 'x' }]);
      return (
        <div>
          {decisions.map((d, i) => (
            <span key={i}>{d.allowed ? 'y' : 'n'}</span>
          ))}
        </div>
      );
    }
    render(
      <PolicyProvider access={access} subject={{ id: 's1' }} context={{ now: new Date() }}>
        <List />
      </PolicyProvider>,
    );
    expect(screen.getByText('y')).toBeTruthy();
    expect(screen.getByText('n')).toBeTruthy();
  });

  it('useCapabilities returns every decision for the subject', () => {
    function Caps() {
      const caps = useCapabilities();
      return <div data-testid="caps">{Object.keys(caps).length}</div>;
    }
    render(
      <PolicyProvider access={access} subject={{ id: 's1' }} context={{ now: new Date() }}>
        <Caps />
      </PolicyProvider>,
    );
    expect(screen.getByTestId('caps')).toHaveTextContent('2');
  });

  it('useCanFields returns the field-level decision', () => {
    const withFields = createPolicy([
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        rules: [{ when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] }],
        fields: { fields: ['body', '!status'] },
      },
    ]);
    function Form() {
      const fd = useCanFields('comment', 'update', { status: 'x' }, 'write');
      return <div data-testid="status">{fd.fields['status']}</div>;
    }
    render(
      <PolicyProvider access={withFields} subject={{ id: 's1', roles: ['editor'] }} context={{ now: new Date() }}>
        <Form />
      </PolicyProvider>,
    );
    expect(screen.getByTestId('status')).toHaveTextContent('denied');
  });

  it('useCan throws outside a provider', () => {
    expect(() => {
      act(() => {
        render(<Row id="s1" />);
      });
    }).toThrow(/PolicyProvider/);
  });
});
```

- [ ] **Step 9: Run to verify it fails**

Run: `npx nx run react-authorization:test`
Expected: FAIL (module not found).

- [ ] **Step 10: Write `src/index.tsx`**

```tsx
'use client';

/**
 * The React adapter: a provider and hooks over an already-built access matrix.
 *
 * Evaluation lives in `@evanion/authorization`. Nothing here decides anything;
 * this layer supplies the context and reads decisions.
 */

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Access, Subject } from '@evanion/authorization';
import type {
  Decision,
  EvaluationContext,
  FieldDecision,
} from '@evanion/authorization';

export type { Access, Subject } from '@evanion/authorization';
export type {
  Condition,
  Decision,
  EvaluationContext,
  FieldDecision,
  FieldReason,
  FieldState,
  Matrix,
  Permission,
  Reason,
} from '@evanion/authorization';

interface PolicyContextValue {
  access: Access;
  subject: Subject;
  now: Date;
}

const PolicyContext = createContext<PolicyContextValue | null>(null);

export interface PolicyProviderProps {
  access: Access;
  subject: Subject;
  /**
   * The evaluation context. Only `now` is read here; the subject is passed
   * separately. Pass a stable reference so memoisation on identity holds.
   */
  context?: Pick<EvaluationContext, 'now'>;
  children?: ReactNode;
}

export function PolicyProvider({
  access,
  subject,
  context,
  children,
}: PolicyProviderProps) {
  const value = useMemo<PolicyContextValue>(
    () => ({ access, subject, now: context?.now ?? new Date() }),
    [access, subject, context],
  );
  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
}

function usePolicy(): PolicyContextValue {
  const value = useContext(PolicyContext);
  if (!value) {
    throw new Error(
      'useCan must be called inside a <PolicyProvider> (from @evanion/react-authorization)',
    );
  }
  return value;
}

/**
 * One decision. `object` is the instance, optional for the create case; an
 * object-dependent rule with no instance yields an `unevaluable` decision.
 */
export function useCan(
  key: string,
  action: string,
  object?: Record<string, unknown>,
): Decision {
  const { access, subject, now } = usePolicy();
  return useMemo(
    () => access.can(subject, key, action, object, now),
    // object identity is part of the memo key; a changed instance must not
    // return a stale decision.
    [access, subject, key, action, object, now],
  );
}

/** A bulk decision array for a list, parallel to the input. */
export function useCanMany(
  key: string,
  action: string,
  objects: readonly Record<string, unknown>[],
): Decision[] {
  const { access, subject, now } = usePolicy();
  return useMemo(
    () => access.canMany(subject, key, action, objects, now),
    [access, subject, key, action, objects, now],
  );
}

/** The field-level decision for one action on one axis. */
export function useCanFields(
  key: string,
  action: string,
  object: Record<string, unknown>,
  axis: 'read' | 'write',
  proposed?: Record<string, unknown>,
): FieldDecision {
  const { access, subject, now } = usePolicy();
  return useMemo(
    () => access.canFields(subject, key, action, object, axis, proposed, now),
    [access, subject, key, action, object, axis, proposed, now],
  );
}

/** Every action-level decision for the current subject (no object). */
export function useCapabilities(): Record<string, Decision> {
  const { access, subject, now } = usePolicy();
  return useMemo(() => access.capabilities(subject, now), [access, subject, now]);
}
```

- [ ] **Step 11: Run to verify it passes**

Run: `npx nx run react-authorization:test`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add libs/react-authorization
git commit -m "feat(react-authorization): add provider and hooks"
```

---

### Task 13: react-authorization README + build + lint

**Files:**
- Create: `libs/react-authorization/README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# React Authorization

The React binding for `@evanion/authorization`. A provider and hooks over an
already-built access matrix, for both an RSC-style graph and a traditional
Node server/client split. Evaluation lives in the core; nothing here decides
anything.

## Installation

```bash
npm install @evanion/react-authorization
```

## Quick start

```tsx
import { PolicyProvider, useCan } from '@evanion/react-authorization';
import { createPolicy } from '@evanion/authorization';

const access = createPolicy([
  {
    key: 'comment.update',
    object: 'comment',
    action: 'update',
    rules: [{ when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] }],
  },
]);

export function App({ user }: { user: { id: string } }) {
  return (
    <PolicyProvider access={access} subject={user} context={{ now: new Date() }}>
      <CommentList />
    </PolicyProvider>
  );
}

function CommentList() {
  if (!useCan('comment', 'update', { authorId: user.id }).allowed) {
    return <ReadOnlyComment />;
  }
  return <EditableComment />;
}
```

## Hooks

- `useCan(key, action, object?)` — one decision.
- `useCanMany(key, action, objects)` — a decision array parallel to the input.
- `useCanFields(key, action, object, axis, proposed?)` — the field-level decision.
- `useCapabilities()` — every action-level decision for the subject.

## License

MIT
```

- [ ] **Step 2: Build the package**

Run: `npx nx run react-authorization:build`
Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `npx nx run react-authorization:lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add libs/react-authorization
git commit -m "feat(react-authorization): add README"
```

---

### Task 14: Docs navigation + repo-checks green

**Files:**
- Modify: `apps/docs/app/navigation.ts`
- Modify: `apps/docs/app/page.tsx` (if the rendering group's card references the three widget hues)

- [ ] **Step 1: Collapse the widget family to one hue**

The widget trio currently uses 3 hues (`react-widget: sky`, `astro-widget: coral`, `widget: stone`), but the rendering group is one family and should carry one hue — like `feature` uses one. In `apps/docs/app/navigation.ts`, change the three widget entries to share a single hue (keep `stone`, the unsaturated "no hue of its own" value, for the framework-free core `widget`; assign `sky` to both `react-widget` and `astro-widget` as the family hue). This frees `coral` and one of `sky`/`stone` for the two new packages.

Specifically, in the `packages` array:
- `@evanion/react-widget`: change `hue: 'sky'` → `hue: 'sky'` (unchanged — the family hue).
- `@evanion/astro-widget`: change `hue: 'coral'` → `hue: 'sky'`.
- `@evanion/widget`: keep `hue: 'stone'`.

Check `apps/docs/app/page.tsx` and the landing `items.ts` — if any code reads these three entries' individual hues to paint cards, it must now treat the three as one family. The rendering group already renders as "one card both packages share" per `navigation.ts`'s `line`, so this is likely already consistent.

- [ ] **Step 2: Add both packages with the two freed hues**

Append to the `packages` array:

```ts
  {
    name: '@evanion/authorization',
    root: 'libs/authorization',
    slug: 'authorization',
    title: 'Authorization',
    group: 'standalone',
    framework: 'universal',
    hue: 'coral',
    documented: false,
    workshop: false,
  },
  {
    name: '@evanion/react-authorization',
    root: 'libs/react-authorization',
    slug: 'react-authorization',
    title: 'React Authorization',
    group: 'standalone',
    framework: 'React',
    hue: 'periwinkle',
    documented: false,
    workshop: false,
  },
```

Wait — `periwinkle` is used by `urn` and `coral` was just freed. Use `coral` for authorization (freed from astro-widget) and reuse nothing else. After collapsing widget→1 hue, freed hues are `coral` (astro-widget) plus the difference between sky and stone. Assign `authorization` → `coral`, `react-authorization` → a hue that is now free. Verify the exact freed hues against the post-collapse set and pick two unique ones; adjust the two `hue:` values above to whatever is actually free.

- [ ] **Step 3: Run the repo-checks**

Run: `npx nx run repo-checks:test`
Expected: PASS after the navigation hue changes.

- [ ] **Step 4: Commit**

```bash
git add apps/docs/app/navigation.ts apps/docs/app/page.tsx
git commit -m "docs(authorization): register packages in docs navigation, unify widget hue"
```

---

### Task 15: Full verification

- [ ] **Step 1: Run the whole workspace test suite**

Run: `npx nx run-many -t test`
Expected: all PASS.

- [ ] **Step 2: Build both new packages**

Run: `npx nx run authorization:build && npx nx run react-authorization:build`
Expected: PASS.

- [ ] **Step 3: Run the packaging verification**

Run: `npm run verify:packaging`
Expected: PASS.

- [ ] **Step 4: Commit any remaining generated files**

```bash
git add -A
git commit -m "chore(authorization): finalize authorization packages"
```

---

## Self-review notes

- **Spec coverage:** Every section maps to a task — types (T1), errors (T2), conditions (T3), graph (T4), validation (T5), precedence/deny/unevaluable (T6), field decisions (T7), createPolicy+authorize+capabilities (T8), parseMatrix (T9), typed authoring (T10), exports+README (T11), React binding (T12-13), docs navigation (T14), verification (T15).
- **Known v1 simplifications (deliberate, flagged):**
  - Deep type-path inference ("readable errors" for bad field paths) is deferred; `policy`/`permit` accept `type` params that are erased, matching the canonical string-key model. `.test-d.ts` asserts basic shape, not path-inference errors.
  - The `object()` bound-handler and `canFields` whole-object `proposed` are covered in the core `Access` surface; the React hooks use the same signatures.
  - Baize categorical hue scale must be extended to add two packages to the docs nav (Task 14) — a design-system change to confirm with the user.
- **Type consistency:** All signatures use `(subject, key, action, object?, now?)` consistently across `can`, `canMany`, `canFields`, `authorize`, and the hooks, per the spec's single canonical order.
