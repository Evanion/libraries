import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ValidateDemo from './ValidateDemo';

describe('ValidateDemo', () => {
  it('starts with a page that can ship', () => {
    render(<ValidateDemo />);
    expect(screen.getByText(/No problems/)).toBeInTheDocument();
  });

  it('names the item whose type was renamed, and stops the build', () => {
    render(<ValidateDemo />);
    fireEvent.click(screen.getByLabelText('Rename the shelf type'));
    const region = screen.getByRole('region', { name: 'Problems' });
    expect(region).toHaveTextContent('tonight');
    expect(region).toHaveTextContent('unknown widget type');
    expect(region).toHaveTextContent('1 problem. The build stops.');
  });

  it('lists each fault and clears it again', () => {
    const { container } = render(<ValidateDemo />);
    for (const label of [
      'Rename the shelf type',
      'Blank a listing title',
      'Reuse an id',
    ])
      fireEvent.click(screen.getByLabelText(label));
    expect(screen.getByRole('region', { name: 'Problems' })).toHaveTextContent(
      '3 problems',
    );
    expect(container.querySelectorAll('[data-lit]').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Reuse an id'));
    expect(screen.getByRole('region', { name: 'Problems' })).toHaveTextContent(
      '2 problems',
    );
  });
});
