import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PolicySpecimen from './PolicySpecimen';

/**
 * What the specimen draws is what the policy answered.
 *
 * The section's claim is that one provider supplies a whole tree and a leaf
 * asks with three arguments, so the assertions are about the leaves: signing in
 * as someone else changes what they say, and nothing between the provider and
 * them carries a prop that could have done it instead.
 *
 * The badge text is the decision's own `reason` whenever the answer is no, so a
 * rule that started refusing for a different reason fails here rather than
 * quietly relabelling itself on the page.
 */

/** The badge on one control's box. */
function badgeFor(component: string): string {
  const head = screen.getByText(component).closest('p');
  if (!head) throw new Error(`no head for ${component}`);
  const badge = head.querySelector('.landing-policy__badge');
  if (!badge) throw new Error(`no badge for ${component}`);
  return badge.textContent ?? '';
}

function signInAs(role: string) {
  fireEvent.click(screen.getByRole('radio', { name: role }));
}

describe('the policy specimen', () => {
  it('opens on a customer who may review and nothing else', () => {
    render(<PolicySpecimen />);

    expect(badgeFor('ReviewControl')).toBe('allowed');
    expect(badgeFor('EditControl')).toBe('no-rule-matched');
    expect(badgeFor('PublishControl')).toBe('no-rule-matched');
  });

  /**
   * The provider's `subject` is the only thing that changed. Three boxes down,
   * a leaf that was handed no prop at all says something different.
   */
  it('grants the bookseller the edit without a prop changing', () => {
    render(<PolicySpecimen />);
    signInAs('Bookseller');

    expect(badgeFor('EditControl')).toBe('allowed');
    expect(badgeFor('PublishControl')).toBe('no-rule-matched');
  });

  it('grants the owner all three', () => {
    render(<PolicySpecimen />);
    signInAs('Owner');

    expect(badgeFor('ReviewControl')).toBe('allowed');
    expect(badgeFor('EditControl')).toBe('allowed');
    expect(badgeFor('PublishControl')).toBe('allowed');
  });

  /**
   * Publishing leaves the provider alone and changes the row the leaf asks
   * about. The shop's deny rule is the only one that reads the row, so one
   * badge moves and the other two hold.
   */
  it('closes the edit for everyone once the listing is published', () => {
    render(<PolicySpecimen />);
    signInAs('Owner');
    fireEvent.click(
      screen.getByRole('button', { name: 'Publish the listing' }),
    );

    expect(badgeFor('EditControl')).toBe('denied');
    expect(badgeFor('PublishControl')).toBe('allowed');
    expect(badgeFor('ReviewControl')).toBe('allowed');
  });

  it('names the provider with whoever is signed in', () => {
    render(<PolicySpecimen />);
    signInAs('Bookseller');

    const head = screen.getByText('PolicyProvider').closest('p');
    expect(within(head as HTMLElement).getByText(/Mika Persson/)).toBeTruthy();
  });
});
