import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createPolicy } from '@evanion/authorization';

import {
  PolicyProvider,
  useCan,
  useCanFields,
  useCanMany,
  useCapabilities,
} from './index';

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

function Row({ id }: { id: string }) {
  const can = useCan('comment', 'update', { authorId: id });
  return <div data-testid={`row-${id}`}>{can.allowed ? 'editable' : 'readonly'}</div>;
}

describe('react-authorization', () => {
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
            when: [
              { field: 'subject.roles', op: 'contains', value: 'editor' },
            ],
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

  it('useCan throws outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Row id="s1" />)).toThrow(/PolicyProvider/);
    spy.mockRestore();
  });
});
