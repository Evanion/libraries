import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NoFlickerDemo from './NoFlickerDemo';

function motion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}
afterEach(() => vi.restoreAllMocks());

describe('NoFlickerDemo hydration', () => {
  it('hydrates the server markup under reduced motion without a mismatch', async () => {
    motion(false);
    const html = renderToString(<NoFlickerDemo />);
    motion(true);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => {
      errors.push(a);
    });
    await act(async () => {
      hydrateRoot(container, <NoFlickerDemo />, {
        onRecoverableError: (e) => errors.push(e),
      });
    });
    spy.mockRestore();
    expect(errors).toEqual([]);
    expect(container).toHaveTextContent(/swapped after load/i);
    expect(container.querySelector('button')).toBeNull();
    container.remove();
  });
});
