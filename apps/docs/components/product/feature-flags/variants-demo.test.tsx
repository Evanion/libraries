import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
