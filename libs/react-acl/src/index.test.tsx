import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { hydratePolicy, policy } from '@evanion/acl';
import type { Subject } from '@evanion/acl';

import {
  createPolicyContext,
  PolicyProvider,
  useCan,
  useCanFields,
  useCanMany,
  useCapabilities,
} from './index.js';

const access = hydratePolicy({
  permissions: [
    {
      key: 'comment.read',
      object: 'comment',
      action: 'read',
      rules: [
        { when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }] },
      ],
    },
    {
      key: 'comment.update',
      object: 'comment',
      action: 'update',
      rules: [
        { when: [{ field: 'object.authorId', op: 'eq', path: 'subject.id' }] },
      ],
    },
  ],
});

const HYDRATED = '2026-01-01T00:00:00Z';
const SUBJECT = { id: 's1', roles: ['editor'] };
const OBJECT = { authorId: 's1' };

/** Stable arguments, so only the clock can bust the hook memo. */
function StableRow() {
  const can = useCan('comment', 'update', OBJECT);
  return <div data-testid="stable">{can.allowed ? 'y' : 'n'}</div>;
}

function Row({ id }: { id: string }) {
  const can = useCan('comment', 'update', { authorId: id });
  return (
    <div data-testid={`row-${id}`}>{can.allowed ? 'editable' : 'readonly'}</div>
  );
}

describe('PolicyProvider', () => {
  it('takes a hydrated string instant for `now`', () => {
    const timed = hydratePolicy({
      permissions: [
        {
          key: 'comment.update',
          object: 'comment',
          action: 'update',
          rules: [
            {
              when: [
                { field: 'now', op: 'after', value: '2026-01-01T00:00:00Z' },
              ],
            },
          ],
        },
      ],
    });
    const hydrated = JSON.parse(
      JSON.stringify({ now: new Date('2026-06-01T00:00:00Z') }),
    ) as { now: string };
    render(
      <PolicyProvider
        access={timed}
        subject={{ id: 's1' }}
        context={{ now: hydrated.now }}
      >
        <Row id="s1" />
      </PolicyProvider>,
    );
    expect(screen.getByTestId('row-s1')).toHaveTextContent('editable');
  });

  it('holds the hook memo across renders for an instant compared by value', () => {
    // Both arms start from the one instant an SSR payload carries: an ISO
    // string. Passing it through keeps the hook memo, because the memo key
    // compares it by value; converting it at the call site -- what an adapter
    // does when the surface only takes a `Date` -- yields a new object every
    // render and re-evaluates the matrix every render.
    const evaluations = (convert: boolean) => {
      const spy = vi.fn(access.can.bind(access));
      const probe = { ...access, can: spy };
      function Harness() {
        const now = convert ? new Date(HYDRATED) : HYDRATED;
        return (
          <PolicyProvider access={probe} subject={SUBJECT} context={{ now }}>
            <StableRow />
          </PolicyProvider>
        );
      }
      const { rerender } = render(<Harness />);
      rerender(<Harness />);
      rerender(<Harness />);
      return spy.mock.calls.length;
    };

    expect(evaluations(false)).toBe(1);
    expect(evaluations(true)).toBe(3);
  });
});

const shop = policy<Subject, { listing: { sellerId: string } }>()
  .for('listing', (p) =>
    p.allow('update', p.eq('object.sellerId', 'subject.id')),
  )
  .build();

const backoffice = policy<
  Subject,
  { ticket: { id: string } },
  { ticket: 'close' }
>()
  .for('ticket', (p) =>
    p.allow('close', p.contains('subject.roles', 'support')),
  )
  .build();

const shopContext = createPolicyContext(shop);
const backofficeContext = createPolicyContext(backoffice);

/** Reads the bound hooks of the shop policy. */
function Listing() {
  const can = shopContext.useCan('listing', 'update', { sellerId: 's1' });
  return <div data-testid="listing">{can.allowed ? 'y' : 'n'}</div>;
}

/** Reads the bound hooks of the back-office policy. */
function Ticket() {
  const can = backofficeContext.useCan('ticket', 'close', { id: 't1' });
  return <div data-testid="ticket">{can.allowed ? 'y' : 'n'}</div>;
}

/** Reads the package's own hooks, which know no keys. */
function Untyped() {
  const can = useCan('listing', 'update', { sellerId: 's1' });
  return <div data-testid="untyped">{can.allowed ? 'y' : 'n'}</div>;
}

