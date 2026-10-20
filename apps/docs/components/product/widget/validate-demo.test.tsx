import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ValidateDemo from './ValidateDemo';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const problems = () => screen.getByRole('region', { name: 'Problems' });
const drawn = () =>
  screen.getByRole('region', { name: 'The page without the check' });

describe('ValidateDemo', () => {
  it('starts with a page that passes and draws every block', () => {
    render(<ValidateDemo />);
    expect(screen.getByText(/No problems/)).toBeInTheDocument();
    expect(drawn()).toHaveTextContent('On the table tonight');
    expect(drawn()).toHaveTextContent('Wingspan');
  });

  it('names the block whose type was renamed, and the page loses it', () => {
    render(<ValidateDemo />);
    fireEvent.click(screen.getByLabelText('Rename the shelf block type'));
    expect(problems()).toHaveTextContent('tonight');
    expect(problems()).toHaveTextContent('unknown widget type');
    expect(problems()).toHaveTextContent('1 problem.');
    expect(drawn()).not.toHaveTextContent('On the table tonight');
    expect(drawn()).toHaveTextContent('Brass: Birmingham');
    expect(drawn()).toHaveTextContent('Hive');
  });

  it('lists each fault independently and clears it again', () => {
    const { container } = render(<ValidateDemo />);
    for (const label of [
      'Rename the shelf block type',
      'Blank a listing title',
      'Give two blocks the same id',
    ])
      fireEvent.click(screen.getByLabelText(label));
    expect(problems()).toHaveTextContent('3 problems');
    expect(container.querySelectorAll('[data-lit]').length).toBe(3);
    fireEvent.click(screen.getByLabelText('Give two blocks the same id'));
    expect(problems()).toHaveTextContent('2 problems');
  });
});
