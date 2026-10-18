import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VisitorCrowd } from './VisitorCrowd';

const members = Array.from({ length: 4 }, (_, i) => ({
  id: `cust-000${i}`,
  lit: i % 2 === 0,
  label: `cust-000${i}: ${i % 2 === 0 ? 'on' : 'off'}`,
}));

describe('VisitorCrowd', () => {
  it('renders a focusable dot per member with its label, legend and count', () => {
    const { container } = render(
      <VisitorCrowd
        members={members}
        legend="Each dot is a visitor."
        count="2 of 4"
      />,
    );
    const dots = screen.getAllByRole('img');
    expect(dots).toHaveLength(4);
    expect(dots[0]).toHaveAttribute('aria-label', 'cust-0000: on');
    expect(dots[0]).toHaveAttribute('data-lit');
    expect(dots[1]).not.toHaveAttribute('data-lit');
    expect(dots[0]).toHaveAttribute('tabindex', '0');
    expect(container).toHaveTextContent('Each dot is a visitor.');
    expect(container).toHaveTextContent('2 of 4');
  });

  it('reports the focused member and dims on request', () => {
    const onFocusMember = vi.fn();
    const { container } = render(
      <VisitorCrowd
        members={members}
        legend=""
        count=""
        dimmed
        onFocusMember={onFocusMember}
      />,
    );
    fireEvent.focus(screen.getAllByRole('img')[1]);
    expect(onFocusMember).toHaveBeenCalledWith('cust-0001');
    expect(container.querySelector('.visitor-crowd')).toHaveAttribute(
      'data-dimmed',
    );
  });
});