describe('createPolicyContext', () => {
  describe('a bound policy context', () => {
    it('decides against the access the factory was given', () => {
      const { PolicyProvider: Shop } = shopContext;
      render(
        <Shop subject={SUBJECT}>
          <Listing />
        </Shop>,
      );

      expect(screen.getByTestId('listing')).toHaveTextContent('y');
    });

    it('decides against the access a mount passes instead', () => {
      const { PolicyProvider: Shop } = shopContext;
      const stricter = hydratePolicy({
        permissions: [
          { key: 'listing.update', object: 'listing', action: 'update' },
        ],
      });

      render(
        <Shop access={stricter} subject={SUBJECT}>
          <Listing />
        </Shop>,
      );

      expect(screen.getByTestId('listing')).toHaveTextContent('n');
    });

    it('feeds the package hooks, so a component that took them still reads', () => {
      const { PolicyProvider: Shop } = shopContext;
      render(
        <Shop subject={SUBJECT}>
          <Untyped />
        </Shop>,
      );

      expect(screen.getByTestId('untyped')).toHaveTextContent('y');
    });

    it('keeps two policies apart when their providers nest', () => {
      const { PolicyProvider: Shop } = shopContext;
      const { PolicyProvider: Backoffice } = backofficeContext;

      render(
        <Shop subject={SUBJECT}>
          <Backoffice subject={{ id: 's1', roles: ['support'] }}>
            <Listing />
            <Ticket />
          </Backoffice>
        </Shop>,
      );

      // The inner provider does not answer for the outer policy's keys.
      expect(screen.getByTestId('listing')).toHaveTextContent('y');
      expect(screen.getByTestId('ticket')).toHaveTextContent('y');
    });

    it('throws outside its own provider, even under the shared one', () => {
      const spy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      expect(() =>
        render(
          <PolicyProvider access={shop} subject={SUBJECT}>
            <Listing />
          </PolicyProvider>,
        ),
      ).toThrow(/PolicyProvider/);
      spy.mockRestore();
    });
  });
});

describe('useCan', () => {
  it('useCan returns a decision from the provider context', () => {
    render(
      <PolicyProvider
        access={access}
        subject={{ id: 's1', roles: ['editor'] }}
        context={{ now: new Date() }}
      >
        <Row id="s1" />
      </PolicyProvider>,
    );
    expect(screen.getByTestId('row-s1')).toHaveTextContent('editable');
  });
});

describe('useCanMany', () => {
  it('useCanMany returns a parallel decision array', () => {
    function List() {
      const decisions = useCanMany('comment', 'update', [
        { authorId: 's1' },
        { authorId: 'x' },
      ]);
      return (
        <div>
          {decisions.map((d, i) => (
            <span key={i}>{d.allowed ? 'y' : 'n'}</span>
          ))}
        </div>
      );
    }
    render(
      <PolicyProvider
        access={access}
        subject={{ id: 's1' }}
        context={{ now: new Date() }}
      >
        <List />
      </PolicyProvider>,
    );
    expect(screen.getByText('y')).toBeTruthy();
    expect(screen.getByText('n')).toBeTruthy();
  });
});

describe('useCapabilities', () => {
  it('useCapabilities returns every decision for the subject', () => {
    function Caps() {
      const caps = useCapabilities();
      return <div data-testid="caps">{Object.keys(caps).length}</div>;
    }
    render(
      <PolicyProvider
        access={access}
        subject={{ id: 's1', roles: ['editor'] }}
        context={{ now: new Date() }}
      >
        <Caps />
      </PolicyProvider>,
    );
    expect(screen.getByTestId('caps')).toHaveTextContent('2');
  });
});

describe('useCanFields', () => {
  it('useCanFields returns the field-level decision', () => {
    const withFields = hydratePolicy({
      permissions: [
        {
          key: 'comment.update',
          object: 'comment',
          action: 'update',
          rules: [
            {
              when: [
                { field: 'subject.roles', op: 'contains', value: 'editor' },
              ],
            },
          ],
          fields: { fields: ['*', '!status'] },
        },
      ],
    });
    function Form() {
      const fd = useCanFields('comment', 'update', { status: 'x' }, 'write');
      return <div data-testid="status">{fd.fields['status']}</div>;
    }
    render(
      <PolicyProvider
        access={withFields}
        subject={{ id: 's1', roles: ['editor'] }}
        context={{ now: new Date() }}
      >
        <Form />
      </PolicyProvider>,
    );
    expect(screen.getByTestId('status')).toHaveTextContent('denied');
  });
});

describe('useCan', () => {
  it('useCan throws outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Row id="s1" />)).toThrow(/PolicyProvider/);
    spy.mockRestore();
  });
});
