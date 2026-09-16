import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AccessDemo from './AccessDemo';
import { buildAccess, openingGrants, people, source } from './access';

/** The labels on the interface's action bar, in order. */
function bar(container: HTMLElement): string[] {
  return [
    ...(container.querySelector('.landing-access__bar')?.children ?? []),
  ].map((control) => control.textContent ?? '');
}

/** The lines of policy the panel has lit. */
function lit(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-lit]')].map(
    (line) => line.textContent ?? '',
  );
}

/** Puts the demonstration in front of one of the three people. */
function signIn(role: string): void {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(role, 'i') }));
}

/**
 * The controls on the interface are the policy's answers.
 *
 * The site's rule is that every value in an example was produced by running the
 * package. Here the example is an interface, so it is driven the way a reader
 * drives it and what it renders is held against `access.can`.
 */
describe('the Authorization demonstration', () => {
  it('grants a viewer one control and an owner all three', () => {
    const { container } = render(<AccessDemo />);

    signIn('viewer');
    expect(bar(container)).toEqual(['Comment']);

    signIn('editor');
    expect(bar(container)).toEqual(['Comment', 'Edit']);

    signIn('owner');
    expect(bar(container)).toEqual(['Comment', 'Edit', 'Publish']);
  });

  it('renders exactly the controls the package allows', () => {
    const { container } = render(<AccessDemo />);
    const access = buildAccess(openingGrants);

    for (const person of Object.values(people)) {
      signIn(person.role);
      const allowed = ['comment', 'edit', 'publish'].filter(
        (action) =>
          access.can(person, 'post', action, { status: 'draft' }).allowed,
      );
      expect(bar(container)).toHaveLength(allowed.length);
    }
  });

  it('withdraws a control when its role leaves the grant', () => {
    const { container } = render(<AccessDemo />);

    signIn('editor');
    expect(bar(container)).toContain('Edit');

    const grant = screen.getAllByRole('button', { name: "'editor'" })[0]!;
    fireEvent.click(grant);

    expect(grant).toHaveAttribute('aria-pressed', 'false');
    expect(bar(container)).not.toContain('Edit');
  });

  /** A deny beats an allow: publishing takes Edit off everyone's bar. */
  it('takes editing away from a published post', () => {
    const { container } = render(<AccessDemo />);

    signIn('owner');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(bar(container)).toEqual(['Comment', 'Unpublish']);
    signIn('editor');
    expect(bar(container)).toEqual(['Comment']);
  });

  it('lights the deny rule when the deny is what withdrew the control', () => {
    const { container } = render(<AccessDemo />);

    signIn('owner');
    expect(lit(container).join('\n')).not.toContain('.deny(');

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(lit(container).join('\n')).toContain('.deny(');
  });

  it('lights one line per rule that answered, and no others', () => {
    const { container } = render(<AccessDemo />);

    signIn('viewer');
    expect(lit(container)).toHaveLength(1);
    expect(lit(container)[0]).toContain(".allow('comment'");

    signIn('owner');
    expect(lit(container)).toHaveLength(3);
  });

  it('lets an allowed control do what it says', () => {
    render(<AccessDemo />);

    signIn('viewer');
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Add a comment' }), {
      target: { value: 'Reads well.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    expect(screen.getByText('Reads well.')).toBeInTheDocument();
    expect(screen.getAllByText('Sam Reyes').length).toBeGreaterThan(0);
  });

  it('offers the role switch as one keyboard-reachable radio group', () => {
    render(<AccessDemo />);

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(3);
    expect(
      options.filter((option) => (option as HTMLInputElement).checked),
    ).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Mika Persson');
  });

  it('keeps every grant in the text a grant the builder reads', () => {
    const grants = source.flatMap((line) =>
      line.segments.filter((segment) => 'grant' in segment),
    );

    expect(
      grants.map((segment) => (segment as { grant: string }).grant),
    ).toEqual(Object.keys(openingGrants));
  });
});
