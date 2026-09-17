import { describe, expect, it, vi } from 'vitest';

import { applyDenyOverlay } from './deny-overlay.js';
import { OriginCollisionError, UnknownPermissionError } from './errors.js';
import { federatedPolicies } from './federated-policies.js';
import { hydratePolicy } from './hydrate-policy.js';
import { parseMatrix } from './parse-matrix.js';
import { policy } from './authoring.js';
import type { Matrix } from './types.js';

const orders: Matrix = {
  permissions: [
    {
      key: 'orders:invoice.read',
      object: 'orders:invoice',
      action: 'read',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'ops' }] },
      ],
    },
  ],
};

const billing: Matrix = {
  permissions: [
    {
      key: 'billing:invoice.read',
      object: 'billing:invoice',
      action: 'read',
      rules: [
        {
          when: [{ field: 'subject.roles', op: 'contains', value: 'finance' }],
        },
      ],
    },
  ],
};

/** A document with no namespace anywhere, which two services can both emit. */
const bare = (): Matrix => ({
  permissions: [
    {
      key: 'invoice.read',
      object: 'invoice',
      action: 'read',
      rules: [{ when: [] }],
    },
  ],
});

const BOUNDARY = Date.parse('2026-09-17T12:00:00Z');

/** Allowed only before the boundary. */
const early: Matrix = {
  permissions: [
    {
      key: 'early:window.enter',
      object: 'early:window',
      action: 'enter',
      rules: [{ when: [{ field: 'now', op: 'before', value: BOUNDARY }] }],
    },
  ],
};

/** Allowed only after the same boundary. */
const late: Matrix = {
  permissions: [
    {
      key: 'late:window.enter',
      object: 'late:window',
      action: 'enter',
      rules: [{ when: [{ field: 'now', op: 'after', value: BOUNDARY }] }],
    },
  ],
};

const subject = { id: 'u1', roles: ['finance'] };

