import { describe, expect, it } from 'vitest';

import { AclConfigError, ActionNotAllowedError } from './errors.js';
import { pickAllowedFields } from './fields.js';
import { parseMatrix } from './parse-matrix.js';
import type { Access, Subject } from './create-policy.js';
import type { Decision, FieldDecision, Matrix } from './types.js';

/**
 * The standing guarantee, as a property: for any matrix and any context,
 * `parseMatrix` either rejects the matrix with an `AclConfigError` or returns an
 * access object whose every entry point answers with a decision. Nothing else.
 *
 * The matrices are generated to be wrong: every position holds a value of the
 * wrong type some of the time, plus nulls, prototype keys, deep nesting and
 * cycles. A seeded generator, so a counterexample is a seed rather than a rerun.
 */

/** mulberry32: a small seeded PRNG, so every case here is reproducible. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Gen {
  constructor(private readonly next: () => number) {}

  int(bound: number): number {
    return Math.floor(this.next() * bound);
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  pick<T>(values: readonly T[]): T {
    return values[this.int(values.length)] as T;
  }

  list<T>(max: number, make: (index: number) => T): T[] {
    return Array.from({ length: this.int(max + 1) }, (_, i) => make(i));
  }
}

const KEYS = [
  'comment',
  'post',
  'media',
  '',
  'constructor',
  '__proto__',
  'orders:invoice',
  'orders.invoice',
];
const ACTIONS = ['read', 'update', 'delete', '', 'toString', 'read.all'];
const OPS = [
  'eq',
  'ne',
  'in',
  'not-in',
  'contains',
  'before',
  'after',
  'EQ',
  '',
  null,
  42,
];
const FIELDS = [
  'subject.id',
  'subject.roles',
  'object.authorId',
  'object.status',
  'subject.profile.banned',
  'subject.',
  'subject',
  'now',
  'bogus.scope',
  '__proto__',
  '',
];

/** A value of any shape, including ones no serializer produces. */
function junk(gen: Gen, depth = 0): unknown {
  const leaves: unknown[] = [
    null,
    undefined,
    0,
    -1,
    Number.NaN,
    Infinity,
    '',
    'admin',
    'not a date',
    true,
    false,
    new Date(0),
    new Date('nope'),
  ];
  if (depth > 2 || gen.bool(0.6)) return gen.pick(leaves);
  if (gen.bool()) return gen.list(3, () => junk(gen, depth + 1));
  const node: Record<string, unknown> = {};
  for (const key of ['a', '__proto__', 'constructor', 'value']) {
    if (gen.bool(0.4)) node[key] = junk(gen, depth + 1);
  }
  return node;
}

function condition(gen: Gen): unknown {
  if (gen.bool(0.12)) return gen.pick([null, undefined, 'subject.id', 7, []]);
  const node: Record<string, unknown> = {};
  if (gen.bool(0.9)) node['field'] = gen.pick(FIELDS);
  if (gen.bool(0.9)) node['op'] = gen.pick(OPS);
  if (gen.bool(0.7)) node['value'] = junk(gen);
  if (gen.bool(0.25)) node['path'] = gen.pick([...FIELDS, 42, null]);
  return node;
}

function rule(gen: Gen): unknown {
  if (gen.bool(0.12)) return gen.pick([null, undefined, 'always', 3, []]);
  const node: Record<string, unknown> = {};
  if (gen.bool(0.8)) node['id'] = gen.pick(['r', '', 42, null, undefined]);
  if (gen.bool(0.85)) {
    node['when'] = gen.bool(0.85)
      ? gen.list(3, () => condition(gen))
      : gen.pick([null, {}, 'xx', 42]);
  }
  return node;
}

function fieldRules(gen: Gen): unknown {
  if (gen.bool(0.3)) return gen.pick([null, 'body', 42, []]);
  const node: Record<string, unknown> = {};
  if (gen.bool(0.7)) {
    node['fields'] = gen.bool(0.8)
      ? gen.list(3, () => gen.pick(['*', '!status', 'body', '', 42, null]))
      : gen.pick(['body', 42, {}]);
  }
  if (gen.bool(0.5)) {
    node['status'] = gen.pick([
      { targets: ['published'] },
      { targets: 'published' },
      { transitions: { draft: ['published'] } },
      { transitions: { draft: 'published' } },
      { targets: [], transitions: {} },
      null,
      42,
    ]);
  }
  return node;
}

