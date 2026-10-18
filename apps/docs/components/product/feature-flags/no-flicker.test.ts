import { describe, expect, it } from 'vitest';
import { finalPaint, firstPaint, serverSet } from './no-flicker';

describe('the no-flicker scene', () => {
  it('the server decides the new checkout for this visitor', () => {
    expect(serverSet().decisions['new-checkout'].enabled).toBe(true);
    expect(finalPaint()).toBe('new');
  });
  it('adopting the server set makes the first paint equal the final one', () => {
    expect(firstPaint('adopted')).toBe(finalPaint());
  });
  it('a client-only setup paints the old checkout first', () => {
    expect(firstPaint('client-only')).toBe('old');
  });
});