describe('federatedPolicies', () => {
  describe('the collision check', () => {
    it('refuses two origins claiming one key, naming both', () => {
      let raised: unknown;
      try {
        federatedPolicies({
          orders: parseMatrix(bare()),
          billing: parseMatrix(bare()),
        });
      } catch (error) {
        raised = error;
      }

      expect(raised).toBeInstanceOf(OriginCollisionError);
      const collision = raised as OriginCollisionError;
      expect(collision.key).toBe('invoice.read');
      expect(collision.origins).toEqual(['orders', 'billing']);
      expect(collision.message).toContain('"invoice.read"');
      expect(collision.message).toContain('"orders"');
      expect(collision.message).toContain('"billing"');
    });

    it('constructs over disjoint key sets', () => {
      const fleet = federatedPolicies({
        orders: parseMatrix(orders),
        billing: parseMatrix(billing),
      });

      expect(fleet.get('orders')).toBeDefined();
      expect(fleet.get('billing')).toBeDefined();
    });

    it('reads permission keys, so a deny rule collides with nothing', () => {
      const vetoed: Matrix = {
        schema: { objects: { 'orders:invoice': { fields: {} } } },
        permissions: [
          {
            key: 'orders:invoice.read',
            object: 'orders:invoice',
            action: 'read',
            rules: [{ when: [] }],
            denyRules: [
              { when: [{ field: 'subject.id', op: 'eq', value: 'u9' }] },
            ],
          },
        ],
      };

      expect(() =>
        federatedPolicies({
          orders: parseMatrix(vetoed),
          billing: parseMatrix(billing),
        }),
      ).not.toThrow();
    });
  });

  describe('routing', () => {
    it('answers with the decision the holding origin reaches', () => {
      const ordersAccess = parseMatrix(orders);
      const fleet = federatedPolicies({
        orders: ordersAccess,
        billing: parseMatrix(billing),
      });

      expect(fleet.can(subject, 'orders:invoice', 'read')).toEqual(
        ordersAccess.can(subject, 'orders:invoice', 'read'),
      );
      expect(fleet.can(subject, 'billing:invoice', 'read').allowed).toBe(true);
    });

    it('forwards an unevaluable decision with its missing paths', () => {
      const owned: Matrix = {
        permissions: [
          {
            key: 'orders:order.ship',
            object: 'orders:order',
            action: 'ship',
            rules: [
              {
                when: [
                  { field: 'object.ownerId', op: 'eq', value: 'subject.id' },
                ],
              },
            ],
          },
        ],
      };
      const access = parseMatrix(owned);
      const fleet = federatedPolicies({ orders: access });

      expect(fleet.can(subject, 'orders:order', 'ship')).toEqual(
        access.can(subject, 'orders:order', 'ship'),
      );
      expect(fleet.can(subject, 'orders:order', 'ship').reason).toBe(
        'unevaluable',
      );
    });

    it('answers a key no origin holds without reaching a member', () => {
      // Open mode, so any forwarded unknown key would throw here.
      const fleet = federatedPolicies({ orders: hydratePolicy(orders) });

      expect(fleet.can(subject, 'shipping:parcel', 'read')).toEqual({
        key: 'shipping:parcel.read',
        allowed: false,
        reason: 'unknown-action',
      });
    });

    it('constructs over an empty record and holds no key', () => {
      const fleet = federatedPolicies({});

      expect(fleet.capabilities(subject)).toEqual({});
      expect(fleet.can(subject, 'orders:invoice', 'read').reason).toBe(
        'unknown-action',
      );
      expect(fleet.get('orders')).toBeUndefined();
    });
  });

  describe('the view', () => {
    it('equals the fold over the same origins at one instant', () => {
      const ordersAccess = parseMatrix(orders);
      const billingAccess = parseMatrix(billing);
      const fleet = federatedPolicies({
        orders: ordersAccess,
        billing: billingAccess,
      });
      const members = [ordersAccess, billingAccess];
      const at = Date.now();

      expect(fleet.capabilities(subject, at)).toEqual(
        Object.assign(
          {},
          ...members.map((access) => access.capabilities(subject, at)),
        ),
      );
    });

    it('settles one instant, so a boundary falls on one side for every origin', () => {
      const fleet = federatedPolicies({
        early: parseMatrix(early),
        late: parseMatrix(late),
      });

      const before = fleet.capabilities(subject, BOUNDARY - 1000);
      expect(before['early:window.enter']?.allowed).toBe(true);
      expect(before['late:window.enter']?.allowed).toBe(false);

      const after = fleet.capabilities(subject, BOUNDARY + 1000);
      expect(after['early:window.enter']?.allowed).toBe(false);
      expect(after['late:window.enter']?.allowed).toBe(true);
    });

    it('reads the wall clock once for an omitted instant', () => {
      // The clock crosses the boundary between the first read and the second,
      // so a view that reads it per origin opens both windows at once.
      const readings = [BOUNDARY - 1000, BOUNDARY + 1000];
      const clock = vi
        .spyOn(Date, 'now')
        .mockImplementation(() => readings.shift() ?? BOUNDARY + 1000);

      try {
        const fleet = federatedPolicies({
          early: parseMatrix(early),
          late: parseMatrix(late),
        });
        const view = fleet.capabilities(subject);

        expect(clock).toHaveBeenCalledTimes(1);
        expect(view['early:window.enter']?.allowed).toBe(true);
        expect(view['late:window.enter']?.allowed).toBe(false);
      } finally {
        clock.mockRestore();
      }
    });
  });

  describe('the members', () => {
    it('hands back the reference the caller passed', () => {
      const access = parseMatrix(orders);
      const fleet = federatedPolicies({ orders: access });

      expect(fleet.get('orders')).toBe(access);
      expect(fleet.get('orders')?.matrix).toBe(access.matrix);
    });

    it('answers nothing for an origin name off the prototype', () => {
      const fleet = federatedPolicies({ orders: parseMatrix(orders) });

      expect(fleet.get('toString')).toBeUndefined();
      expect(fleet.get('__proto__')).toBeUndefined();
    });

    it('takes a member the typed builder produced', () => {
      const own = policy<
        { id: string; roles: string[] },
        { 'sessions:session': { ownerId: string } }
      >()
        .for('sessions:session', (p) =>
          p.allow('read', p.eq('object.ownerId', 'subject.id')),
        )
        .build();
      const fleet = federatedPolicies({
        orders: parseMatrix(orders),
        sessions: own,
      });

      expect(fleet.get('sessions')).toBe(own);
      expect(
        fleet.can({ id: 'u1', roles: [] }, 'sessions:session', 'read', {
          ownerId: 'u1',
        }).allowed,
      ).toBe(true);
    });

    it('mixes provenances and each member keeps its unknown-key behaviour', () => {
      const own = hydratePolicy(billing);
      const fleet = federatedPolicies({
        orders: parseMatrix(orders),
        billing: own,
      });

      expect(
        fleet.get('orders')?.can(subject, 'orders:invoice', 'delete').reason,
      ).toBe('unknown-action');
      expect(() =>
        fleet.get('billing')?.can(subject, 'billing:invoice', 'delete'),
      ).toThrow(UnknownPermissionError);
    });
  });

  describe('the deny overlay', () => {
    const vetoable: Matrix = {
      schema: {
        objects: { 'orders:invoice': { fields: { region: 'string' } } },
      },
      permissions: [
        {
          key: 'orders:invoice.read',
          object: 'orders:invoice',
          action: 'read',
          rules: [{ when: [] }],
        },
      ],
    };

    it('narrows the federated answer when the member was overlaid', () => {
      const overlaid = applyDenyOverlay(
        vetoable,
        {
          'orders:invoice.read': [
            { when: [{ field: 'object.region', op: 'eq', value: 'eu' }] },
          ],
        },
        { vetoable: ['orders:invoice.read'] },
      );

      const plain = federatedPolicies({ orders: parseMatrix(vetoable) });
      const narrowed = federatedPolicies({ orders: parseMatrix(overlaid) });
      const row = { region: 'eu' };

      expect(plain.can(subject, 'orders:invoice', 'read', row).allowed).toBe(
        true,
      );
      expect(narrowed.can(subject, 'orders:invoice', 'read', row).allowed).toBe(
        false,
      );
    });

    it('refuses another origin key at the overlay call', () => {
      expect(() =>
        applyDenyOverlay(
          vetoable,
          { 'billing:invoice.read': [{ when: [] }] },
          { vetoable: ['orders:invoice.read'] },
        ),
      ).toThrow(UnknownPermissionError);
    });
  });
});
