import { describe, expect, it } from 'vitest';

import { applyDenyOverlay } from './deny-overlay.js';
import {
  FieldTypeMismatchError,
  InvalidRuleError,
  MissingVetoSchemaError,
  UnknownFieldError,
  UnknownPermissionError,
  UnvetoablePermissionError,
} from './errors.js';
import { hydratePolicy } from './hydrate-policy.js';
import { Gen, rng } from './security/generator.js';
import type { DenyOverlay } from './deny-overlay.js';
import type {
  Condition,
  Decision,
  Matrix,
  MatrixSchema,
  Permission,
  Rule,
} from './types.js';

/**
 * The shapes every matrix in this file declares. The overlay's schema
 * obligation is scoped to the object kinds behind `vetoable`, so a target that
 * opens a key has to carry the kind's entry for the overlay to apply at all.
 */
const SCHEMA: MatrixSchema = {
  subject: {
    fields: { id: 'string', roles: 'string[]', tier: 'string' },
  },
  objects: {
    comment: {
      fields: { authorId: 'string', status: 'string', score: 'number' },
    },
    post: { fields: { authorId: 'string', status: 'string', score: 'number' } },
  },
};

function base(): Matrix {
  return {
    version: 'orders@7',
    schema: SCHEMA,
    permissions: [
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        rules: [
          {
            when: [{ field: 'subject.id', op: 'eq', path: 'object.authorId' }],
          },
        ],
      },
      {
        key: 'post.read',
        object: 'post',
        action: 'read',
        rules: [{ when: [] }],
      },
    ],
  };
}

const VETOABLE = ['comment.update', 'post.read'];

/** A deny every context this file builds definitely matches. */
const HOLD: Rule = {
  id: 'compliance-hold',
  when: [{ field: 'subject.tier', op: 'eq', value: 'sanctioned' }],
};

