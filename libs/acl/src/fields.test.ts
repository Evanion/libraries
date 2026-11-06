import { describe, expect, it, vi } from 'vitest';

import { ActionNotAllowedError } from './errors.js';
import { decideFields, pickAllowedFields } from './fields.js';
import type {
  Decision,
  EvaluationContext,
  FieldDecision,
  FieldReason,
  FieldRules,
  FieldState,
  Permission,
} from './types.js';

const ctx: EvaluationContext = {
  subject: { id: 's1', roles: ['editor'] },
  object: { authorId: 's1', status: 'draft' },
  now: new Date('2026-01-01T00:00:00Z'),
};

function perm(key: string, fields?: FieldRules): Permission {
  const [object, action] = key.split('.');
  return { key, object: object ?? '', action: action ?? '', fields };
}

describe('decideFields', () => {
  it('emits every member of the FieldReason union', () => {
    // `Record<FieldReason, ...>` forces the literal to name the whole union, so
    // a member nothing emits fails here rather than becoming an unreachable arm
    // in a consumer's switch.
    const partial: EvaluationContext = { subject: { id: 's1' }, object: {} };
    const cases: Record<
      FieldReason,
      readonly [Permission, EvaluationContext, Record<string, unknown>?]
    > = {
      allow: [perm('comment.update', { fields: ['status'] }), ctx],
      'not-listed': [perm('comment.update', { fields: ['title'] }), ctx],
      'targets-failed': [
        perm('comment.update', { status: { targets: ['published'] } }),
        ctx,
        { status: 'draft' },
      ],
      'transition-failed': [
        perm('comment.update', {
          status: { transitions: { published: ['draft'] } },
        }),
        ctx,
        { status: 'published' },
      ],
      'missing-field': [
        perm('comment.update', {
          status: { transitions: { draft: ['published'] } },
        }),
        partial,
        { status: 'published' },
      ],
      'proposed-required': [
        perm('comment.update', { status: { targets: ['published'] } }),
        ctx,
      ],
      'not-traversable': [
        perm('comment.update', { fields: ['*', '!status.sub'] }),
        ctx,
      ],
    };

    for (const [reason, [p, context, proposed]] of Object.entries(cases)) {
      expect(
        decideFields(p, context, 'write', proposed).reasons['status'],
      ).toBe(reason);
    }
  });

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
    expect(d.fields['authorId']).toBe('allowed');
  });

  it('targets allows a proposed value from the allow-list', () => {
    const p = perm('comment.update', { status: { targets: ['published'] } });

    expect(
      decideFields(p, ctx, 'write', { status: 'published' }).fields['status'],
    ).toBe('allowed');
    expect(
      decideFields(p, ctx, 'write', { status: 'draft' }).fields['status'],
    ).toBe('denied');
  });

  it('targets without a proposed value is unevaluable', () => {
    const p = perm('comment.update', { status: { targets: ['published'] } });

    expect(decideFields(p, ctx, 'write').fields['status']).toBe('unevaluable');
  });

  it('transitions checks the current->proposed edge', () => {
    const p = perm('comment.update', {
      status: { transitions: { draft: ['published'], published: [] } },
    });

    expect(
      decideFields(p, ctx, 'write', { status: 'published' }).fields['status'],
    ).toBe('allowed');
    expect(
      decideFields(p, ctx, 'write', { status: 'draft' }).fields['status'],
    ).toBe('denied');
  });

  it('transitions without the current value is unevaluable', () => {
    const p = perm('comment.update', {
      status: { transitions: { draft: ['published'] } },
    });
    const partial: EvaluationContext = { subject: { id: 's1' }, object: {} };

    expect(
      decideFields(p, partial, 'write', { status: 'published' }).fields[
        'status'
      ],
    ).toBe('unevaluable');
  });

  it('transitions with a current value and no proposed one asks for the proposed one', () => {
    const p = perm('comment.update', {
      status: { transitions: { draft: ['published'] } },
    });

    const d = decideFields(p, ctx, 'write');

    expect(d.fields['status']).toBe('unevaluable');
    expect(d.reasons['status']).toBe('proposed-required');
  });

  it('transitions with neither end asks for the object first', () => {
    const p = perm('comment.update', {
      status: { transitions: { draft: ['published'] } },
    });
    const partial: EvaluationContext = { subject: { id: 's1' }, object: {} };

    const d = decideFields(p, partial, 'write');

    expect(d.fields['status']).toBe('unevaluable');
    expect(d.reasons['status']).toBe('missing-field');
  });

  it('targets without a proposed value asks for the proposed one', () => {
    const p = perm('comment.update', { status: { targets: ['published'] } });

    expect(decideFields(p, ctx, 'write').reasons['status']).toBe(
      'proposed-required',
    );
  });

  it('read axis ignores targets/transitions (projection only)', () => {
    const p = perm('comment.read', { status: { targets: ['published'] } });

    const d = decideFields(p, ctx, 'read');

    expect(d.fields['status']).toBe('allowed');
  });

  it('top-level allowed is true only when every field is allowed', () => {
    const p = perm('comment.update', {
      fields: ['body', 'title'],
      status: { targets: ['published'] },
    });

    const d = decideFields(p, ctx, 'write', { status: 'draft' });

    expect(d.allowed).toBe(false);
  });

  it('an unevaluable field fails the top-level allowed', () => {
    const p = perm('comment.update', {
      fields: ['*'],
      status: { targets: ['published'] },
    });

    const d = decideFields(p, ctx, 'write');

    expect(d.fields).toEqual({
      authorId: 'allowed',
      status: 'unevaluable',
    });
    expect(d.allowed).toBe(false);
  });

  it('the decision maps carry real field names, never * or !name', () => {
    const p = perm('comment.update', { fields: ['*', '!status'] });

    const d = decideFields(p, ctx, 'write');

    expect(Object.keys(d.fields)).toEqual(['authorId', 'status']);
    expect(Object.keys(d.reasons)).toEqual(['authorId', 'status']);
  });

  it('an allow-list names its fields without leaking the tokens', () => {
    const p = perm('comment.update', { fields: ['body', 'title'] });

    const d = decideFields(p, { subject: { id: 's1' } }, 'write');

    expect(Object.keys(d.fields).sort()).toEqual(['body', 'title']);
  });

  it('a bang denies a proposed key the object does not carry', () => {
    const p = perm('user.update', { fields: ['*', '!role'] });
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1', name: 'Ann' },
    };

    const d = decideFields(p, self, 'write', { name: 'Eve', role: 'admin' });

    expect(d.fields['role']).toBe('denied');
    expect(d.reasons['role']).toBe('not-listed');
    expect(d.allowed).toBe(false);
  });

  it('an allow-list denies a proposed key the object does not carry', () => {
    const p = perm('user.update', { fields: ['name'] });
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1', name: 'Ann' },
    };

    const d = decideFields(p, self, 'write', { name: 'Eve', role: 'admin' });

    expect(d.fields['role']).toBe('denied');
    expect(d.reasons['role']).toBe('not-listed');
    expect(d.allowed).toBe(false);
  });

  it('a proposed key the list allows still decides allowed', () => {
    const p = perm('user.update', { fields: ['*', '!role'] });
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1' },
    };

    const d = decideFields(p, self, 'write', { name: 'Eve' });

    expect(d.fields['name']).toBe('allowed');
    expect(d.allowed).toBe(true);
  });

  it('a proposed key is allowed when no name list restricts the action', () => {
    const p = perm('user.update');
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1' },
    };

    const d = decideFields(p, self, 'write', { name: 'Eve' });

    expect(d.fields['name']).toBe('allowed');
    expect(d.allowed).toBe(true);
  });

  it('the read axis decides the object, not a proposed write', () => {
    const p = perm('user.read', { fields: ['*', '!role'] });
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1', name: 'Ann' },
    };

    const d = decideFields(p, self, 'read', { role: 'admin' });

    expect(Object.keys(d.fields).sort()).toEqual(['id', 'name']);
  });

  it('an object carrying a * or !name key never keys the decision maps', () => {
    const p = perm('comment.update', { fields: ['*', '!status'] });
    const odd: EvaluationContext = {
      subject: { id: 's1' },
      object: { '*': 1, '!status': 2, body: 'hi' },
    };

    const d = decideFields(p, odd, 'write', { '*': 3, '!status': 4 });

    expect(Object.keys(d.fields)).toEqual(['body']);
    expect(Object.keys(d.reasons)).toEqual(['body']);
  });

  it.each(['constructor', 'toString', '__proto__', 'valueOf'])(
    'a transitions config does not resolve the prototype member %s',
    (current) => {
      const p = perm('comment.update', {
        status: { transitions: { draft: ['published'] } },
      });
      const odd: EvaluationContext = {
        subject: { id: 's1' },
        object: { status: current },
      };

      const d = decideFields(p, odd, 'write', { status: 'published' });

      expect(d.fields['status']).toBe('denied');
      expect(d.reasons['status']).toBe('transition-failed');
    },
  );

  describe('nested paths', () => {
    const order = { id: 'o1', address: { city: 'Malmo', street: 'S1' } };
    const read = (
      fields: readonly string[],
      object: Record<string, unknown> = order,
    ) =>
      decideFields(
        perm('order.read', { fields }),
        { subject: { id: 's1' }, object },
        'read',
      );
    const ok = (reasons: Record<string, FieldReason>, key: string) =>
      expect(reasons[key]).toBe('allow');

    it('an exclusion below a key hides that subtree and keeps its siblings', () => {
      const d = read(['*', '!address.street']);

      expect(d.fields).toEqual({
        id: 'allowed',
        'address.city': 'allowed',
        'address.street': 'denied',
      });
      expect(d.reasons['address.street']).toBe('not-listed');
      expect(d.allowed).toBe(false);
      ok(d.reasons, 'address.city');
    });

    it('an exclusion of the key itself does not expand it', () => {
      const d = read(['*', '!address']);

      expect(d.fields).toEqual({ id: 'allowed', address: 'denied' });
    });

    it('a listed parent with a nested exclusion keeps the rest of the parent', () => {
      const d = read(['id', 'address', '!address.street']);

      expect(d.fields).toEqual({
        id: 'allowed',
        'address.city': 'allowed',
        'address.street': 'denied',
      });
    });

    it('a nested allow denies the siblings the list does not name', () => {
      const d = read(['id', 'address.city']);

      expect(d.fields).toEqual({
        id: 'allowed',
        'address.city': 'allowed',
        'address.street': 'denied',
      });
    });

    it('a named path the data does not carry still enters the map', () => {
      const d = read(['id', 'address.city'], { id: 'o1' });

      expect(d.fields).toEqual({ id: 'allowed', 'address.city': 'allowed' });
    });

    it('a flat key containing a dot is keyed by its escaped form', () => {
      const d = read(['*'], { 'a.b': 1, 'c\\d': 2 });

      expect(Object.keys(d.fields)).toEqual(['a\\.b', 'c\\\\d']);
    });

    describe('arrays', () => {
      const lines = {
        lines: [
          { price: 1, cost: 2 },
          { price: 3, cost: 4 },
        ],
      };

      it('a read rule applies to every element and the key carries no index', () => {
        const d = read(['*', '!lines.cost'], lines);

        expect(d.fields).toEqual({
          'lines.price': 'allowed',
          'lines.cost': 'denied',
        });
      });

      it('a write that carries an array the rules descend into is not traversable', () => {
        const d = decideFields(
          perm('order.update', { fields: ['*', '!lines.cost'] }),
          { subject: { id: 's1' }, object: lines },
          'write',
          { lines: [{ price: 9 }] },
        );

        expect(d.fields).toEqual({ lines: 'denied' });
        expect(d.reasons['lines']).toBe('not-traversable');
      });

      it.each([
        ['a primitive element', [{ price: 1 }, 'x']],
        ['a Date element', [{ price: 1 }, new Date(0)]],
        ['a null element', [{ price: 1 }, null]],
        ['a nested array element', [{ price: 1 }, [{ price: 2 }]]],
        // eslint-disable-next-line no-sparse-arrays
        ['a hole', [{ price: 1 }, , { price: 2 }]],
      ])('a read of an array with %s denies the whole array', (_, value) => {
        const d = read(['*', '!lines.cost'], { lines: value });

        expect(d.fields).toEqual({ lines: 'denied' });
        expect(d.reasons['lines']).toBe('not-traversable');
      });

      it.each([
        ['NaN', Number.NaN],
        ['a negative', -1],
        ['a fraction', 1.5],
      ])(
        'a read of an array reporting a length of %s denies the whole array',
        (_, length) => {
          const lines = new Proxy([{ price: 1 }], {
            getOwnPropertyDescriptor(target, key) {
              const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
              return key === 'length' && descriptor
                ? { ...descriptor, value: length }
                : descriptor;
            },
          });

          const d = read(['*', '!lines.cost'], { lines });

          expect(d.fields).toEqual({ lines: 'denied' });
          expect(d.reasons['lines']).toBe('not-traversable');
        },
      );

      it('an array nested in an array element is walked across all elements', () => {
        const d = read(['*', '!lines.tags.secret'], {
          lines: [
            { tags: [{ name: 'a', secret: 1 }] },
            { tags: [{ name: 'b' }] },
          ],
        });

        expect(d.fields).toEqual({
          'lines.tags.name': 'allowed',
          'lines.tags.secret': 'denied',
        });
      });
    });

    describe('values the engine cannot walk', () => {
      class Row {
        city = 'c';
        street = 's';
      }
      it.each([
        ['a Date', new Date(0)],
        ['a Map', new Map()],
        ['a class instance', new Row()],
        ['a string', 'text'],
        ['null', null],
        ['undefined', undefined],
      ])('%s under a descending rule is not traversable', (_, address) => {
        const d = read(['*', '!address.street'], { id: 'o1', address });

        expect(d.fields).toEqual({ id: 'allowed', address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
      });

      it('walks an object with a null prototype like a plain object', () => {
        const address = Object.assign(Object.create(null), {
          city: 'c',
          street: 's',
        });
        const d = read(['*', '!address.street'], { address });

        expect(d.fields).toEqual({
          'address.city': 'allowed',
          'address.street': 'denied',
        });
      });

      it('never calls a getter, and denies the object that holds it', () => {
        const street = vi.fn(() => 's');
        const address = {
          city: 'c',
          get street() {
            return street();
          },
        };
        const d = read(['*', '!address.street'], { address });

        expect(d.fields).toEqual({ address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
        expect(street).not.toHaveBeenCalled();
      });

      it('never calls a getter on the object the rules descend into', () => {
        const address = vi.fn(() => ({ city: 'c' }));
        const object = {
          id: 'o1',
          get address() {
            return address();
          },
        };
        const d = read(['*', '!address.street'], object);

        expect(d.fields).toEqual({ id: 'allowed', address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
        expect(address).not.toHaveBeenCalled();
      });

      it('terminates on a self-referencing object', () => {
        const a: Record<string, unknown> = { x: 1 };
        a['self'] = a;
        const d = read(['*', '!self.self.self.x'], a);

        expect(d.fields['self.self']).toBe('denied');
        expect(d.reasons['self.self']).toBe('not-traversable');
        expect(
          Object.keys(d.fields).some((k) => k.startsWith('self.self.')),
        ).toBe(false);
      });

      it('an expanded object with an empty-string key is not traversable', () => {
        const d = read(['*', '!address.street'], {
          id: 'o1',
          address: { '': 1, city: 'c', street: 's' },
        });

        expect(d.fields).toEqual({ id: 'allowed', address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
      });

      it('a JSON object with an own __proto__ key never keys a map', () => {
        const object = JSON.parse(
          '{"address":{"__proto__":{"p":1},"city":"c"}}',
        ) as Record<string, unknown>;
        const d = read(['*', '!address.street'], object);

        expect(Object.keys(d.fields).sort()).toEqual([
          'address.city',
          'address.street',
        ]);
        expect(Object.keys(d.reasons).sort()).toEqual([
          'address.city',
          'address.street',
        ]);
      });
    });

    describe('write axis', () => {
      const write = (
        rules: FieldRules,
        object: Record<string, unknown>,
        proposed?: Record<string, unknown>,
      ) =>
        decideFields(
          perm('order.update', rules),
          { subject: { id: 's1' }, object },
          'write',
          proposed,
        );
      const country = { 'address.country': { targets: ['SE'] } };

      it('a targets config on a path refuses a proposed value outside the targets', () => {
        const d = write(
          country,
          { address: {} },
          { address: { country: 'US' } },
        );

        expect(d.fields['address.country']).toBe('denied');
        expect(d.reasons['address.country']).toBe('targets-failed');
      });

      it('a stored value the targets refuse to replace leaves its parent not traversable', () => {
        const d = write(
          country,
          { address: { country: 'SE' } },
          { address: { country: 'US' } },
        );

        expect(d.fields).toEqual({ address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
      });

      it('a targets config on a path allows a proposed value inside the targets', () => {
        const d = write(
          country,
          { address: { country: 'SE' } },
          { address: { country: 'SE' } },
        );

        expect(d.fields['address.country']).toBe('allowed');
      });

      it('a transitions config on a path reads the current value at that path', () => {
        const d = write(
          { 'a.status': { transitions: { draft: ['live'] } } },
          { a: { status: 'draft' } },
          { a: { status: 'live' } },
        );

        expect(d.fields['a.status']).toBe('allowed');
      });

      it('a path config with no data names the path and asks for the proposed value', () => {
        const d = write(country, {});

        expect(d.fields).toEqual({ 'address.country': 'unevaluable' });
        expect(d.reasons['address.country']).toBe('proposed-required');
      });

      it('a write that nulls a subtree the rules descend into is not traversable', () => {
        const d = write({ fields: ['*', '!address.street'] }, order, {
          address: null,
        });

        expect(d.fields).toEqual({ id: 'allowed', address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
      });

      it('a plain stored value with a Date proposed is one not-traversable entry', () => {
        const d = write({ fields: ['*', '!address.street'] }, order, {
          address: new Date(0),
        });

        expect(d.fields).toEqual({ id: 'allowed', address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
      });

      it('walks both the object and the write', () => {
        const d = write(
          { fields: ['*', '!address.street'] },
          { id: 'o1', address: { city: 'Malmo' } },
          { address: { zip: '1' } },
        );

        expect(d.fields).toEqual({
          id: 'allowed',
          'address.city': 'allowed',
          'address.street': 'denied',
          'address.zip': 'allowed',
        });
      });

      it('a proposed object with an own __proto__ key never keys a map', () => {
        const proposed = JSON.parse(
          '{"address":{"__proto__":{"p":1},"city":"c"}}',
        ) as Record<string, unknown>;
        const d = write(
          { fields: ['*', '!address.street'] },
          { id: 'o1', address: { city: 'Malmo' } },
          proposed,
        );

        expect(Object.keys(d.fields).sort()).toEqual([
          'address.city',
          'address.street',
          'id',
        ]);
      });
    });
  });

  describe('flat parity and write replacement', () => {
    const decide = (
      fields: FieldRules,
      axis: 'read' | 'write',
      object: Record<string, unknown>,
      proposed?: Record<string, unknown>,
    ) =>
      decideFields(
        perm('order.update', fields),
        { subject: { id: 's1' }, object },
        axis,
        proposed,
      );
    const picked = (
      outcome: ReturnType<typeof decideFields>,
      proposed: Record<string, unknown>,
    ) => pickAllowedFields({ ...outcome, action: allowedAction }, proposed);

    it('an empty-string rule key configures the empty-string field', () => {
      const d = decide({ '': { targets: ['x'] } }, 'write', {}, { '': 'y' });

      expect(d.fields).toEqual({ '': 'denied' });
      expect(d.reasons['']).toBe('targets-failed');
    });

    it('a bare "!" entry excludes the empty-string field', () => {
      const d = decide({ fields: ['*', '!'] }, 'read', { '': 'secret', a: 1 });

      expect(d.fields).toEqual({ '': 'denied', a: 'allowed' });
      expect(d.reasons['']).toBe('not-listed');
    });

    it('pick copies a top-level getter key, as the flat decision allows it', () => {
      const proposed = {
        id: 1,
        get status() {
          return 'draft';
        },
      };
      const outcome = decide({ fields: ['*'] }, 'read', proposed);

      expect(picked(outcome, proposed)).toEqual({ id: 1, status: 'draft' });
    });

    it('a transitions config reads a stored top-level getter', () => {
      const object = {
        get status() {
          return 'draft';
        },
      };
      const d = decide(
        { status: { transitions: { draft: ['published'] } } },
        'write',
        object,
        { status: 'published' },
      );

      expect(d.fields['status']).toBe('allowed');
    });

    it('a targets config reads a proposed top-level getter', () => {
      const proposed = {
        get status() {
          return 'published';
        },
      };
      const d = decide(
        { status: { targets: ['published'] } },
        'write',
        {},
        proposed,
      );

      expect(d.fields['status']).toBe('allowed');
    });

    describe('hostile objects', () => {
      const revoked = () => {
        const { proxy, revoke } = Proxy.revocable({}, {});
        revoke();
        return proxy;
      };
      const throwing = () =>
        new Proxy(
          {},
          {
            getOwnPropertyDescriptor() {
              throw new Error('trap');
            },
            ownKeys() {
              throw new Error('trap');
            },
          },
        );

      it.each([
        ['a revoked proxy', revoked],
        ['a proxy whose traps throw', throwing],
      ])('%s is not traversable and never throws', (_, make) => {
        const rules = { fields: ['*', '!address.street'] };
        const object = { id: 'o1', address: make() };

        const read = decide(rules, 'read', object);

        expect(read.fields).toEqual({ id: 'allowed', address: 'denied' });
        expect(read.reasons['address']).toBe('not-traversable');

        const write = decide(rules, 'write', { id: 'o1' }, object);

        expect(write.reasons['address']).toBe('not-traversable');
      });

      it.each([
        ['a revoked proxy', revoked],
        ['a proxy whose traps throw', throwing],
      ])('pick omits %s where the decision descends', (_, make) => {
        const outcome = decide({ fields: ['*', '!address.street'] }, 'read', {
          id: 'o1',
          address: { city: 'c', street: 's' },
        });

        expect(picked(outcome, { id: 'o1', address: make() })).toEqual({
          id: 'o1',
        });
      });
    });

    describe('replacing a stored subtree', () => {
      const rules = { fields: ['*', '!address.street'] };

      it('denies a parent whose stored value holds a denied descendant', () => {
        const proposed = { address: { city: 'X' } };
        const d = decide(
          rules,
          'write',
          { address: { city: 'c', street: 's' } },
          proposed,
        );

        expect(d.fields).toEqual({ address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
        expect(picked(d, proposed)).toEqual({});
      });

      it('walks a parent whose stored value holds no denied descendant', () => {
        const proposed = { address: { city: 'X' } };
        const d = decide(rules, 'write', { address: { city: 'c' } }, proposed);

        expect(d.fields['address.city']).toBe('allowed');
        expect(picked(d, proposed)).toEqual({ address: { city: 'X' } });
      });

      it('bubbles the refusal up through a stored grandparent', () => {
        const d = decide(
          { fields: ['*', '!a.b.c'] },
          'write',
          { a: { b: { c: 1, d: 2 } } },
          { a: { b: { d: 3 } } },
        );

        expect(d.fields).toEqual({ a: 'denied' });
        expect(d.reasons['a']).toBe('not-traversable');
      });

      it('asks for the stored parent when the write carries one it lacks', () => {
        const d = decide(
          rules,
          'write',
          { id: 'o1' },
          { address: { city: 'X' } },
        );

        expect(d.fields['address']).toBe('unevaluable');
        expect(d.reasons['address']).toBe('missing-field');
      });

      it('allows a config path when no stored sibling is denied', () => {
        const proposed = { address: { country: 'SE' } };
        const d = decide(
          { 'address.country': { targets: ['SE'] } },
          'write',
          { address: { country: 'NO', zip: '1' } },
          proposed,
        );

        expect(d.fields).toEqual({
          'address.country': 'allowed',
          'address.zip': 'allowed',
        });
      });
    });

    describe('raw dotted keys on the write axis', () => {
      it.each([
        [['*', '!address.street'], 'address\\.street'],
        [['*', '!address'], 'address\\.street'],
      ])('%j denies a proposed key spelling a denied path', (list, key) => {
        const proposed = { 'address.street': 'X' };
        const d = decide({ fields: list }, 'write', {}, proposed);

        expect(d.fields[key]).toBe('denied');
        expect(d.reasons[key]).toBe('not-traversable');
        expect(picked(d, proposed)).toEqual({});
      });

      it('allows a dotted key the path reading also allows', () => {
        const proposed = { 'a.b': 1 };
        const d = decide({ fields: ['*'] }, 'write', {}, proposed);

        expect(d.fields).toEqual({ 'a\\.b': 'allowed' });
        expect(picked(d, proposed)).toEqual({ 'a.b': 1 });
      });

      it('applies a path config to a dotted key', () => {
        const d = decide(
          { 'address.country': { targets: ['SE'] } },
          'write',
          {},
          { 'address.country': 'US' },
        );

        expect(d.reasons['address\\.country']).toBe('not-traversable');
      });

      it('checks a dotted key one level down', () => {
        const d = decide(
          { fields: ['*', '!address.meta.secret'] },
          'write',
          { address: { city: 'c' } },
          { address: { 'meta.secret': 1 } },
        );

        expect(d.fields['address.meta\\.secret']).toBe('denied');
        expect(d.reasons['address.meta\\.secret']).toBe('not-traversable');
      });
    });
  });

  describe('snapshots and path-shaped keys', () => {
    const decide = (
      fields: FieldRules,
      axis: 'read' | 'write',
      object: Record<string, unknown>,
      proposed?: Record<string, unknown>,
    ) =>
      decideFields(
        perm('order.update', fields),
        { subject: { id: 's1' }, object },
        axis,
        proposed,
      );
    const picked = (
      outcome: ReturnType<typeof decideFields>,
      proposed: Record<string, unknown>,
    ) => pickAllowedFields({ ...outcome, action: allowedAction }, proposed);
    const rules = { fields: ['*', '!address.street'] };

    describe('a proxy whose traps throw after some calls', () => {
      const stateful = (limit: number) => {
        let calls = 0;
        const guard = () => {
          if (++calls > limit) throw new Error('trap');
        };
        return new Proxy(
          { city: 'c' },
          {
            ownKeys(target) {
              guard();
              return Reflect.ownKeys(target);
            },
            getOwnPropertyDescriptor(target, key) {
              guard();
              return Reflect.getOwnPropertyDescriptor(target, key);
            },
            getPrototypeOf(target) {
              guard();
              return Reflect.getPrototypeOf(target);
            },
            has(target, key) {
              guard();
              return Reflect.has(target, key);
            },
          },
        );
      };
      const limits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 20];

      it.each(limits)('read never throws after %i calls', (limit) => {
        expect(() =>
          decide(rules, 'read', { address: stateful(limit) }),
        ).not.toThrow();
      });

      it.each(limits)('write never throws after %i calls', (limit) => {
        expect(() =>
          decide(
            rules,
            'write',
            { address: stateful(limit) },
            {
              address: stateful(limit),
            },
          ),
        ).not.toThrow();
      });

      it.each(limits)('pick never throws after %i calls', (limit) => {
        const outcome = decide(rules, 'read', { address: { city: 'c' } });

        expect(() =>
          picked(outcome, { address: stateful(limit) }),
        ).not.toThrow();
      });

      it('a config key on a throwing top-level proxy does not throw', () => {
        const object = stateful(0) as unknown as Record<string, unknown>;

        expect(() =>
          decide({ status: { targets: ['x'] } }, 'write', object, {
            status: 'x',
          }),
        ).not.toThrow();
      });
    });

    describe('stored keys the replace would erase', () => {
      const proposed = { address: { city: 'X' } };

      it.each([
        ['a * key', { city: 'c', '*': 'keep' }],
        ['a !name key', { city: 'c', '!street': 's' }],
        [
          'an own __proto__ key',
          JSON.parse('{"city":"c","__proto__":{"k":1}}') as unknown,
        ],
      ])('%s under a walked parent refuses the parent', (_, address) => {
        const d = decide(rules, 'write', { address }, proposed);

        expect(d.fields).toEqual({ address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
        expect(picked(d, proposed)).toEqual({});
      });

      it('a stored dotted key a rule denies refuses the parent', () => {
        const d = decide(
          { fields: ['*', '!address.meta.secret'] },
          'write',
          { address: { city: 'c', 'meta.secret': 's' } },
          proposed,
        );

        expect(d.fields).toEqual({ address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
      });
    });

    describe('write keys that are shaped like paths', () => {
      it.each([
        'address.__proto__',
        'address.',
        'address.*',
        'address..x',
        'address.!x',
        '.address',
      ])('%s is denied under an excluded ancestor', (key) => {
        const proposed = { [key]: 'X' };
        const d = decide({ fields: ['*', '!address'] }, 'write', {}, proposed);
        const mapKey = Object.keys(d.fields)[0] as string;

        expect(d.fields[mapKey]).toBe('denied');
        expect(d.reasons[mapKey]).toBe('not-traversable');
        expect(picked(d, proposed)).toEqual({});
      });

      it.each(['a[0]', 'a]b', 'a[b'])(
        '%s is denied on write and allowed on read',
        (key) => {
          const write = decide({ fields: ['*'] }, 'write', {}, { [key]: 1 });
          const read = decide({ fields: ['*'] }, 'read', { [key]: 1 });

          expect(Object.values(write.fields)).toEqual(['denied']);
          expect(Object.values(write.reasons)).toEqual(['not-traversable']);
          expect(Object.values(read.fields)).toEqual(['allowed']);
        },
      );

      it('denies a dotted key whose path crosses a config', () => {
        const proposed = { 'address.street': 'X' };
        const d = decide(
          { address: { targets: ['A'] } },
          'write',
          { address: 'A' },
          proposed,
        );

        expect(d.fields['address\\.street']).toBe('denied');
        expect(d.reasons['address\\.street']).toBe('not-traversable');
      });

      it('denies a dotted key whose path reaches rules below it', () => {
        const proposed = { 'a.b': { c: 'X' } };
        const d = decide({ fields: ['*', '!a.b.c'] }, 'write', {}, proposed);

        expect(d.fields['a\\.b']).toBe('denied');
        expect(d.reasons['a\\.b']).toBe('not-traversable');
        expect(picked(d, proposed)).toEqual({});
      });
    });
  });

  describe('keys that leave the rule tree and keys the walk cannot see', () => {
    const decide = (
      fields: FieldRules,
      axis: 'read' | 'write',
      object: Record<string, unknown>,
      proposed?: Record<string, unknown>,
    ) =>
      decideFields(
        perm('order.update', fields),
        { subject: { id: 's1' }, object },
        axis,
        proposed,
      );
    const picked = (
      outcome: ReturnType<typeof decideFields>,
      proposed: Record<string, unknown>,
    ) => pickAllowedFields({ ...outcome, action: allowedAction }, proposed);
    const escaped = (key: string) => key.replace(/\./g, '\\.');

    it.each(['lines.0.cost', 'lines.$.cost', 'lines.0'])(
      'denies %s, which leaves the rules at a node that has rules below it',
      (key) => {
        const proposed = { [key]: 1 };
        const d = decide(
          { fields: ['*', '!lines.cost'] },
          'write',
          { lines: [{ price: 1, cost: 2 }] },
          proposed,
        );

        expect(d.fields[escaped(key)]).toBe('denied');
        expect(d.reasons[escaped(key)]).toBe('not-traversable');
        expect(picked(d, proposed)).toEqual({});
      },
    );

    it('denies an index path below a config path', () => {
      const proposed = { 'addresses.0.status': 'pub' };
      const d = decide(
        { 'addresses.status': { transitions: { draft: ['pub'] } } },
        'write',
        { addresses: [{ status: 'draft' }] },
        proposed,
      );

      expect(d.fields['addresses\\.0\\.status']).toBe('denied');
      expect(d.reasons['addresses\\.0\\.status']).toBe('not-traversable');
    });

    it('denies a sibling path below a node that has an exclusion', () => {
      const d = decide(
        { fields: ['*', '!address.street'] },
        'write',
        {},
        { 'address.zip': '1' },
      );

      expect(d.fields['address\\.zip']).toBe('denied');
    });

    it('allows a dotted key under a node with no rules below it', () => {
      const d = decide(
        { fields: ['*', '!address.street'] },
        'write',
        {},
        { 'other.zip': '1' },
      );

      expect(d.fields['other\\.zip']).toBe('allowed');
    });

    describe('stored keys an enumerating walk does not list', () => {
      const proposed = { address: { city: 'X' } };
      const rules = { fields: ['*', '!address.street'] };
      const hidden = () => {
        const address: Record<string | symbol, unknown> = { city: 'c' };
        Object.defineProperty(address, 'street', {
          value: 's',
          enumerable: false,
        });
        return address;
      };

      it('a non-enumerable key refuses the replaced parent on write', () => {
        const d = decide(rules, 'write', { address: hidden() }, proposed);

        expect(d.fields).toEqual({ address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
        expect(picked(d, proposed)).toEqual({});
      });

      it('a symbol key refuses the replaced parent on write', () => {
        const d = decide(
          rules,
          'write',
          { address: { city: 'c', [Symbol('s')]: 1 } },
          proposed,
        );

        expect(d.fields).toEqual({ address: 'denied' });
        expect(d.reasons['address']).toBe('not-traversable');
      });

      it('leaves the read axis walking the same parent', () => {
        const d = decide(rules, 'read', { address: hidden() });

        expect(d.fields).toEqual({
          'address.city': 'allowed',
          'address.street': 'denied',
        });
      });
    });

    describe('an array with an own non-index property', () => {
      const lines = () => {
        const array = [{ price: 1, cost: 2 }] as unknown[] & {
          secret?: string;
        };
        array.secret = 's';
        return array;
      };

      it('is not traversable on read', () => {
        const d = decide({ fields: ['*', '!lines.cost'] }, 'read', {
          lines: lines(),
        });

        expect(d.fields).toEqual({ lines: 'denied' });
        expect(d.reasons['lines']).toBe('not-traversable');
      });

      it('is not traversable on write', () => {
        const d = decide(
          { fields: ['*', '!lines.cost'] },
          'write',
          {},
          { lines: lines() },
        );

        expect(d.reasons['lines']).toBe('not-traversable');
      });

      it('is left out by pick where the decision descends', () => {
        const outcome = decide({ fields: ['*', '!lines.cost'] }, 'read', {
          lines: [{ price: 1, cost: 2 }],
        });

        expect(picked(outcome, { lines: lines() })).toEqual({});
      });
    });
  });
});

const allowedAction: Decision = {
  key: 'user.update',
  allowed: true,
  reason: 'allow',
};

function decisionOf(
  fields: Record<string, FieldState>,
  action: Decision = allowedAction,
): FieldDecision {
  return {
    allowed:
      action.allowed && Object.values(fields).every((s) => s === 'allowed'),
    action,
    fields,
    reasons: {},
  };
}

describe('pickAllowedFields', () => {
  it('keeps the allowed keys and drops every other state', () => {
    const d = decisionOf({
      name: 'allowed',
      role: 'denied',
      status: 'unevaluable',
    });

    expect(
      pickAllowedFields(d, { name: 'Eve', role: 'admin', status: 'x' }),
    ).toEqual({ name: 'Eve' });
  });

  it('drops a key the decision never decided', () => {
    const d = decisionOf({ name: 'allowed' });

    expect(pickAllowedFields(d, { name: 'Eve', role: 'admin' })).toEqual({
      name: 'Eve',
    });
  });

  it('narrows a real decision to the writable half', () => {
    const p = perm('user.update', { fields: ['*', '!role'] });
    const self: EvaluationContext = {
      subject: { id: 'u1' },
      object: { id: 'u1', name: 'Ann' },
    };
    const proposed = { name: 'Eve', role: 'admin' };
    const outcome = decideFields(p, self, 'write', proposed);
    const d: FieldDecision = { ...outcome, action: allowedAction };

    expect(pickAllowedFields(d, proposed)).toEqual({ name: 'Eve' });
  });

  it('throws when the action is refused', () => {
    const d = decisionOf(
      { name: 'allowed' },
      { key: 'user.update', allowed: false, reason: 'no-rule-matched' },
    );

    expect(() => pickAllowedFields(d, { name: 'Eve' })).toThrow(
      ActionNotAllowedError,
    );
  });

  it('returns the allowed subset when only a field is denied', () => {
    const d = decisionOf({ name: 'allowed', role: 'denied' });

    expect(d.allowed).toBe(false);
    expect(pickAllowedFields(d, { name: 'Eve', role: 'admin' })).toEqual({
      name: 'Eve',
    });
  });

  describe('nested paths', () => {
    const pick = (
      fields: readonly string[],
      proposed: Record<string, unknown>,
    ) =>
      pickAllowedFields(
        {
          ...decideFields(
            perm('order.read', { fields }),
            { subject: { id: 's1' }, object: proposed },
            'read',
          ),
          action: allowedAction,
        },
        proposed,
      );

    it('rebuilds the parent without the excluded child', () => {
      const address = { city: 'Malmo', street: 'S1' };
      const picked = pick(['*', '!address.street'], { id: 'o1', address });

      expect(picked).toEqual({ id: 'o1', address: { city: 'Malmo' } });
      expect(picked['address']).not.toBe(address);
    });

    it('keeps every element of an array and its indexes', () => {
      expect(
        pick(['*', '!lines.cost'], {
          lines: [
            { price: 1, cost: 2 },
            { price: 3, cost: 4 },
          ],
        }),
      ).toEqual({ lines: [{ price: 1 }, { price: 3 }] });
    });

    it('an element whose children are all withheld becomes an empty object', () => {
      expect(pick(['*', '!lines.cost'], { lines: [{ cost: 2 }] })).toEqual({
        lines: [{}],
      });
    });

    it('builds no empty parent object', () => {
      const picked = pick(['id', 'address.city'], {
        id: 'o1',
        address: { street: 'S1' },
      });

      expect(picked).toEqual({ id: 'o1' });
      expect(Object.keys(picked)).toEqual(['id']);
    });

    it('copies a subtree no rule descends into by reference', () => {
      const meta = { tags: ['a'] };
      const picked = pick(['*', '!address.street'], {
        meta,
        address: { city: 'c' },
      });

      expect(picked['meta']).toBe(meta);
    });

    it('never calls a getter on the value it rebuilds', () => {
      const street = vi.fn(() => 's');
      const address = {
        city: 'c',
        get street() {
          return street();
        },
      };
      const picked = pick(['*', '!address.street'], { address });

      expect(picked).toEqual({});
      expect(street).not.toHaveBeenCalled();
    });

    it('withholds a value it cannot descend into where the decision descends', () => {
      const decision = {
        ...decideFields(
          perm('order.read', { fields: ['*', '!address.street'] }),
          {
            subject: { id: 's1' },
            object: { id: 'o1', address: { city: 'c', street: 's' } },
          },
          'read',
        ),
        action: allowedAction,
      };

      expect(
        pickAllowedFields(decision, { id: 'o1', address: new Date(0) }),
      ).toEqual({ id: 'o1' });
      expect(pickAllowedFields(decision, { id: 'o1', address: null })).toEqual({
        id: 'o1',
      });
    });

    it('withholds an array holding a non-object element whole', () => {
      expect(
        pick(['*', '!lines.cost'], { lines: [{ price: 1 }, 'x'] }),
      ).toEqual({});
    });

    it('builds every level on Object.prototype without an own __proto__', () => {
      const proposed = JSON.parse(
        '{"__proto__":{"top":1},"address":{"__proto__":{"p":1},"city":"c"}}',
      ) as Record<string, unknown>;
      const picked = pick(['*', '!address.street'], proposed);
      const address = picked['address'] as Record<string, unknown>;

      for (const level of [picked, address]) {
        expect(Object.getPrototypeOf(level)).toBe(Object.prototype);
        expect(Object.hasOwn(level, '__proto__')).toBe(false);
      }
      expect(address).toEqual({ city: 'c' });
    });

    it('terminates on a self-referencing value', () => {
      const a: Record<string, unknown> = { x: 1 };
      a['self'] = a;

      expect(() => pick(['*', '!self.self.self.x'], a)).not.toThrow();
    });
  });

  it('returns only keys the decision marks allowed, over generated input', () => {
    // A deterministic sweep: the invariant is a property of the output, not of
    // any one shape, and the names include the prototype members a field map
    // keyed by data can carry.
    const states: readonly FieldState[] = ['allowed', 'denied', 'unevaluable'];
    const names = [
      'id',
      'name',
      'role',
      '__proto__',
      'constructor',
      'toString',
    ];
    let seed = 1;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    const define = (bag: object, key: string, value: unknown) =>
      Object.defineProperty(bag, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });

    for (let run = 0; run < 500; run += 1) {
      const fields: Record<string, FieldState> = {};
      const proposed: Record<string, unknown> = {};
      for (const name of names) {
        if (next() % 3 !== 0) {
          define(fields, name, states[next() % states.length] as FieldState);
        }
        if (next() % 2 === 0) define(proposed, name, run);
      }
      const picked = pickAllowedFields(decisionOf(fields), proposed);
      for (const key of Object.keys(picked)) {
        expect(Object.getOwnPropertyDescriptor(fields, key)?.value).toBe(
          'allowed',
        );
        expect(Object.getOwnPropertyDescriptor(proposed, key)?.value).toBe(run);
      }
    }
  });
});

describe('a flat dotted key on the read axis', () => {
  const read = (fields: readonly string[], object: Record<string, unknown>) => {
    const d = decideFields(
      perm('order.read', { fields }),
      { ...ctx, object },
      'read',
    );
    return { ...d, action: allowedAction };
  };

  it('is denied when an exclusion names the path it spells', () => {
    const object = { 'address.street': 'S', id: 1 };
    const d = read(['*', '!address.street'], object);

    expect(d.fields['address\\.street']).toBe('denied');
    expect(d.reasons['address\\.street']).toBe('not-listed');
    expect(pickAllowedFields(d, object)).toEqual({ id: 1 });
  });

  it('is denied when an exclusion covers a parent of the path', () => {
    const d = read(['*', '!address'], { 'address.city': 'C' });

    expect(d.fields['address\\.city']).toBe('denied');
  });

  it('stays allowed when no exclusion covers the path', () => {
    expect(read(['*', '!x.y'], { 'z.w': 1 }).fields['z\\.w']).toBe('allowed');
    expect(read(['*', '!a'], { 'b.c': 2 }).fields['b\\.c']).toBe('allowed');
    expect(read(['*'], { 'a.b': 1 }).fields['a\\.b']).toBe('allowed');
  });

  it('is never allowed by the path when the flat reading denies it', () => {
    expect(read(['a'], { 'a.b': 1 }).fields['a\\.b']).toBe('denied');
    expect(
      read(['id', 'address.city'], { id: 1, 'address.city': 'C' }).fields[
        'address\\.city'
      ],
    ).toBe('denied');
    expect(read(['a.b', '!a.b.c'], { 'a.b.d': 2 }).fields['a\\.b\\.d']).toBe(
      'denied',
    );
  });

  it('is decided by the flat reading alone when a rule names the flat key', () => {
    expect(read(['a\\.b'], { 'a.b': 1 }).fields['a\\.b']).toBe('allowed');
    expect(read(['a\\.b', 'id'], { 'a.b': 1 }).fields['a\\.b']).toBe('allowed');
    expect(read(['*', '!a\\.b'], { 'a.b': 1 }).fields['a\\.b']).toBe('denied');
  });

  it('reads an unclean split as the field names before the unclean segment', () => {
    for (const key of ['a.*', 'a..b', 'a.!b', 'a.__proto__']) {
      const object = Object.fromEntries([[key, 1]]);
      expect(read(['*', '!a'], object).fields[key.replace(/\./g, '\\.')]).toBe(
        'denied',
      );
      expect(read(['*'], object).fields[key.replace(/\./g, '\\.')]).toBe(
        'allowed',
      );
    }
  });

  it('is denied as not-traversable when its path holds a ruled subtree', () => {
    const object = { id: 1, 'a.b': { c: 'secret' } };
    const d = read(['*', '!a.b.c'], object);

    expect(d.fields['a\\.b']).toBe('denied');
    expect(d.reasons['a\\.b']).toBe('not-traversable');
    expect(pickAllowedFields(d, object)).toEqual({ id: 1 });
  });

  it('is denied as not-traversable when an unclean split stops under a ruled node', () => {
    const d = read(['*', '!a.b.c'], { 'a.b.*': { c: 'secret' } });

    expect(d.fields['a\\.b\\.*']).toBe('denied');
    expect(d.reasons['a\\.b\\.*']).toBe('not-traversable');
  });

  it('is not decided by a flat key that is only a write config or an exclusion', () => {
    const d = decideFields(
      {
        key: 'order.read',
        object: 'order',
        action: 'read',
        fields: {
          fields: ['*', '!a.b'],
          'a\\.b': { targets: [1] },
        },
      },
      { ...ctx, object: { 'a.b': 1 } },
      'read',
    );

    expect(d.fields['a\\.b']).toBe('denied');
  });

  it('is denied as not-traversable when its path leaves the rules below a ruled field', () => {
    for (const [rules, key] of [
      [['*', '!lines.cost'], 'lines.0.cost'],
      [['*', '!address.street'], 'address.x'],
      [['*', '!a.b'], 'a.c'],
    ] as const) {
      const d = read(rules, Object.fromEntries([[key, 1]]));
      const out = key.replace(/\./g, '\\.');

      expect(d.fields[out]).toBe('denied');
      expect(d.reasons[out]).toBe('not-traversable');
    }
  });

  it('is denied at a nested level', () => {
    const object = { id: 1, meta: { 'x.y': 1, ok: 2 } };
    const d = read(['*', '!meta.x.y'], object);

    expect(d.fields['meta.x\\.y']).toBe('denied');
    expect(pickAllowedFields(d, object)).toEqual({ id: 1, meta: { ok: 2 } });
  });

  it('is denied inside an array element', () => {
    const object = { lines: [{ 'x.y': 1, ok: 2 }] };
    const d = read(['*', '!lines.x.y'], object);

    expect(d.fields['lines.x\\.y']).toBe('denied');
    expect(pickAllowedFields(d, object)).toEqual({ lines: [{ ok: 2 }] });
  });

  it('denies the flat key and the nested key of a mixed row', () => {
    const object = {
      id: 1,
      address: { street: 'S', city: 'C' },
      'address.street': 'T',
    };
    const d = read(['*', '!address.street'], object);

    expect(pickAllowedFields(d, object)).toEqual({
      id: 1,
      address: { city: 'C' },
    });
  });
});
