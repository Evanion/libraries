import { describe, expect, it } from 'vitest';

import { applyDenyOverlay } from './deny-overlay.js';
import { UnknownPermissionError, UnpublishedVetoableError } from './errors.js';
import { hydratePolicy } from './hydrate-policy.js';
import { parseMatrix } from './parse-matrix.js';
import { serialize } from './serialize.js';
import type { Matrix, Permission, Subject } from './index.js';

const owner: Matrix = {
  version: 'orders@7',
  schema: {
    subject: { fields: { id: 'string', roles: 'string[]', tier: 'string' } },
    objects: {
      invoice: { fields: { ownerId: 'string', status: 'string' } },
      ledger: { fields: { period: 'string' } },
    },
  },
  permissions: [
    {
      key: 'invoice.approve',
      object: 'invoice',
      action: 'approve',
      visibility: 'public',
      rules: [
        {
          id: 'approver',
          when: [{ field: 'subject.roles', op: 'contains', value: 'approver' }],
        },
      ],
      denyRules: [
        {
          id: 'tier',
          when: [{ field: 'subject.tier', op: 'in', value: ['probation'] }],
        },
      ],
      fields: { fields: ['status'], status: { targets: ['approved'] } },
    },
    {
      key: 'invoice.read',
      object: 'invoice',
      action: 'read',
      visibility: 'public',
      rules: [{ id: 'anyone', when: [] }],
    },
    {
      key: 'ledger.reconcile',
      object: 'ledger',
      action: 'reconcile',
      visibility: 'internal',
      rules: [{ id: 'anyone', when: [] }],
    },
    {
      key: 'invoice.void',
      object: 'invoice',
      action: 'void',
      rules: [{ id: 'anyone', when: [] }],
    },
  ],
};

const access = hydratePolicy(owner);

describe('serialize', () => {
  it('hands back the authored document in full, marking included', () => {
    expect(serialize(access, 'full')).toBe(access.matrix);
    expect(serialize(access, 'full').permissions[0]).toHaveProperty(
      'visibility',
      'public',
    );
  });

  it('keeps the public permissions and drops every other one', () => {
    const contract = serialize(access, 'reduced');
    expect(contract.permissions.map((p) => p.key)).toEqual([
      'invoice.approve',
      'invoice.read',
    ]);
  });

  it('strips the marking from every permission it keeps', () => {
    for (const permission of serialize(access, 'reduced').permissions) {
      expect(permission).not.toHaveProperty('visibility');
    }
  });

  it('keeps everything else on a kept permission', () => {
    const [approve] = serialize(access, 'reduced').permissions;
    const authored = { ...(owner.permissions[0] as Permission) };
    delete authored.visibility;
    expect(approve).toEqual(authored);
  });

  it('carries the envelope version and freshness budget', () => {
    const stamped = hydratePolicy({ ...owner, maxStale: 60_000 });
    const contract = serialize(stamped, 'reduced');
    expect(contract.version).toBe('orders@7');
    expect(contract.maxStale).toBe(60_000);
  });

  it('keeps the schema entry of a published kind whole', () => {
    const contract = serialize(access, 'reduced');
    expect(contract.schema?.objects).toEqual({
      invoice: { fields: { ownerId: 'string', status: 'string' } },
    });
  });

  it('keeps the subject schema, which every published rule is checked against', () => {
    expect(serialize(access, 'reduced').schema?.subject).toEqual(
      owner.schema?.subject,
    );
  });

  it('omits the schema when no published permission names a kind', () => {
    const internal = hydratePolicy({
      schema: { objects: { ledger: { fields: { period: 'string' } } } },
      permissions: [
        { key: 'ledger.reconcile', object: 'ledger', action: 'reconcile' },
      ],
    });
    expect(serialize(internal, 'reduced')).not.toHaveProperty('schema');
  });

  it('reads an unmarked permission as internal', () => {
    const keys = serialize(access, 'reduced').permissions.map((p) => p.key);
    expect(keys).not.toContain('invoice.void');
  });

  it('publishes nothing out of a contract, so a consumer cannot re-publish', () => {
    const contract = serialize(access, 'reduced');
    const consumer = parseMatrix(contract);
    expect(serialize(consumer, 'reduced').permissions).toEqual([]);
  });

  it('round-trips a full serialization through parseMatrix unchanged', () => {
    const full = serialize(access, 'full');
    const again = parseMatrix(JSON.parse(JSON.stringify(full)) as Matrix);
    expect(again.matrix).toEqual(full);
  });

  it('refuses a vetoable key the reduction would drop', () => {
    expect(() =>
      serialize(access, 'reduced', { vetoable: ['ledger.reconcile'] }),
    ).toThrow(UnpublishedVetoableError);
  });

  it('names the key and both remedies in that refusal', () => {
    expect(() =>
      serialize(access, 'reduced', { vetoable: ['invoice.void'] }),
    ).toThrow(/"invoice\.void".*Mark "invoice\.void" public.*"vetoable"/s);
  });

  it('refuses a vetoable key the document does not define at all', () => {
    expect(() =>
      serialize(access, 'reduced', { vetoable: ['nope.read'] }),
    ).toThrow(UnknownPermissionError);
  });

  it('accepts a vetoable key that is public', () => {
    expect(() =>
      serialize(access, 'reduced', { vetoable: ['invoice.approve'] }),
    ).not.toThrow();
  });

  it('gives the overlay author a contract its own check runs against', () => {
    const contract = serialize(access, 'reduced', {
      vetoable: ['invoice.approve'],
    });
    const checked = applyDenyOverlay(
      contract,
      {
        'invoice.approve': [
          {
            id: 'sanctions',
            when: [{ field: 'subject.tier', op: 'eq', value: 'sanctioned' }],
          },
        ],
      },
      { vetoable: ['invoice.approve'] },
    );
    expect(checked.permissions[0]?.denyRules).toHaveLength(2);
  });
});

