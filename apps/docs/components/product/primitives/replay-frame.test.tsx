import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReplayFrame } from './ReplayFrame';

function motion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}
afterEach(() => vi.useRealTimers());

describe('ReplayFrame', () => {
  it('advances through its frames and starts over on Replay', () => {
    motion(false);
    vi.useFakeTimers();
    render(
      <ReplayFrame
        title="Client"
        frames={['old', 'new']}
        interval={800}
        replayLabel="Replay"
      />,
    );
    expect(screen.getByText('old')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByText('new')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(screen.getByText('old')).toBeInTheDocument();
  });

  it('shows the last frame without animating under reduced motion', () => {
    motion(true);
    render(
      <ReplayFrame
        title="Client"
        frames={['old', 'new']}
        interval={800}
        replayLabel="Replay"
      />,
    );
    expect(screen.getByText('new')).toBeInTheDocument();
  });
});
