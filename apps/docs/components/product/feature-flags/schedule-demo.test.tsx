import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScheduleDemo from './ScheduleDemo';

describe('ScheduleDemo', () => {
  it('opens before launch with the old checkout and switches when scrubbed past it', () => {
    render(<ScheduleDemo />);
    expect(screen.getByTestId('checkout')).toHaveTextContent(/old checkout/i);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '240' } });
    expect(screen.getByTestId('checkout')).toHaveTextContent(/new checkout/i);
  });
});
