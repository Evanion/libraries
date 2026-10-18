import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NoFlickerDemo from './NoFlickerDemo';

function motion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}
afterEach(() => vi.useRealTimers());

describe('NoFlickerDemo', () => {
  it('labels the client-only side as a simulation and starts it on the old checkout', () => {
    motion(false);
    render(<NoFlickerDemo />);
    expect(
      screen.getByText(/decided in the browser after load/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/decided on the server, adopted by the browser/i),
    ).toBeInTheDocument();
    const [client, adopted] = screen.getAllByRole('figure');
    expect(client).toHaveTextContent(/old checkout/i);
    expect(adopted).toHaveTextContent(/new checkout/i);
  });
  it('under reduced motion shows both end states and a caption, without a Replay button', () => {
    motion(true);
    render(<NoFlickerDemo />);
    expect(screen.queryByRole('button', { name: /replay/i })).toBeNull();
    expect(screen.getByText(/swapped after load/i)).toBeInTheDocument();
    const [client] = screen.getAllByRole('figure');
    expect(client).toHaveTextContent(/old checkout/i);
    expect(client).toHaveTextContent(/new checkout/i);
  });
});
