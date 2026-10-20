/** @jsxRuntime classic */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Blocks } from './rendered';
import { page } from './validate';

const html = (faults: Parameters<typeof page>[0]) =>
  renderToStaticMarkup(<Blocks items={page(faults)} />);

describe('the page drawn by the real React renderer', () => {
  it('draws every block of the page as saved', () => {
    const out = html([]);
    expect(out).toContain('Brass: Birmingham');
    expect(out).toContain('On the table tonight');
    expect(out).toContain('Wingspan');
    expect(out).toContain('Hive');
  });

  it('omits the block with a renamed type and keeps the others', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const out = html(['rename']);
    expect(out).not.toContain('On the table tonight');
    expect(out).toContain('Brass: Birmingham');
    expect(out).toContain('Hive');
    warn.mockRestore();
  });

  it('draws a blank title as an empty heading', () => {
    expect(html(['blank'])).toContain('<h3></h3>');
  });
});
