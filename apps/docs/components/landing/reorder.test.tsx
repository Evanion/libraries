import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ComposeSpecimen from './ComposeSpecimen';
import DataDemo from './DataDemo';
import { dragStep } from './reorder';

describe('dragStep', () => {
  const above = { top: 0, bottom: 20 };
  const below = { top: 40, bottom: 60 };

  it('asks for nothing while the pointer is between the neighbours’ middles', () => {
    expect(dragStep(30, above, below)).toBe(0);
  });

  it('steps up past the middle of the block above', () => {
    expect(dragStep(9, above, below)).toBe(-1);
  });

  it('steps down past the middle of the block below', () => {
    expect(dragStep(51, above, below)).toBe(1);
  });

  it('never steps toward an end with no neighbour', () => {
    expect(dragStep(-100, undefined, below)).toBe(0);
    expect(dragStep(500, above, undefined)).toBe(0);
  });
});

/** The provider names in the listing, top first. */
function listing(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.landing-items__line')].map(
    (line) =>
      line.querySelector('.landing-items__token--key')?.textContent ?? '',
  );
}

describe('the touch controls', () => {
  it('selects an item on a tap and moves it with the bar', () => {
    const { container } = render(<ComposeSpecimen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Move CurrencyProvider' }),
    );
    const bar = screen.getByRole('group', { name: 'Move CurrencyProvider' });
    fireEvent.click(
      within(bar).getByLabelText('Move CurrencyProvider outward'),
    );

    expect(listing(container)).toEqual([
      'CartProvider',
      'CurrencyProvider',
      'ThemeProvider',
    ]);
    // The selection follows the item, so the next press moves it again.
    fireEvent.click(
      within(bar).getByLabelText('Move CurrencyProvider outward'),
    );
    expect(listing(container)[0]).toBe('CurrencyProvider');
    expect(
      within(bar).getByLabelText('Move CurrencyProvider outward'),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('closes the bar on Done and on a second tap', () => {
    render(<ComposeSpecimen />);
    const grip = screen.getByRole('button', { name: 'Move ThemeProvider' });

    fireEvent.click(grip);
    expect(grip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('group')).toBeNull();

    fireEvent.click(grip);
    fireEvent.click(grip);
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('moves a nested item within its own list on the frontpage', () => {
    render(<DataDemo />);

    fireEvent.click(screen.getByRole('button', { name: 'Move Sold' }));
    const bar = screen.getByRole('group', { name: 'Move Sold' });
    fireEvent.click(within(bar).getByLabelText('Move Sold up'));

    expect(screen.getByRole('status')).toHaveTextContent('Sold moved up.');
  });

  /**
   * jsdom lays nothing out, so each line reports a 20px row by its place in
   * the listing; the drag reads those rows the way a browser's would.
   */
  it('reorders as a drag passes the middle of the next line', () => {
    const { container } = render(<ComposeSpecimen />);
    const source = container.querySelector('pre')!;
    const rows = () => [...source.querySelectorAll<HTMLElement>('[data-path]')];
    for (const line of rows()) {
      line.getBoundingClientRect = () => {
        const at = rows().indexOf(line);
        return { top: at * 20, bottom: at * 20 + 20 } as DOMRect;
      };
    }

    const grip = screen.getByRole('button', { name: 'Move CartProvider' });
    fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientY: 10 });
    fireEvent.pointerMove(source, { pointerId: 1, clientY: 14 });
    expect(listing(container)[0]).toBe('CartProvider');

    fireEvent.pointerMove(source, { pointerId: 1, clientY: 31 });
    expect(listing(container)).toEqual([
      'ThemeProvider',
      'CartProvider',
      'CurrencyProvider',
    ]);

    fireEvent.pointerMove(source, { pointerId: 1, clientY: 51 });
    fireEvent.pointerUp(source, { pointerId: 1, clientY: 51 });
    expect(listing(container)[2]).toBe('CartProvider');
  });
});
