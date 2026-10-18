import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readRegion } from '@evanion/doc-examples/regions';

/** The workspace root: the nearest directory above the working directory holding `nx.json`. */
function workspaceRoot(): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, 'nx.json'))) {
    const up = dirname(dir);
    if (up === dir) throw new Error('No nx.json above the working directory');
    dir = up;
  }
  return dir;
}

/** Lines a region carries for its test run and a reader never needs. */
const PLUMBING = [
  /^\/\*\* @jsxRuntime classic \*\/$/,
  /^import \* as React from 'react';$/,
  /^\/\/ ---cut---$/,
];

/** A tested region's code, read at build time, without its test plumbing or `// ->` result comments. */
export function regionCode(file: string, region: string): string {
  const source = readFileSync(join(workspaceRoot(), file), 'utf8');
  return readRegion(source, file, region)
    .code.split('\n')
    .filter((line) => !PLUMBING.some((p) => p.test(line.trim())))
    .map((line) => line.replace(/\s*\/\/ -> .*$/, ''))
    .join('\n')
    .trim();
}
