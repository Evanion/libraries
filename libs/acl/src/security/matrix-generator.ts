import { Gen } from './generator.js';
import type { Subject } from '../hydrate-policy.js';
import type { Matrix } from '../types.js';

/**
 * Generators for matrices and evaluation contexts of any shape, valid and not.
 * The totality and explain property tests draw from them, each case a seed.
 */

export const KEYS = [
  'comment',
  'post',
  'media',
  '',
  'constructor',
  '__proto__',
  'orders:invoice',
  'orders.invoice',
];
export const ACTIONS = ['read', 'update', 'delete', '', 'toString', 'read.all'];
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
export function junk(gen: Gen, depth = 0): unknown {
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
  if (gen.bool(0.4)) {
    node['visibility'] = gen.pick([
      'public',
      'internal',
      'PUBLIC',
      '',
      null,
      42,
      {},
    ]);
  }
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
export function matrix(gen: Gen): Matrix {
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
  if (gen.bool(0.4)) {
    node['maxStale'] = gen.pick([
      0,
      60_000,
      -1,
      Number.NaN,
      Infinity,
      '60000',
      null,
      {},
    ]);
  }
  if (gen.bool(0.35)) node['schema'] = schema(gen);
  return node as unknown as Matrix;
}

export function context(gen: Gen): {
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

/**
 * Path segments a field rule may name: nested keys, an array, a canonical
 * index, an escaped dotted key, and names the engine refuses as fields.
 */
const RULE_SEGMENTS = ['a', 'b', 'c', 'items', '0', 'x\\.y', 'constructor'];

function rulePath(gen: Gen): string {
  return Array.from({ length: 1 + gen.int(3) }, () =>
    gen.pick(RULE_SEGMENTS),
  ).join('.');
}

/**
 * Field rules over nested, array, indexed and dotted paths, valid and not: a
 * list of `*`, paths and exclusions, and `targets`/`transitions` configs keyed
 * by path.
 */
export function pathFieldRules(gen: Gen): Record<string, unknown> {
  const node: Record<string, unknown> = {};
  if (gen.bool(0.9)) {
    node['fields'] = gen.list(4, () =>
      gen.bool(0.25) ? '*' : `${gen.bool(0.5) ? '!' : ''}${rulePath(gen)}`,
    );
  }
  for (let i = gen.int(3); i > 0; i--) {
    node[rulePath(gen)] = gen.pick([
      { targets: [1, 'x'] },
      { transitions: { '1': [2], x: ['y'] } },
    ]);
  }
  return node;
}

/** Keys a row or a write may carry: nested, dotted, bracketed and hostile. */
const DATA_KEYS = [
  'a',
  'b',
  'c',
  'items',
  '0',
  'x.y',
  'a.b',
  'items.0.b',
  'a[0]',
  'constructor',
  'constructor.prototype.p',
  '*',
  '!a',
  '',
];

/**
 * A row or a write over the keys `pathFieldRules` names, nested up to three
 * levels: primitives, plain objects, arrays of plain objects, a `Date`, and an
 * own `__proto__` key as `JSON.parse` yields it.
 */
export function pathData(gen: Gen, depth = 0): Record<string, unknown> {
  const node: Record<string, unknown> = {};
  for (const key of DATA_KEYS) {
    if (!gen.bool(0.35)) continue;
    Object.defineProperty(node, key, {
      value: pathValue(gen, depth),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  if (gen.bool(0.05)) {
    Object.defineProperty(node, '__proto__', {
      value: { p: 1 },
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return node;
}

function pathValue(gen: Gen, depth: number): unknown {
  if (depth >= 2 || gen.bool(0.45)) {
    return gen.pick([1, 2, 'x', 'y', null, true, new Date(0)]);
  }
  return gen.bool(0.7)
    ? pathData(gen, depth + 1)
    : gen.list(2, () => pathData(gen, depth + 1));
}
