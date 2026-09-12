import { describe, expect, it } from 'vitest';
import { OrderURN } from './order.urn.js';

describe('OrderURN', () => {
  it('stringifies an id under the order namespace', () => {
    expect(OrderURN.stringify('8f2c1a')).toBe('urn:order:8f2c1a');
  });

  it('parses the id back out under its own namespace', () => {
    expect(OrderURN.parse('urn:order:8f2c1a').nss).toBe('8f2c1a');
  });
});
