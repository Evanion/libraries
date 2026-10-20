import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DiffDemo from './DiffDemo';

describe('DiffDemo', () => {
  it('opens on a gain and says who gained', () => {
    render(<DiffDemo />);
    expect(
      screen.getByText(/can now reprice listings that they sell/),
    ).toBeInTheDocument();
  });

  it('says who lost access to a lock', () => {
    render(<DiffDemo />);
    fireEvent.click(screen.getByLabelText(/Lock published listings/));
    expect(screen.getByText('Nobody').tagName).toBe('STRONG');
    expect(
      screen.getByText(/can edit listings that are published any more/),
    ).toBeInTheDocument();
  });

  it('reports nothing for a reorder', () => {
    render(<DiffDemo />);
    fireEvent.click(screen.getByLabelText(/Reorder the edit rules/));
    expect(screen.getByText('Nothing changes for anyone')).toBeInTheDocument();
  });
});
