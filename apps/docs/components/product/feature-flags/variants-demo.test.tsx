import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { assign, moved } from './variants';
import VariantsDemo from './VariantsDemo';

describe('VariantsDemo', () => {
  it('reports how many visitors moved when the split changes', () => {
    render(<VariantsDemo />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '70' } });
    expect(screen.getByTestId('moved')).toHaveTextContent(
      /\d+ of 24 visitors switched/,
    );
  });
  it('marks the three booksellers when they are pinned', () => {
    const { container } = render(<VariantsDemo />);
    fireEvent.click(screen.getByRole('checkbox', { name: /booksellers/i }));
    expect(container.querySelectorAll('[data-mark="pinned"]')).toHaveLength(3);
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
      `${pinOnly} of 24 visitors switched`,
    );
  });

  it('labels switched and pinned dots in words and announces the count politely', () => {
    const { container } = render(<VariantsDemo />);
    expect(screen.getByTestId('moved')).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByRole('checkbox', { name: /booksellers/i }));
    expect(container.querySelector('[aria-label*="pinned"]')).not.toBeNull();
  });
});
