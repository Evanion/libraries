import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CascadeDemo from './CascadeDemo';

describe('CascadeDemo', () => {
  it('asks before switching off, and cancel changes nothing', () => {
    const { container } = render(<CascadeDemo />);
    fireEvent.click(
      screen.getByRole('button', { name: /switch new checkout off/i }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent(/Express pickup/);
    expect(screen.getByRole('dialog')).toHaveTextContent(/Demo-night booking/);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(container.querySelectorAll('li[data-on]')).toHaveLength(3);
  });
  it('switches the branch off on confirm', () => {
    const { container } = render(<CascadeDemo />);
    fireEvent.click(
      screen.getByRole('button', { name: /switch new checkout off/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /switch off/i }));
    expect(container.querySelectorAll('li[data-on]')).toHaveLength(0);
    expect(
      screen.getByText(/off because New checkout is off/),
    ).toBeInTheDocument();
  });
});
