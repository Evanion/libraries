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

describe('CascadeDemo document and focus', () => {
  it('shows the three definitions and lights the changed line after a switch', () => {
    const { container } = render(<CascadeDemo />);
    expect(container.querySelector('pre')).toHaveTextContent(
      "dependsOn: ['new-checkout']",
    );
    expect(
      container.querySelectorAll('.code-view__line[data-lit]'),
    ).toHaveLength(0);
    fireEvent.click(
      screen.getByRole('button', { name: /switch new checkout off/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /^switch off$/i }));
    const lit = container.querySelectorAll('.code-view__line[data-lit]');
    expect(lit).toHaveLength(1);
    expect(lit[0]).toHaveTextContent("key: 'new-checkout', enabled: false");
  });

  it('moves focus into the confirm step and back to the trigger on Cancel and Escape', () => {
    render(<CascadeDemo />);
    const trigger = screen.getByRole('button', {
      name: /switch new checkout off/i,
    });
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: /^switch off$/i })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
