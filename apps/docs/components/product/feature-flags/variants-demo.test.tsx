import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CROWD_SIZE } from '../primitives/crowd';
import { assign, booksellerCount, moved } from './variants';
import VariantsDemo from './VariantsDemo';

describe('VariantsDemo', () => {
  it('reports how many visitors moved when the split changes', () => {
    render(<VariantsDemo />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '70' } });
    expect(screen.getByTestId('moved')).toHaveTextContent(
      new RegExp(
        `\\d+ of ${CROWD_SIZE} see the blue button · \\d+ changed with your last move`,
      ),
    );
  });
  it('marks every bookseller when they are pinned', () => {
    const { container } = render(<VariantsDemo />);
    fireEvent.click(screen.getByRole('checkbox', { name: /booksellers/i }));
    expect(container.querySelectorAll('[data-mark="pinned"]')).toHaveLength(
      booksellerCount,
    );
  });
});

describe('VariantsDemo count', () => {
  it('measures only the last change: the pin, not the slider move before it', () => {
    render(<VariantsDemo />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '55' } });
    const accumulated = moved(assign(50, false), assign(55, true)).length;
    const pinOnly = moved(assign(55, false), assign(55, true)).length;
    expect(pinOnly).not.toBe(accumulated);
    fireEvent.click(screen.getByRole('checkbox', { name: /booksellers/i }));
    expect(screen.getByTestId('moved')).toHaveTextContent(
      `${pinOnly} changed with your last move`,
    );
  });

  it('leads with how many see blue, equal to the filled dots, at every state', () => {
    const { container } = render(<VariantsDemo />);
    const check = (text: string) => {
      const lit = container.querySelectorAll(
        '.visitor-crowd__dot[data-lit]',
      ).length;
      expect(screen.getByTestId('moved')).toHaveTextContent(
        `${lit} of ${CROWD_SIZE} see the blue button · ${text}`,
      );
    };
    expect(
      container.querySelectorAll('.visitor-crowd__dot[data-lit]').length,
    ).toBeGreaterThan(0);
    check('Move the split to see who changes');
    fireEvent.change(screen.getByRole('slider'), { target: { value: '55' } });
    check(
      `${moved(assign(50, false), assign(55, false)).length} changed with your last move`,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /booksellers/i }));
    check(
      `${moved(assign(55, false), assign(55, true)).length} changed with your last move`,
    );
  });

  it('labels switched and pinned dots in words and announces the count politely', () => {
    const { container } = render(<VariantsDemo />);
    expect(screen.getByTestId('moved')).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByRole('checkbox', { name: /booksellers/i }));
    expect(container.querySelector('[aria-label*="pinned"]')).not.toBeNull();
  });
});

describe('VariantsDemo readout', () => {
  it('reads the focused dot in the line under the crowd', () => {
    render(<VariantsDemo />);
    expect(screen.getByTestId('readout')).toHaveTextContent(
      /tap or hover a dot/i,
    );
    fireEvent.focus(screen.getAllByRole('img')[3]!);
    expect(screen.getByTestId('readout')).toHaveTextContent(/cust-0004/);
  });
});
