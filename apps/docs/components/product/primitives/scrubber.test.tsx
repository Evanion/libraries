import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Scrubber } from './Scrubber';

describe('Scrubber', () => {
  it('shows the formatted value and reports changes', () => {
    const onChange = vi.fn();
    render(
      <Scrubber
        label="Time"
        min={0}
        max={10}
        step={1}
        value={3}
        format={(v) => `${v}:00`}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('3:00')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Time' }), {
      target: { value: '7' },
    });
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('prints its marks beside the slider', () => {
    render(
      <Scrubber
        label="Time"
        min={0}
        max={10}
        step={1}
        value={3}
        format={(v) => `${v}`}
        marks={[
          { value: 4, label: 'Launch 09:00' },
          { value: 5, label: 'On from 09:01' },
        ]}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByText('Launch 09:00')).toBeInTheDocument();
    expect(screen.getByText('On from 09:01')).toBeInTheDocument();
  });
});
