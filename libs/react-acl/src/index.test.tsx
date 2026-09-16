import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createPolicy } from '@evanion/acl';

import {
  PolicyProvider,
  useCan,
  useCanFields,
  useCanMany,
  useCapabilities,
} from './index.js';

const access = createPolicy([
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
]);

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

describe('react-acl', () => {
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

  it('useCanFields returns the field-level decision', () => {
    const withFields = createPolicy([
      {
        key: 'comment.update',
        object: 'comment',
        action: 'update',
        rules: [
          {
            when: [{ field: 'subject.roles', op: 'contains', value: 'editor' }],
          },
        ],
        fields: { fields: ['*', '!status'] },
      },
    ]);
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

  it('takes a hydrated string instant for `now`', () => {
    const timed = createPolicy([
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
    ]);
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

  it('useCan throws outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Row id="s1" />)).toThrow(/PolicyProvider/);
    spy.mockRestore();
  });
});
