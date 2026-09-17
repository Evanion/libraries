import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ComposeSpecimen from './ComposeSpecimen';

/**
 * What the card shows is what `ComposeProvider` built.
 *
 * The claim `compose/getting-started.mdx` makes over this card is that the
 * array is the tree: the first entry is the outermost box, and moving an entry
 * moves its box. The card renders the published component, so the assertions
 * below are about the package as much as about the card -- a release that
 * stopped nesting in array order would fail here.
 */
describe('the compose card', () => {
  /** The provider names, outermost first, as the rendered boxes give them. */
  function nesting(container: HTMLElement): string[] {
    return [...container.querySelectorAll('.landing-compose__name')].map(
      (name) => name.firstChild?.textContent ?? '',
    );
  }

  it('opens on the array in the order the listing writes it', () => {
    const { container } = render(<ComposeSpecimen />);

    expect(nesting(container)).toEqual([
      'CartProvider',
      'ThemeProvider',
      'CurrencyProvider',
    ]);
  });

  /**
   * Nesting, not order alone: a flat run of three boxes would pass a check on
   * the names and would be the wrong picture entirely.
   */
  it('puts each provider inside the one before it', () => {
    const { container } = render(<ComposeSpecimen />);
    const outer = container.querySelector('.landing-compose__layer');

    expect(outer?.querySelectorAll('.landing-compose__layer')).toHaveLength(2);
    expect(outer?.querySelector('.landing-compose__page')).toHaveTextContent(
      'Brass: Birmingham',
    );
  });

  it('moves the box when the reader moves the entry', () => {
    const { container } = render(<ComposeSpecimen />);

    fireEvent.click(screen.getByLabelText('Move ThemeProvider outward'));

    expect(nesting(container)).toEqual([
      'ThemeProvider',
      'CartProvider',
      'CurrencyProvider',
    ]);
  });

  /**
   * The entry already at an end has nowhere to go, and the control that would
   * move it stays focusable while saying so: a real `disabled` would take the
   * focus ring off the page in the middle of a keyboard reader's gesture.
   */
  it('dims the control that would move an entry off the end', () => {
    render(<ComposeSpecimen />);

    expect(screen.getByLabelText('Move CartProvider outward')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(
      screen.getByLabelText('Move CurrencyProvider inward'),
    ).toHaveAttribute('aria-disabled', 'true');
  });
});