describe('applyDenyOverlay', () => {
  describe('applyDenyOverlay refuses at apply time, naming the key', () => {
    it('refuses a key the target does not define', () => {
      expect(() =>
        applyDenyOverlay(
          base(),
          { 'invoice.void': [HOLD] },
          {
            vetoable: VETOABLE,
          },
        ),
      ).toThrow(UnknownPermissionError);

      expect(() =>
        applyDenyOverlay(
          base(),
          { 'invoice.void': [HOLD] },
          {
            vetoable: VETOABLE,
          },
        ),
      ).toThrow(/"invoice\.void"/);
    });

    it('refuses a vetoable key the target does not define', () => {
      expect(() =>
        applyDenyOverlay(base(), {}, { vetoable: ['invoice.void'] }),
      ).toThrow(/"invoice\.void"/);
    });

    it('refuses a key the target does not open for veto', () => {
      expect(() =>
        applyDenyOverlay(
          base(),
          { 'post.read': [HOLD] },
          {
            vetoable: ['comment.update'],
          },
        ),
      ).toThrow(UnvetoablePermissionError);

      expect(() =>
        applyDenyOverlay(
          base(),
          { 'post.read': [HOLD] },
          {
            vetoable: ['comment.update'],
          },
        ),
      ).toThrow(/"post\.read" is not vetoable/);
    });

    it('refuses every key when the target opens nothing', () => {
      expect(() =>
        applyDenyOverlay(base(), { 'post.read': [HOLD] }, { vetoable: [] }),
      ).toThrow(UnvetoablePermissionError);
    });

    it('refuses a condition naming a field the target does not declare', () => {
      const overlay: DenyOverlay = {
        'comment.update': [
          { when: [{ field: 'object.riskBand', op: 'eq', value: 'high' }] },
        ],
      };

      expect(() =>
        applyDenyOverlay(base(), overlay, { vetoable: VETOABLE }),
      ).toThrow(UnknownFieldError);

      expect(() =>
        applyDenyOverlay(base(), overlay, { vetoable: VETOABLE }),
      ).toThrow(/"comment\.update".*overlay\[0\]\.when\[0\].*riskBand/s);
    });

    it('refuses a condition whose operator does not fit the declared type', () => {
      const overlay: DenyOverlay = {
        'comment.update': [
          { when: [{ field: 'object.score', op: 'eq', value: 'high' }] },
        ],
      };

      expect(() =>
        applyDenyOverlay(base(), overlay, { vetoable: VETOABLE }),
      ).toThrow(FieldTypeMismatchError);

      expect(() =>
        applyDenyOverlay(base(), overlay, { vetoable: VETOABLE }),
      ).toThrow(/"comment\.update"/);
    });

    it('checks a contribution against the kind the key names, not another', () => {
      // `post` and `comment` declare the same fields here, so a fault has to come
      // from the kind the key names for this to distinguish anything.
      const narrowed: Matrix = {
        ...base(),
        schema: {
          ...SCHEMA,
          objects: {
            comment: { fields: { authorId: 'string' } },
            post: { fields: { authorId: 'string', status: 'string' } },
          },
        },
      };

      expect(() =>
        applyDenyOverlay(
          narrowed,
          {
            'comment.update': [
              { when: [{ field: 'object.status', op: 'eq', value: 'locked' }] },
            ],
          },
          { vetoable: VETOABLE },
        ),
      ).toThrow(UnknownFieldError);

      expect(() =>
        applyDenyOverlay(
          narrowed,
          {
            'post.read': [
              { when: [{ field: 'object.status', op: 'eq', value: 'locked' }] },
            ],
          },
          { vetoable: VETOABLE },
        ),
      ).not.toThrow();
    });
  });

  describe('the schema obligation is scoped to the vetoable keys', () => {
    it('refuses a vetoable key whose object kind is not declared', () => {
      const matrix: Matrix = {
        ...base(),
        schema: { subject: SCHEMA.subject, objects: { post: { fields: {} } } },
      };

      expect(() =>
        applyDenyOverlay(matrix, {}, { vetoable: ['comment.update'] }),
      ).toThrow(MissingVetoSchemaError);

      expect(() =>
        applyDenyOverlay(matrix, {}, { vetoable: ['comment.update'] }),
      ).toThrow(/"comment\.update".*"comment"/s);
    });

    it('refuses a vetoable key when the target carries no schema at all', () => {
      const matrix: Matrix = { permissions: base().permissions };

      expect(() =>
        applyDenyOverlay(matrix, {}, { vetoable: ['post.read'] }),
      ).toThrow(MissingVetoSchemaError);
    });

    it('owes nothing for a kind no vetoable key names', () => {
      const matrix: Matrix = {
        ...base(),
        schema: {
          subject: SCHEMA.subject,
          objects: { comment: SCHEMA.objects?.['comment'] ?? {} },
        },
      };

      expect(() =>
        applyDenyOverlay(
          matrix,
          { 'comment.update': [HOLD] },
          {
            vetoable: ['comment.update'],
          },
        ),
      ).not.toThrow();
    });

    it('owes no schema when it opens nothing', () => {
      const matrix: Matrix = { permissions: base().permissions };
      expect(() =>
        applyDenyOverlay(matrix, {}, { vetoable: [] }),
      ).not.toThrow();
    });
  });

  describe('the structural gate runs over the contribution', () => {
    it('refuses a rule with no when', () => {
      expect(() =>
        applyDenyOverlay(
          base(),
          { 'post.read': [{ id: 'x' } as Rule] },
          {
            vetoable: VETOABLE,
          },
        ),
      ).toThrow(InvalidRuleError);
    });
  });

  describe('a valid overlay narrows', () => {
    const overlaid = () =>
      hydratePolicy(
        applyDenyOverlay(
          base(),
          { 'comment.update': [HOLD] },
          {
            vetoable: VETOABLE,
          },
        ),
      );

    const subject = { id: 'u1', roles: [], tier: 'sanctioned' };
    const object = { authorId: 'u1', status: 'open', score: 1 };

    it('a subject who could, now cannot', () => {
      const before = hydratePolicy(base()).can(
        subject,
        'comment',
        'update',
        object,
      );
      expect(before.allowed).toBe(true);

      const after = overlaid().can(subject, 'comment', 'update', object);
      expect(after).toEqual({
        key: 'comment.update',
        allowed: false,
        reason: 'denied',
        rule: 'compliance-hold',
      });
    });

    it('leaves a subject the overlay does not name alone', () => {
      const clear = { id: 'u1', roles: [], tier: 'ordinary' };
      expect(overlaid().can(clear, 'comment', 'update', object).allowed).toBe(
        true,
      );
    });

    it('leaves the permissions it does not name alone', () => {
      expect(overlaid().can(subject, 'post', 'read').allowed).toBe(true);
    });

    it('appends rather than replaces the target own deny rules', () => {
      const authored: Matrix = {
        ...base(),
        permissions: base().permissions.map((permission) =>
          permission.key === 'comment.update'
            ? {
                ...permission,
                denyRules: [
                  {
                    id: 'own',
                    when: [
                      { field: 'object.status', op: 'eq', value: 'locked' },
                    ],
                  },
                ],
              }
            : permission,
        ),
      };

      const result = applyDenyOverlay(
        authored,
        { 'comment.update': [HOLD] },
        {
          vetoable: VETOABLE,
        },
      );
      const updated = result.permissions.find(
        (p) => p.key === 'comment.update',
      );

      expect(updated?.denyRules?.map((rule) => rule.id)).toEqual([
        'own',
        'compliance-hold',
      ]);
    });

    it('does not touch the matrix it was handed', () => {
      const authored = base();
      const snapshot = JSON.stringify(authored);
      applyDenyOverlay(
        authored,
        { 'comment.update': [HOLD] },
        {
          vetoable: VETOABLE,
        },
      );
      expect(JSON.stringify(authored)).toBe(snapshot);
    });

    it('carries the version through unchanged', () => {
      const result = applyDenyOverlay(
        base(),
        { 'comment.update': [HOLD] },
        {
          vetoable: VETOABLE,
        },
      );
      expect(result.version).toBe('orders@7');
    });
  });

  describe('an overlay deny that cannot be evaluated refuses', () => {
    it('reports unevaluable rather than granting', () => {
      const overlay: DenyOverlay = {
        'post.read': [
          {
            id: 'risk',
            when: [{ field: 'object.status', op: 'eq', value: 'frozen' }],
          },
        ],
      };

      const access = hydratePolicy(
        applyDenyOverlay(base(), overlay, { vetoable: VETOABLE }),
      );

      // `post.read` allows unconditionally, so before the overlay this subject is
      // allowed with no object at all. The overlay's deny reads one the caller did
      // not pass.
      expect(
        hydratePolicy(base()).can({ id: 'u1' }, 'post', 'read').allowed,
      ).toBe(true);

      const decision = access.can({ id: 'u1' }, 'post', 'read');
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('unevaluable');
      expect(decision.rule).toBe('risk');
      expect(decision.missing).toEqual(['object.status']);
    });

    it('turns an object-independent permission into one that reads the object', () => {
      const access = hydratePolicy(
        applyDenyOverlay(
          base(),
          {
            'post.read': [
              { when: [{ field: 'object.score', op: 'eq', value: 3 }] },
            ],
          },
          { vetoable: VETOABLE },
        ),
      );

      expect(hydratePolicy(base()).readsObject('post', 'read')).toBe(false);
      expect(access.readsObject('post', 'read')).toBe(true);
    });
  });

  describe('the result is still a document', () => {
    it('round-trips through JSON unchanged', () => {
      const result = applyDenyOverlay(
        base(),
        { 'comment.update': [HOLD] },
        {
          vetoable: VETOABLE,
        },
      );

      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    });

    it('constructs, and the access behaves', () => {
      const result = applyDenyOverlay(
        base(),
        { 'comment.update': [HOLD] },
        {
          vetoable: VETOABLE,
        },
      );
      const access = hydratePolicy(
        JSON.parse(JSON.stringify(result)) as Matrix,
      );

      expect(access.version).toBe('orders@7');
      expect(access.schema).toEqual(SCHEMA);
      expect(
        Object.keys(
          access.capabilities({ id: 'u1', tier: 'sanctioned' }),
        ).sort(),
      ).toEqual(['comment.update', 'post.read']);
    });
  });

  describe('the authoring party can run it against a published subset', () => {
    it('needs neither the full matrix nor any private state', () => {
      // What a compliance team holds: the vetoable keys, their kinds' schema
      // entries, and nothing else. This is the check it runs in its own CI.
      const published: Matrix = {
        version: 'orders@7',
        schema: { objects: { comment: SCHEMA.objects?.['comment'] ?? {} } },
        permissions: [
          { key: 'comment.update', object: 'comment', action: 'update' },
        ],
      };

      expect(() =>
        applyDenyOverlay(
          published,
          {
            'comment.update': [
              { when: [{ field: 'object.riskBand', op: 'eq', value: 'high' }] },
            ],
          },
          { vetoable: ['comment.update'] },
        ),
      ).toThrow(UnknownFieldError);

      expect(() =>
        applyDenyOverlay(
          published,
          { 'comment.update': [HOLD] },
          {
            vetoable: ['comment.update'],
          },
        ),
      ).not.toThrow();
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Properties, over generated matrices, overlays and contexts.                 */
/* -------------------------------------------------------------------------- */

const OBJECTS = ['comment', 'post'] as const;
const ACTIONS = ['read', 'update', 'delete'] as const;

/** Conditions that fit `SCHEMA`, so every generated matrix constructs. */
function condition(gen: Gen): Condition {
  return gen.pick<Condition>([
    { field: 'subject.id', op: 'eq', path: 'object.authorId' },
    { field: 'object.status', op: 'eq', value: 'open' },
    { field: 'object.status', op: 'ne', value: 'locked' },
    { field: 'object.score', op: 'in', value: [1, 2] },
    { field: 'subject.roles', op: 'contains', value: 'admin' },
    { field: 'subject.tier', op: 'eq', value: 'gold' },
    { field: 'now', op: 'before', value: '2030-01-01T00:00:00.000Z' },
    { field: 'now', op: 'after', value: '2020-01-01T00:00:00.000Z' },
  ]);
}

function rule(gen: Gen, index: number): Rule {
  return { id: `r${index}`, when: gen.list(2, () => condition(gen)) };
}

function matrix(gen: Gen): { document: Matrix; vetoable: readonly string[] } {
  const permissions: Permission[] = [];
  const keys: string[] = [];

  for (const object of OBJECTS) {
    for (const action of ACTIONS) {
      if (gen.bool(0.25)) continue;
      const key = `${object}.${action}`;
      // The unconditional allow is drawn rather than always present: with it on
      // every permission the allow side always matches, and the deny side is the
      // only thing any decision turns on.
      const rules: Rule[] = gen.list(2, (i) => rule(gen, i));
      if (gen.bool(0.4)) rules.unshift({ id: 'always', when: [] });
      const permission: Permission = { key, object, action, rules };
      if (gen.bool(0.3)) {
        permission.denyRules = gen.list(2, (i) => rule(gen, 10 + i));
      }
      permissions.push(permission);
      keys.push(key);
    }
  }

  if (permissions.length === 0) {
    permissions.push({
      key: 'post.read',
      object: 'post',
      action: 'read',
      rules: [{ when: [] }],
    });
    keys.push('post.read');
  }

  return {
    document: { version: 'v1', schema: SCHEMA, permissions },
    vetoable: keys.filter(() => gen.bool(0.6)),
  };
}

function overlayFor(gen: Gen, vetoable: readonly string[]): DenyOverlay {
  const overlay: Record<string, readonly Rule[]> = {};
  for (const key of vetoable) {
    if (gen.bool(0.5)) continue;
    overlay[key] = gen.list(2, (i) => rule(gen, 20 + i));
  }
  return overlay;
}

interface Case {
  subject: Record<string, unknown>;
  object?: Record<string, unknown>;
  now?: string;
}

function evaluationCase(gen: Gen): Case {
  const subject: Record<string, unknown> = { id: gen.pick(['u1', 'u2']) };
  if (gen.bool(0.8))
    subject['roles'] = gen.list(2, () => gen.pick(['admin', 'ops']));
  if (gen.bool(0.8)) subject['tier'] = gen.pick(['gold', 'ordinary']);

  const item: Case = { subject };
  if (gen.bool(0.8)) {
    const object: Record<string, unknown> = {};
    if (gen.bool(0.75)) object['authorId'] = gen.pick(['u1', 'u2']);
    if (gen.bool(0.75)) object['status'] = gen.pick(['open', 'locked']);
    if (gen.bool(0.75)) object['score'] = gen.pick([1, 2, 3]);
    item.object = object;
  }
  if (gen.bool(0.9)) {
    item.now = gen.pick([
      '2026-01-01T00:00:00.000Z',
      '2019-01-01T00:00:00.000Z',
      '2031-01-01T00:00:00.000Z',
    ]);
  }
  return item;
}

function decisionsFor(document: Matrix, cases: readonly Case[]): Decision[] {
  const access = hydratePolicy(document);
  return cases.flatMap((item) =>
    document.permissions.map((permission) =>
      access.can(
        item.subject,
        permission.object,
        permission.action,
        item.object,
        item.now,
      ),
    ),
  );
}

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe('applyDenyOverlay', () => {
  describe('an overlay that matches nothing changes no decision', () => {
    it.each(SEEDS)('seed %i', (seed) => {
      const gen = new Gen(rng(seed));
      const { document, vetoable } = matrix(gen);
      const cases = Array.from({ length: 6 }, () => evaluationCase(gen));

      // Definite misses for every generated context: `subject.tier` is either
      // absent, which is a definite miss for a subject path, or one of two values
      // neither of which is this one.
      const inert: DenyOverlay = Object.fromEntries(
        vetoable.map((key) => [
          key,
          [
            {
              id: 'inert',
              when: [{ field: 'subject.tier', op: 'eq', value: 'nobody' }],
            },
          ],
        ]),
      );

      const overlaid = applyDenyOverlay(document, inert, { vetoable });

      expect(decisionsFor(overlaid, cases)).toEqual(
        decisionsFor(document, cases),
      );
    });
  });

  describe('an overlay only ever subtracts', () => {
    it.each(SEEDS)('seed %i', (seed) => {
      const gen = new Gen(rng(seed));
      const { document, vetoable } = matrix(gen);
      const overlay = overlayFor(gen, vetoable);
      const cases = Array.from({ length: 6 }, () => evaluationCase(gen));

      const overlaid = applyDenyOverlay(document, overlay, { vetoable });

      const authored = decisionsFor(document, cases);
      const after = decisionsFor(overlaid, cases);

      expect(after).toHaveLength(authored.length);
      for (const [index, before] of authored.entries()) {
        const now = after[index] as Decision;
        expect(now.key).toBe(before.key);
        // The whole property: no decision moves from refused to allowed.
        expect(before.allowed === false && now.allowed === true).toBe(false);
      }
    });
  });

  describe('the generated cases reach the behaviour they claim to cover', () => {
    it('narrows real decisions, so the monotonicity property is not vacuous', () => {
      let allowedBefore = 0;
      let narrowed = 0;
      let overlaidKeys = 0;

      for (const seed of SEEDS) {
        const gen = new Gen(rng(seed));
        const { document, vetoable } = matrix(gen);
        const overlay = overlayFor(gen, vetoable);
        const cases = Array.from({ length: 6 }, () => evaluationCase(gen));

        overlaidKeys += Object.keys(overlay).length;

        const authored = decisionsFor(document, cases);
        const after = decisionsFor(
          applyDenyOverlay(document, overlay, { vetoable }),
          cases,
        );

        for (const [index, before] of authored.entries()) {
          if (!before.allowed) continue;
          allowedBefore += 1;
          if (!(after[index] as Decision).allowed) narrowed += 1;
        }
      }

      expect(overlaidKeys).toBeGreaterThan(100);
      expect(allowedBefore).toBeGreaterThan(500);
      expect(narrowed).toBeGreaterThan(100);
    });

    it('opens real extension points, so the inert-overlay property is not vacuous', () => {
      let opened = 0;
      for (const seed of SEEDS) {
        opened += matrix(new Gen(rng(seed))).vetoable.length;
      }
      expect(opened).toBeGreaterThan(300);
    });
  });

  describe('an overlaid matrix is still a document', () => {
    it.each(SEEDS.slice(0, 50))(
      'seed %i round-trips and constructs',
      (seed) => {
        const gen = new Gen(rng(seed));
        const { document, vetoable } = matrix(gen);
        const overlaid = applyDenyOverlay(document, overlayFor(gen, vetoable), {
          vetoable,
        });

        const cloned = JSON.parse(JSON.stringify(overlaid)) as Matrix;
        expect(cloned).toEqual(overlaid);
        expect(() => hydratePolicy(cloned)).not.toThrow();
      },
    );
  });
});
