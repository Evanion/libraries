import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UnevaluableDemo from './UnevaluableDemo';
import { ask, questionOf, refetch, seed, type Query } from './unevaluable';

/** The decision pane, as `term: value`. */
function pane(container: HTMLElement): Record<string, string> {
  const pairs = container.querySelector('.acl-demo__pairs')!;
  const terms = [...pairs.querySelectorAll('dt')].map((dt) => dt.textContent!);
  const values = [...pairs.querySelectorAll('dd')].map((dd) => dd.textContent!);
  return Object.fromEntries(terms.map((term, at) => [term, values[at]!]));
}

/** Ticks or unticks the checkbox saying the query selected a field. */
function select(field: string): void {
  fireEvent.click(screen.getByLabelText(field));
}

/** Sets the value a selected field holds. */
function hold(field: string, value: string): void {
  fireEvent.change(screen.getByLabelText(`the value ${field} holds`), {
    target: { value },
  });
}

function press(): void {
  fireEvent.click(screen.getByRole('button', { name: /refetch/i }));
}

/**
 * The demonstration reaches all four answers, and the repair is the package's.
 *
 * `unevaluable` is the page's hardest concept and the one a reader most easily
 * reads as a refusal, so the control has to show the same answer the engine
 * gives and the Refetch has to supply what `missing` actually named. Both are
 * held here against `access.can`, not against a script of expected screens.
 */
describe('the unevaluable demonstration', () => {
  it('opens unevaluable, naming both paths it could not read', () => {
    const { container } = render(<UnevaluableDemo />);

    expect(pane(container)['reason']).toBe('unevaluable');
    expect(pane(container)['allowed']).toBe('false');
    expect(pane(container)['missing']).toBe('object.status, object.askedBy');
  });

  it('reaches allow once both fields are selected', () => {
    const { container } = render(<UnevaluableDemo />);

    select('askedBy');
    select('status');

    expect(pane(container)['reason']).toBe('allow');
    expect(pane(container)['allowed']).toBe('true');
    expect(pane(container)['missing']).toBe('none');
  });

  it("reaches no-rule-matched on somebody else's question", () => {
    const { container } = render(<UnevaluableDemo />);

    select('askedBy');
    select('status');
    hold('askedBy', 's2');

    expect(pane(container)['reason']).toBe('no-rule-matched');
    expect(pane(container)['allowed']).toBe('false');
  });

  it('reaches denied on a locked question', () => {
    const { container } = render(<UnevaluableDemo />);

    select('askedBy');
    select('status');
    hold('status', 'locked');

    expect(pane(container)['reason']).toBe('denied');
  });

  it('returns to unevaluable when one field leaves the projection', () => {
    const { container } = render(<UnevaluableDemo />);

    select('askedBy');
    select('status');
    select('status');

    expect(pane(container)['reason']).toBe('unevaluable');
    expect(pane(container)['missing']).toBe('object.status');
  });

  /** The repair loop: fetch exactly what `missing` named, and ask again. */
  it('repairs an unevaluable decision with one Refetch', () => {
    const { container } = render(<UnevaluableDemo />);

    expect(pane(container)['reason']).toBe('unevaluable');
    press();

    expect(pane(container)['reason']).toBe('allow');
    expect(screen.getByRole('button', { name: /refetch/i })).toBeDisabled();
  });

  it('selects exactly the fields the decision named and no others', () => {
    const query: Query = { ...seed, selected: ['askedBy'] };
    const named = ask(query).missing ?? [];
    const repaired = refetch(query);

    expect(named).toEqual(['object.status']);
    expect([...repaired.selected].sort()).toEqual(['askedBy', 'status']);
    expect(Object.keys(questionOf(repaired)).sort()).toEqual([
      'askedBy',
      'status',
    ]);
  });

  it('leaves a decision that named nothing alone', () => {
    const query: Query = { ...seed, selected: ['askedBy', 'status'] };

    expect(ask(query).missing).toBeUndefined();
    expect(refetch(query)).toEqual(query);
  });

  it('renders the reason the package returned, in every selection', () => {
    for (const selected of [
      [],
      ['askedBy'],
      ['status'],
      ['askedBy', 'status'],
    ] as Query['selected'][]) {
      const query: Query = { ...seed, selected };
      const { container, unmount } = render(<UnevaluableDemo />);

      for (const field of selected) select(field);

      expect(pane(container)['reason']).toBe(ask(query).reason);
      unmount();
    }
  });

  it('announces the decision to a screen reader', () => {
    const { container } = render(<UnevaluableDemo />);
    const live = container.querySelector('[aria-live="polite"]')!;

    expect(live).toHaveTextContent('reason unevaluable');
    press();
    expect(live).toHaveTextContent('reason allow');
  });

  it('disables the value of a field the query did not select', () => {
    render(<UnevaluableDemo />);

    expect(screen.getByLabelText('the value status holds')).toBeDisabled();
    select('status');
    expect(screen.getByLabelText('the value status holds')).toBeEnabled();
  });
});
