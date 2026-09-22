import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import MatrixExplorer from './MatrixExplorer';
import {
  adopt,
  conditionText,
  declared,
  decide,
  readSubject,
  sample,
  sampleText,
} from './matrix-explorer';

/** The box the reader pastes a document into. */
function box(): HTMLTextAreaElement {
  return screen.getByLabelText('The matrix document, as JSON');
}

function paste(text: string): void {
  fireEvent.change(box(), { target: { value: text } });
}

/** The sample, adopted, with the narrowing a test can assert against. */
function adopted() {
  const adoption = adopt(sampleText);
  if (adoption.state !== 'ready') {
    throw new Error(`the sample did not adopt: ${adoption.state}`);
  }
  return adoption.access;
}

/** One row of the decision table, as `column: value`. */
function row(container: HTMLElement, key: string): Record<string, string> {
  const head = [...container.querySelectorAll('thead th')].map(
    (cell) => cell.textContent!,
  );
  const found = [...container.querySelectorAll('tbody tr')].find(
    (tr) => tr.querySelector('th')?.textContent === key,
  );

  const cells = [
    found!.querySelector('th')!.textContent!,
    ...[...found!.querySelectorAll('td')].map((cell) => cell.textContent!),
  ];

  return Object.fromEntries(head.map((column, at) => [column, cells[at]!]));
}

/**
 * The explorer reports the document, and the package decides it.
 *
 * Two halves, and the split is what the assertions are about. `adopt`,
 * `declared` and `decide` are held against `@evanion/acl` directly, so a
 * change to what the engine answers breaks the test rather than the screen.
 * The rendering half is held against the empty state, the two refusals and the
 * decision table, which are the four things a reader can land on.
 */
describe('the matrix explorer', () => {
  it('opens with an instruction and the sample document in the markup', () => {
    const { container } = render(<MatrixExplorer />);

    expect(screen.getByText('Start with this one')).toBeInTheDocument();
    expect(
      container.querySelector('.matrix-explorer__sample'),
    ).toHaveTextContent('"version": "shop@12"');
    expect(box()).toHaveValue('');
  });

  it('adopts the sample when the button is pressed', () => {
    render(<MatrixExplorer />);

    fireEvent.click(
      screen.getByRole('button', { name: /load the sample document/i }),
    );

    expect(box()).toHaveValue(sampleText);
    expect(screen.getByText('What it declares')).toBeInTheDocument();
  });

  it('reports the version, the budget and the public count', () => {
    const report = declared(adopted());

    expect(report.version).toBe('shop@12');
    expect(report.maxStale).toBe('900000 ms, 15 minutes');
    expect(report.publishedCount).toBe(2);
    expect(report.kinds.map((kind) => kind.kind)).toEqual(['listing', 'order']);
  });

  it('marks the permission the package says needs the row', () => {
    const report = declared(adopted());
    const needs = report.permissions
      .filter((permission) => permission.readsObject)
      .map((permission) => permission.key);

    expect(needs).toEqual(['listing.update']);
  });

  it('decides every permission against the subject in the box', () => {
    const { container } = render(<MatrixExplorer />);

    fireEvent.click(
      screen.getByRole('button', { name: /load the sample document/i }),
    );

    expect(row(container, 'listing.read')['reason']).toBe('allow');
    expect(row(container, 'order.refund')['reason']).toBe('no-rule-matched');
    expect(row(container, 'listing.update')['reason']).toBe('unevaluable');
    expect(row(container, 'listing.update')['missing']).toBe(
      'object.status, object.sellerId',
    );
  });

  it('moves the decisions when the subject changes', () => {
    const { container } = render(<MatrixExplorer />);

    fireEvent.click(
      screen.getByRole('button', { name: /load the sample document/i }),
    );
    fireEvent.change(screen.getByLabelText('The subject, as JSON'), {
      target: { value: '{"id":"u_31","roles":["support"]}' },
    });

    expect(row(container, 'order.refund')['reason']).toBe('allow');
    expect(row(container, 'order.refund')['allowed']).toBe('true');
  });

  it('renders the reason the package returned, for every permission', () => {
    const { container } = render(<MatrixExplorer />);

    fireEvent.click(
      screen.getByRole('button', { name: /load the sample document/i }),
    );

    for (const decision of decide(adopted(), {
      id: 'u_31',
      roles: ['seller'],
    })) {
      expect(row(container, decision.key)['reason']).toBe(decision.reason);
    }
  });

  it('separates text that is not JSON from a document the package refused', () => {
    render(<MatrixExplorer />);

    paste('{');
    expect(screen.getByText('That text is not JSON yet')).toBeInTheDocument();

    paste('{"permissions":"nope"}');
    expect(screen.getByText('InvalidMatrixError')).toBeInTheDocument();
  });

  it('locates a refused value by key, field and where', () => {
    const broken = {
      ...sample,
      permissions: [
        {
          ...sample.permissions[1]!,
          rules: [
            {
              id: 'seller',
              when: [
                { field: 'object.seller_id', op: 'eq', path: 'subject.id' },
              ],
            },
          ],
        },
      ],
    };

    const adoption = adopt(JSON.stringify(broken));

    expect(adoption).toMatchObject({
      state: 'refused',
      name: 'UnknownFieldError',
      configFault: true,
      at: {
        key: 'listing.update',
        field: 'object.seller_id',
        where: 'rules[0].when[0]',
      },
    });
  });

  it('shows the located values on the screen', () => {
    render(<MatrixExplorer />);

    paste(
      JSON.stringify({
        permissions: [
          {
            key: 'listing.read',
            object: 'listing',
            action: 'read',
            rules: [
              { when: [{ field: 'subject.id', op: 'equals', value: 'x' }] },
            ],
          },
        ],
      }),
    );

    expect(screen.getByText('InvalidConditionError')).toBeInTheDocument();
    expect(screen.getByText('rules[0].when[0]')).toBeInTheDocument();
  });

  it('refuses a subject that is not an object, and keeps the document', () => {
    render(<MatrixExplorer />);

    fireEvent.click(
      screen.getByRole('button', { name: /load the sample document/i }),
    );
    fireEvent.change(screen.getByLabelText('The subject, as JSON'), {
      target: { value: '[1,2]' },
    });

    expect(screen.getByText(/a subject is a json object/i)).toBeInTheDocument();
    expect(screen.getByText('What it declares')).toBeInTheDocument();
  });

  it('announces what reading the box produced', () => {
    const { container } = render(<MatrixExplorer />);
    const live = container.querySelector('[aria-live="polite"]')!;

    expect(live).toHaveTextContent('No document yet.');
    fireEvent.click(
      screen.getByRole('button', { name: /load the sample document/i }),
    );
    expect(live).toHaveTextContent('3 permissions');
  });

  it('reads a subject the same way it reads a document', () => {
    expect(readSubject('{"id":"u_31"}')).toEqual({
      state: 'ready',
      subject: { id: 'u_31' },
    });
    expect(readSubject('3')).toEqual({ state: 'not-an-object' });
    expect(readSubject('{').state).toBe('unparsed');
  });

  it('writes a condition as one line, on either operand', () => {
    expect(
      conditionText({ field: 'object.sellerId', op: 'eq', path: 'subject.id' }),
    ).toBe('object.sellerId eq subject.id');
    expect(
      conditionText({ field: 'subject.roles', op: 'contains', value: 'staff' }),
    ).toBe('subject.roles contains "staff"');
    expect(
      conditionText({ field: 'now', op: 'before', value: '2026-01-01' }),
    ).toBe('now before "2026-01-01"');
  });
});
