import { describe, expect, it, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const appRoot = join(import.meta.dirname, '..');
const html = () => readFileSync(join(appRoot, 'dist', 'index.html'), 'utf8');

describe('demo output', () => {
  beforeAll(() => {
    if (!existsSync(join(appRoot, 'dist', 'index.html'))) {
      execFileSync('npx', ['astro', 'build'], { cwd: appRoot, stdio: 'pipe' });
    }
  }, 120_000);

  it('renders each known block in order', () => {
    const order = [...html().matchAll(/data-block="([a-z]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['hero', 'text', 'kort']);
  });

  it('skips an unknown block type instead of failing the build', () => {
    expect(html()).not.toContain('Ska hoppas över');
  });

  it('passes ctx through to blocks', () => {
    expect(html()).toContain('data-site="demo"');
  });

  it('wraps each block in the chrome item', () => {
    expect(html()).toContain('data-chrome="hero"');
    expect(html()).toContain('data-bakgrund="mork"');
  });

  it('passes block props through', () => {
    expect(html()).toContain('data-kolumner="4"');
    expect(html()).toContain('id="start"');
  });
});