function permission(gen: Gen, keys: readonly string[]): unknown {
  if (gen.bool(0.06)) return gen.pick([null, undefined, 'comment.read', 7, []]);
  const object = gen.pick(KEYS);
  const action = gen.pick(ACTIONS);
  const node: Record<string, unknown> = {
    // Two thirds of the time the key agrees with object/action, so the
    // generator reaches the evaluating half of the property at all.
    key: gen.bool(0.66) ? `${object}.${action}` : gen.pick([...keys, '', 42]),
    object,
    action,
  };
  if (gen.bool(0.8)) node['rules'] = gen.list(3, () => rule(gen));
  if (gen.bool(0.4)) node['denyRules'] = gen.list(2, () => rule(gen));
  if (gen.bool(0.35)) {
    node['dependsOn'] = gen.bool(0.8)
      ? gen.list(2, () => gen.pick([...keys, 'nope.read', '', 42, null]))
      : gen.pick(['comment.read', 42, {}]);
  }
  if (gen.bool(0.35)) node['fields'] = fieldRules(gen);
  return node;
}

/** A schema slot of any shape, valid and not, over the kinds KEYS names. */
function schema(gen: Gen): unknown {
  return gen.pick([
    null,
    42,
    'schema',
    [],
    {},
    { subject: null },
    { subject: 'string' },
    { subject: { fields: { id: 'string', roles: 'string[]' } } },
    { objects: 42 },
    { objects: { comment: null } },
    { objects: { comment: { fields: 'string' } } },
    { objects: { comment: { fields: { authorId: 'nope' } } } },
    {
      objects: {
        comment: { fields: { authorId: 'string', status: 'string' } },
      },
    },
    {
      subject: { fields: { id: 'string', roles: 'string[]' } },
      objects: {
        comment: { fields: { authorId: 'string', status: 'string' } },
        post: {
          fields: { authorId: 'string' },
          relations: { comment: 'comment' },
        },
      },
    },
  ]);
}

/** An envelope of any shape: a bare array, a missing or non-array `permissions`. */
function matrix(gen: Gen): Matrix {
  const keys = KEYS.flatMap((k) => ACTIONS.map((a) => `${k}.${a}`));
  const permissions = gen.list(4, () => permission(gen, keys));
  if (gen.bool(0.1)) {
    return gen.pick([
      null,
      undefined,
      permissions,
      'matrix',
      42,
    ]) as unknown as Matrix;
  }
  const node: Record<string, unknown> = {};
  if (gen.bool(0.92)) {
    node['permissions'] = gen.bool(0.92)
      ? permissions
      : gen.pick([null, {}, 'permissions', 42]);
  }
  if (gen.bool(0.4)) {
    node['version'] = gen.pick([1, 'v1', 'orders@7+veto@41', null, {}, []]);
  }
  if (gen.bool(0.35)) node['schema'] = schema(gen);
  return node as unknown as Matrix;
}

function context(gen: Gen): {
  subject: Subject;
  object: Record<string, unknown>;
  now: unknown;
} {
  const subject = junk(gen) as Subject;
  const object = junk(gen) as Record<string, unknown>;
  return {
    subject,
    object,
    now: gen.pick([undefined, 0, Date.now(), 'nope', new Date(), null, {}]),
  };
}