describe('a contract and the owner it came from', () => {
  const contract = parseMatrix(serialize(access, 'reduced'));
  const subjects: Subject[] = [
    { id: 'u1', roles: ['approver'], tier: 'staff' },
    { id: 'u2', roles: ['approver'], tier: 'probation' },
    { id: 'u3', roles: [], tier: 'staff' },
    { id: 'u4' },
  ];
  const objects = [
    { ownerId: 'u1', status: 'draft' },
    { ownerId: 'u2', status: 'approved' },
    {},
  ];

  it('decides every published key identically', () => {
    for (const subject of subjects) {
      for (const object of objects) {
        for (const [key, action] of [
          ['invoice', 'approve'],
          ['invoice', 'read'],
        ] as const) {
          expect(contract.can(subject, key, action, object, 0)).toEqual(
            access.can(subject, key, action, object, 0),
          );
          for (const axis of ['read', 'write'] as const) {
            const left = contract.canFields(
              subject,
              key,
              action,
              object,
              axis,
              { status: 'approved' },
              0,
            );
            const right = access.canFields(
              subject,
              key,
              action,
              object,
              axis,
              { status: 'approved' },
              0,
            );
            expect(left).toEqual(right);
          }
        }
      }
    }
  });

  it('answers unknown-action for a key that stayed internal', () => {
    expect(contract.can(subjects[0] as Subject, 'ledger', 'reconcile')).toEqual(
      {
        key: 'ledger.reconcile',
        allowed: false,
        reason: 'unknown-action',
      },
    );
  });

  it('carries the public keys of the owner capabilities record and no others', () => {
    const subject = subjects[0] as Subject;
    const theirs = access.capabilities(subject, 0);
    const ours = contract.capabilities(subject, 0);
    expect(Object.keys(ours)).toEqual(['invoice.approve', 'invoice.read']);
    for (const [key, decision] of Object.entries(ours)) {
      expect(decision).toEqual(theirs[key]);
    }
  });
});
