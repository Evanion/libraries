import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ruleId } from '@evanion/acl';
import FieldWriteDemo from './FieldWriteDemo';
import { decide, opening, pick, type Proposal } from './field-write';

/** The rows of the `fd.fields` pane, as `field: state / reason`. */
function fieldMap(container: HTMLElement): Record<string, string> {
  const rows = container.querySelectorAll('.acl-demo__table tbody tr');
  return Object.fromEntries(
    [...rows].map((row) => {
      const cells = [...row.children].map((cell) => cell.textContent ?? '');
      return [cells[0]!, `${cells[1]} / ${cells[2]}`];
    }),
  );
}

/** The `fd.action` pane, as `term: value`. */
function actionPane(container: HTMLElement): Record<string, string> {
  const pane = container.querySelector('.acl-demo__pairs')!;
  const terms = [...pane.querySelectorAll('dt')].map((dt) => dt.textContent!);
  const values = [...pane.querySelectorAll('dd')].map((dd) => dd.textContent!);
  return Object.fromEntries(terms.map((term, at) => [term, values[at]!]));
}

/** The third pane's text, which is either the object or the error. */
function output(container: HTMLElement): string {
  return container.querySelectorAll('.acl-demo__out')[0]?.textContent ?? '';
}

function signIn(name: string): void {
  fireEvent.click(screen.getByRole('radio', { name }));
}

/** The people, by the id a `Proposal` holds, so a patch names one. */
const named: Record<string, string> = {
  c1: 'Sam Reyes',
  c2: 'Jo Vainio',
  u1: 'Mika Persson',
};

/** Puts the rendered controls into the state a `Proposal` patch describes. */
function drive(patch: Partial<Proposal>): void {
  if (patch.who) signIn(named[patch.who]!);
  if (patch.pinned) fireEvent.click(screen.getByLabelText(/post pinned/i));
  if (patch.selectedStatus === false) {
    fireEvent.click(screen.getByLabelText(/did not select status/i));
  }
  if (patch.current) {
    fireEvent.change(screen.getByLabelText('status now'), {
      target: { value: patch.current },
    });
  }
  if (patch.status) {
    fireEvent.change(screen.getByLabelText('status'), {
      target: { value: patch.status },
    });
  }
}

/**
 * Every pane of the demonstration is a `canFields` call rendered.
 *
 * The site's rule is that a value in an example was produced by running the
 * package. The example here is a control, so it is driven the way a reader
 * drives it and each pane is held against the same call `field-write.ts` makes.
 * A demonstration that drifts from the engine teaches the wrong four states.
 */
describe('the field-write demonstration', () => {
  it('opens on the action allowed and the body writable', () => {
    const { container } = render(<FieldWriteDemo />);

    expect(actionPane(container)['allowed']).toBe('true');
    expect(actionPane(container)['reason']).toBe('allow');
    expect(fieldMap(container)['body']).toBe('allowed / allow');
    expect(output(container)).toContain('"body"');
  });

  it.each<[string, Partial<Proposal>]>([
    ['the opening state', {}],
    ['a person no rule grants', { who: 'c2' }],
    ['the bookseller', { who: 'u1' }],
    ['a posted key no rule names', { pinned: true }],
    ['a terminal row', { current: 'locked' }],
    ['a write that goes nowhere', { status: 'open' }],
    ['a row fetched without status', { selectedStatus: false }],
  ])('renders what the package returned for %s', (_name, patch) => {
    const proposal = { ...opening, ...patch };
    const { container } = render(<FieldWriteDemo />);

    drive(patch);

    const decision = decide(proposal);
    expect(actionPane(container)['allowed']).toBe(
      String(decision.action.allowed),
    );
    expect(actionPane(container)['reason']).toBe(decision.action.reason);
    expect(fieldMap(container)).toEqual(
      Object.fromEntries(
        Object.keys(decision.fields)
          .sort()
          .map((field) => [
            field,
            `${decision.fields[field]} / ${decision.reasons[field]}`,
          ]),
      ),
    );

    const picked = pick(proposal);
    expect(output(container)).toContain(
      picked.kind === 'object'
        ? JSON.stringify(picked.value, null, 2)
        : picked.name,
    );
  });

  /** The action is refused and every field still carries a state. */
  it('fills the field map for a person the action refuses', () => {
    const { container } = render(<FieldWriteDemo />);

    signIn('Jo Vainio');

    expect(actionPane(container)['allowed']).toBe('false');
    expect(actionPane(container)['reason']).toBe('no-rule-matched');
    expect(fieldMap(container)['body']).toBe('allowed / allow');
    expect(output(container)).toContain('ActionNotAllowedError');
  });

  it('grants the bookseller the action through the second rule', () => {
    const { container } = render(<FieldWriteDemo />);

    signIn('Mika Persson');

    expect(actionPane(container)['allowed']).toBe('true');
    expect(actionPane(container)['rule']).toBe(
      ruleId(
        {
          when: [
            { field: 'subject.roles', op: 'contains', value: 'bookseller' },
          ],
        },
        'allow',
      ),
    );
  });

  /** The mass-assignment case: a key the rules never name. */
  it('decides a posted pinned not-listed and drops it from the write', () => {
    const { container } = render(<FieldWriteDemo />);

    expect(fieldMap(container)['pinned']).toBeUndefined();

    fireEvent.click(screen.getByLabelText(/post pinned/i));

    expect(fieldMap(container)['pinned']).toBe('denied / not-listed');
    expect(output(container)).not.toContain('pinned');
  });

  /** The terminal state: locked names an empty array of edges. */
  it('refuses every write out of a locked row', () => {
    const { container } = render(<FieldWriteDemo />);

    fireEvent.change(screen.getByLabelText('status now'), {
      target: { value: 'locked' },
    });

    expect(fieldMap(container)['status']).toBe('denied / transition-failed');
    expect(output(container)).not.toContain('"status"');
  });

  /** The state the page has nowhere else: a row that arrived without status. */
  it('decides status missing-field when the query did not select it', () => {
    const { container } = render(<FieldWriteDemo />);

    fireEvent.click(screen.getByLabelText(/did not select status/i));

    expect(fieldMap(container)['status']).toBe('unevaluable / missing-field');
    expect(actionPane(container)['allowed']).toBe('true');
    expect(output(container)).not.toContain('"status"');
    expect(output(container)).toContain('"body"');
  });

  it('shows the same fields the package decided, and no others', () => {
    const { container } = render(<FieldWriteDemo />);

    fireEvent.click(screen.getByLabelText(/post pinned/i));

    expect(Object.keys(fieldMap(container)).sort()).toEqual(
      Object.keys(decide({ ...opening, pinned: true }).fields).sort(),
    );
  });

  it('offers the signed-in switch as one keyboard-reachable radio group', () => {
    const { container } = render(<FieldWriteDemo />);

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(3);
    expect(
      options.filter((option) => (option as HTMLInputElement).checked),
    ).toHaveLength(1);
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
      'Sam Reyes',
    );
  });

  it('announces the decision to a screen reader', () => {
    const { container } = render(<FieldWriteDemo />);
    const live = container.querySelector('[aria-live="polite"]')!;

    fireEvent.click(screen.getByLabelText(/did not select status/i));

    expect(live).toHaveTextContent('status unevaluable, missing-field');
  });
});