function isNode(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDecision(value: unknown): value is Decision {
  if (typeof value !== 'object' || value === null) return false;
  const decision = value as Decision;
  return (
    typeof decision.key === 'string' &&
    typeof decision.allowed === 'boolean' &&
    typeof decision.reason === 'string'
  );
}

function isFieldDecision(value: unknown): value is FieldDecision {
  if (typeof value !== 'object' || value === null) return false;
  const decision = value as FieldDecision;
  return (
    typeof decision.allowed === 'boolean' &&
    isDecision(decision.action) &&
    typeof decision.fields === 'object' &&
    typeof decision.reasons === 'object'
  );
}

/** Every entry point, against one generated context. Returns what each answered. */
function exercise(access: Access, gen: Gen): void {
  const { subject, object, now } = context(gen);
  const key = gen.pick(KEYS);
  const action = gen.pick(ACTIONS);
  const clock = now as never;

  expect(isDecision(access.can(subject, key, action, object, clock))).toBe(
    true,
  );
  for (const decision of access.canMany(
    subject,
    key,
    action,
    [object, {}],
    clock,
  )) {
    expect(isDecision(decision)).toBe(true);
  }
  const proposed = junk(gen) as Record<string, unknown>;
  const fieldDecision = access.canFields(
    subject,
    key,
    action,
    object,
    gen.pick(['read', 'write'] as const),
    gen.bool() ? proposed : undefined,
    clock,
  );
  expect(isFieldDecision(fieldDecision)).toBe(true);

  // The write path narrows a proposal against that decision. Its one throw is
  // ActionNotAllowedError, which reports the decision rather than a shape.
  try {
    const writable = pickAllowedFields(
      fieldDecision,
      isNode(proposed) ? proposed : {},
    );
    expect(typeof writable).toBe('object');
    for (const field of Object.keys(writable)) {
      expect(fieldDecision.fields[field]).toBe('allowed');
    }
  } catch (error) {
    expect(error).toBeInstanceOf(ActionNotAllowedError);
  }

  for (const decision of Object.values(access.capabilities(subject, clock))) {
    expect(isDecision(decision)).toBe(true);
  }

  const bound = access.authorize(subject, { now: clock });
  expect(isDecision(bound.can(key, action, object))).toBe(true);
  expect(
    isDecision(
      bound.canMany(key, action, [object])[0] ?? bound.can(key, action),
    ),
  ).toBe(true);
  expect(Object.keys(bound.capabilities()).length).toBeGreaterThanOrEqual(0);
}

describe('totality', () => {
  it('construction rejects with an AclConfigError, or evaluation decides', () => {
    let built = 0;
    let rejected = 0;

    for (let seed = 1; seed <= 2000; seed++) {
      const gen = new Gen(rng(seed));
      const candidate = matrix(gen);

      let access: Access;
      try {
        access = parseMatrix(candidate);
      } catch (error) {
        // The only acceptable refusal: a typed construction error.
        expect(error, `seed ${seed}: ${String(error)}`).toBeInstanceOf(
          AclConfigError,
        );
        rejected++;
        continue;
      }

      built++;
      for (let round = 0; round < 3; round++) {
        try {
          exercise(access, gen);
        } catch (error) {
          throw new Error(`seed ${seed} round ${round}: ${String(error)}`, {
            cause: error,
          });
        }
      }
    }

    // Both halves of the property are reached, so neither is vacuous.
    expect(built).toBeGreaterThan(50);
    expect(rejected).toBeGreaterThan(50);
  });

  it('an accepted matrix never decides on a key it was not written for', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const gen = new Gen(rng(seed));
      let access: Access;
      try {
        access = parseMatrix(matrix(gen));
      } catch {
        continue;
      }
      for (const permission of access.matrix.permissions) {
        expect(permission.key).toBe(
          `${permission.object}.${permission.action}`,
        );
      }
    }
  });

  it('a matrix round-tripped through JSON decides identically', () => {
    let crossed = 0;

    for (let seed = 1; seed <= 1000; seed++) {
      const gen = new Gen(rng(seed));
      let access: Access;
      try {
        access = parseMatrix(matrix(gen));
      } catch {
        continue;
      }

      const payload = JSON.parse(JSON.stringify(access.matrix)) as Matrix;
      // The document is what crosses: version and schema included, nothing
      // assembled around it.
      expect(payload).toEqual(access.matrix);
      const hydrated = parseMatrix(payload);
      expect(hydrated.version).toEqual(access.version);
      expect(hydrated.schema).toEqual(access.schema);
      crossed++;

      for (let round = 0; round < 3; round++) {
        const { subject, object, now } = context(gen);
        const key = gen.pick(KEYS);
        const action = gen.pick(ACTIONS);
        const clock = now as never;
        expect(hydrated.can(subject, key, action, object, clock)).toEqual(
          access.can(subject, key, action, object, clock),
        );
        expect(hydrated.capabilities(subject, clock)).toEqual(
          access.capabilities(subject, clock),
        );
      }
    }

    expect(crossed).toBeGreaterThan(50);
  });
});
