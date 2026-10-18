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

describe('ScheduleDemo marks', () => {
  it('names the launch and the first minute it is on', () => {
    render(<ScheduleDemo />);
    expect(screen.getByText('Launch 09:00')).toBeInTheDocument();
    expect(screen.getByText('On from 09:01')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '180' } });
    expect(screen.getByTestId('checkout')).toHaveTextContent(/old checkout/i);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '181' } });
    expect(screen.getByTestId('checkout')).toHaveTextContent(/new checkout/i);
  });
});
