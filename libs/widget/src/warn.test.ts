import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetWarnings, warnOnce } from './warn.js';
import { ERROR_MESSAGES } from './constants.js';

describe('warnOnce', () => {
  beforeEach(resetWarnings);
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reports one message once, however often it is raised', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const message = ERROR_MESSAGES.UNKNOWN_WIDGET('gone', 'stale');

    warnOnce(message);
    warnOnce(message);
    warnOnce(message);

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reports a second item separately, because the id is in the message', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    warnOnce(ERROR_MESSAGES.UNKNOWN_WIDGET('gone', 'one'));
    warnOnce(ERROR_MESSAGES.UNKNOWN_WIDGET('gone', 'two'));

    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('logs nothing when NODE_ENV is production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('NODE_ENV', 'production');

    warnOnce(ERROR_MESSAGES.MALFORMED_ITEMS);

    expect(warn).not.toHaveBeenCalled();
  });
});
