import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COPIED_FOR_MS, enableCopy } from './client.js';

const markup = `
  <div class="copy-value">
    <code>v1.abc</code>
    <button type="button" data-copy="v1.abc" data-copied-label="Copied">
      <span class="copy-label">Copy</span>
    </button>
    <span role="status" data-copy-status=""></span>
  </div>`;

describe('enableCopy', () => {
  let writeText: ReturnType<typeof vi.fn>;
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    document.body.innerHTML = markup;
    stop = enableCopy();
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  const button = () => document.querySelector('button') as HTMLButtonElement;
  const status = () => document.querySelector('[data-copy-status]');

  it('copies the value, marks the button and announces it, then resets', async () => {
    (button().querySelector('span') as HTMLElement).click();

    await vi.waitFor(() => expect(button()).toHaveAttribute('data-copied'));
    expect(writeText).toHaveBeenCalledWith('v1.abc');
    expect(status()).toHaveTextContent('Copied');

    vi.advanceTimersByTime(COPIED_FOR_MS);

    expect(button()).not.toHaveAttribute('data-copied');
    expect(status()).toHaveTextContent('');
  });

  it('copies a button added after it started', async () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<button type="button" data-copy="late">Copy</button>',
    );
    (document.querySelectorAll('button')[1] as HTMLButtonElement).click();

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('late'));
  });

  it('leaves the button alone when the clipboard refuses', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    button().click();

    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    await Promise.resolve();
    expect(button()).not.toHaveAttribute('data-copied');
    expect(status()).toHaveTextContent('');
  });

  it('stops listening once stopped', () => {
    stop();
    button().click();

    expect(writeText).not.toHaveBeenCalled();
  });
});
