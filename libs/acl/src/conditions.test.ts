import { describe, expect, it } from 'vitest';

import { evaluateCondition } from './conditions.js';
import { applyDenyOverlay } from './deny-overlay.js';
import { InvalidConditionError } from './errors.js';
import { validateMatrix } from './validate.js';
import type { Condition, EvaluationContext, Rule } from './types.js';

const ctx: EvaluationContext = {
  subject: { id: 's1', roles: ['editor'] },
  object: { authorId: 's1', status: 'draft' },
  now: new Date('2026-01-01T00:00:00Z'),
};

/** The condition's state alone, for the cases that assert nothing about paths. */
function state(condition: Condition, context: EvaluationContext): string {
  return evaluateCondition(condition, context).state;
}

describe('evaluateCondition', () => {
  it('eq compares subject and object across scopes', () => {
    const c: Condition = {
      field: 'object.authorId',
      op: 'eq',
      path: 'subject.id',
    };

    expect(state(c, ctx)).toBe('holds');
    expect(state(c, { ...ctx, object: { authorId: 'OTHER' } })).toBe('fails');
  });

  it('eq supports a literal value', () => {
    expect(
      state({ field: 'object.status', op: 'eq', value: 'published' }, ctx),
    ).toBe('fails');
    expect(
      state({ field: 'object.status', op: 'eq', value: 'draft' }, ctx),
    ).toBe('holds');
  });

  it('contains checks an array field', () => {
    expect(
      state({ field: 'subject.roles', op: 'contains', value: 'editor' }, ctx),
    ).toBe('holds');
    expect(
      state({ field: 'subject.roles', op: 'contains', value: 'admin' }, ctx),
    ).toBe('fails');
  });

  it('in and not-in check membership', () => {
    expect(
      state(
        { field: 'object.status', op: 'in', value: ['published', 'draft'] },
        ctx,
      ),
    ).toBe('holds');
    expect(
      state({ field: 'object.status', op: 'not-in', value: ['archived'] }, ctx),
    ).toBe('holds');
  });

  it('before and after compare now against an instant', () => {
    expect(
      state({ field: 'now', op: 'after', value: '2020-01-01T00:00:00Z' }, ctx),
    ).toBe('holds');
    expect(
      state({ field: 'now', op: 'before', value: '2020-01-01T00:00:00Z' }, ctx),
    ).toBe('fails');
  });

  it('an absent subject field is a definite miss, negative operators included', () => {
    const absent: EvaluationContext = { subject: { id: 'x' } };

    expect(
      state({ field: 'subject.missing', op: 'eq', value: 1 }, absent),
    ).toBe('fails');
    expect(
      state({ field: 'subject.missing', op: 'ne', value: 1 }, absent),
    ).toBe('fails');
  });

  it('an absent subject comparand is a definite miss, not unevaluable', () => {
    expect(
      state(
        { field: 'object.authorId', op: 'eq', path: 'subject.missing' },
        ctx,
      ),
    ).toBe('fails');
  });

  it('an absent object field is unevaluable, naming the path it could not read', () => {
    const projection: EvaluationContext = {
      subject: { id: 's1' },
      object: { authorId: 's1' },
    };

    expect(
      evaluateCondition(
        { field: 'object.status', op: 'eq', value: 'draft' },
        projection,
      ),
    ).toEqual({ state: 'unevaluable', missing: ['object.status'] });
  });

  it('an absent object field is unevaluable for negative operators too', () => {
    const projection: EvaluationContext = {
      subject: { id: 's1' },
      object: { authorId: 's1' },
    };

    expect(
      state({ field: 'object.status', op: 'ne', value: 'draft' }, projection),
    ).toBe('unevaluable');
    expect(
      state(
        { field: 'object.status', op: 'not-in', value: ['archived'] },
        projection,
      ),
    ).toBe('unevaluable');
  });

  it('an absent object comparand is unevaluable', () => {
    const projection: EvaluationContext = {
      subject: { id: 's1' },
      object: { authorId: 's1' },
    };

    expect(
      evaluateCondition(
        { field: 'subject.id', op: 'eq', path: 'object.ownerId' },
        projection,
      ),
    ).toEqual({ state: 'unevaluable', missing: ['object.ownerId'] });
  });

  it('never resolves prototype-chain fields', () => {
    const hostile: EvaluationContext = {
      subject: { id: 's1' },
      object: Object.create({ status: 'x' }) as Record<string, unknown>,
    };

    expect(
      state({ field: 'object.status', op: 'eq', value: 'x' }, hostile),
    ).toBe('unevaluable');
    expect(state({ field: 'object.toString', op: 'eq', value: 1 }, ctx)).toBe(
      'unevaluable',
    );
  });

  it('reads every instant form of now, and all three agree', () => {
    const iso = '2026-01-01T00:00:00Z';
    const epoch = Date.parse(iso);
    const window: Condition = {
      field: 'now',
      op: 'after',
      value: '2020-01-01T00:00:00Z',
    };
    const forms = [iso, epoch, new Date(epoch)];

    for (const now of forms) {
      expect(state(window, { ...ctx, now })).toBe('holds');
      expect(
        state(
          { field: 'now', op: 'before', value: '2020-01-01T00:00:00Z' },
          {
            ...ctx,
            now,
          },
        ),
      ).toBe('fails');
    }
  });

  it('a now that does not parse leaves the clock unusable rather than throwing', () => {
    const window: Condition = {
      field: 'now',
      op: 'after',
      value: '2020-01-01T00:00:00Z',
    };
    const broken = [
      'not a date',
      '',
      '01/02/2020 sometime',
      Number.NaN,
      // A number reaches the comparison without being parsed, so an infinite
      // one would satisfy every window in one direction and none in the other.
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      new Date('not a date'),
      null,
    ];

    for (const now of broken) {
      const context = { ...ctx, now } as EvaluationContext;
      expect(() => state(window, context)).not.toThrow();
      expect(state(window, context)).toBe('unusable-clock');
      expect(state({ ...window, op: 'before' }, context)).toBe(
        'unusable-clock',
      );
    }
  });

  it('a boundary that does not parse is refused before anything evaluates', () => {
    // `evaluateResolved` does not check the boundary. These two are why it
    // does not have to: every rule array that reaches the engine came through
    // one of them. An infinite boundary is on the list because a number is the
    // one instant that reaches a comparison without being parsed, and
    // `Infinity > boundary` holds for every boundary there is.
    const boundaries = [
      'not a date',
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NaN,
    ];

    for (const value of boundaries) {
      const rules: Rule[] = [{ when: [{ field: 'now', op: 'after', value }] }];
      expect(() =>
        validateMatrix({
          permissions: [{ key: 'c.read', object: 'c', action: 'read', rules }],
        }),
      ).toThrow(InvalidConditionError);
      expect(() =>
        applyDenyOverlay(
          {
            permissions: [
              {
                key: 'c.read',
                object: 'c',
                action: 'read',
                rules: [{ when: [] }],
              },
            ],
            schema: { objects: { c: { fields: {} } } },
          },
          { 'c.read': rules },
          { vetoable: ['c.read'] },
        ),
      ).toThrow(InvalidConditionError);
    }
  });

  it('an absent now reads the wall clock', () => {
    const clockless: EvaluationContext = { subject: ctx.subject };

    expect(
      state(
        { field: 'now', op: 'after', value: '2020-01-01T00:00:00Z' },
        clockless,
      ),
    ).toBe('holds');
    expect(
      state(
        { field: 'now', op: 'before', value: '2020-01-01T00:00:00Z' },
        clockless,
      ),
    ).toBe('fails');
  });

  it('a context round-tripped through JSON still decides its time window', () => {
    const hydrated = JSON.parse(JSON.stringify(ctx)) as EvaluationContext;

    expect(typeof hydrated.now).toBe('string');
    expect(
      state(
        { field: 'now', op: 'after', value: '2020-01-01T00:00:00Z' },
        hydrated,
      ),
    ).toBe('holds');
  });

  it('an absent object instance makes object-dependent conditions unevaluable', () => {
    const noObj: EvaluationContext = { subject: { id: 's1' } };

    expect(
      evaluateCondition(
        { field: 'object.authorId', op: 'eq', path: 'subject.id' },
        noObj,
      ),
    ).toEqual({ state: 'unevaluable', missing: ['object.authorId'] });
  });
});
