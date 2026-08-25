#!/usr/bin/env node
/**
 * Packs each publishable library, installs the tarballs into a throwaway
 * project outside the workspace, and checks that a real consumer can both
 * import them and see their types.
 *
 * This exists because a bug got all the way to the edge of a release that
 * nothing else caught: vite-plugin-dts emitted extensionless re-exports
 * (`export * from './Compose'`), which a consumer on moduleResolution
 * node16/nodenext cannot resolve -- so `@evanion/compose` and
 * `@evanion/react-widget` appeared to export nothing at all. Every in-repo
 * check passed, because inside the workspace those modules resolve from source.
 *
 * Anything that only shows up once the package is packed belongs here.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const LIBS = ['compose', 'urn', 'widget'];

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' });

const dir = mkdtempSync(join(tmpdir(), 'evanion-packaging-'));
let failed = false;

try {
  console.log('Building libraries…');
  run('npx', ['nx', 'run-many', '-t', 'build'], ROOT);

  console.log(`Packing into ${dir}`);
  for (const lib of LIBS) {
    run('npm', ['pack', '--pack-destination', dir], join(ROOT, 'libs', lib));
  }
  const tarballs = readdirSync(dir).filter((f) => f.endsWith('.tgz'));
  if (tarballs.length !== LIBS.length) {
    throw new Error(`expected ${LIBS.length} tarballs, found ${tarballs.length}`);
  }

  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'packaging-check', private: true, type: 'module' }),
  );
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      // nodenext on purpose: this is the resolution mode that catches
      // extensionless relative specifiers in emitted .d.ts files.
      compilerOptions: {
        strict: true,
        target: 'es2022',
        module: 'nodenext',
        moduleResolution: 'nodenext',
        jsx: 'react-jsx',
        noEmit: true,
        skipLibCheck: true,
      },
      include: ['consumer.ts'],
    }),
  );
  writeFileSync(
    join(dir, 'consumer.ts'),
    `
import { ComposeProvider, provider } from '@evanion/compose';
import type { ProviderArray } from '@evanion/compose';
import { URN, InvalidError, ValidationError } from '@evanion/urn';
import type { ParsedURN } from '@evanion/urn';
import { createWidgets, DefaultItem, DefaultWrapper } from '@evanion/react-widget';
import type { WidgetItem } from '@evanion/react-widget';

const parsed: ParsedURN = URN.parse('urn:user:1');
const arr: ProviderArray = [];
const err: ValidationError = new InvalidError('NSS', 'x', 'x');
const News = ({ title }: { title: string }) => null;
const { defineItems } = createWidgets({ components: { news: News } });
const items: WidgetItem<{ news: typeof News }>[] = defineItems([
  { id: '1', type: 'news', props: { title: 'ok' } },
]);
void [ComposeProvider, provider, parsed, arr, err, items, DefaultItem, DefaultWrapper];
`,
  );

  console.log('Installing tarballs…');
  run(
    'npm',
    [
      'install',
      '--silent',
      '--no-audit',
      '--no-fund',
      ...tarballs.map((t) => `./${t}`),
      'react@19',
      'react-dom@19',
      'typescript@6',
      '@types/react@19',
      '@types/react-dom@19',
    ],
    dir,
  );

  console.log('Type-checking a consumer…');
  run('npx', ['tsc', '-p', 'tsconfig.json'], dir);
  console.log('  ✓ all three packages expose their types under nodenext');

  console.log('Importing at runtime…');
  writeFileSync(
    join(dir, 'runtime.mjs'),
    `
import { URN, InvalidError, ValidationError } from '@evanion/urn';
import { ComposeProvider, provider } from '@evanion/compose';
import { createWidgets, DefaultItem, DefaultWrapper } from '@evanion/react-widget';
const missing = Object.entries({
  URN, InvalidError, ValidationError, ComposeProvider, provider,
  createWidgets, DefaultItem, DefaultWrapper,
}).filter(([, v]) => typeof v !== 'function').map(([k]) => k);
if (missing.length) { console.error('not exported at runtime:', missing.join(', ')); process.exit(1); }
`,
  );
  run('node', ['runtime.mjs'], dir);
  console.log('  ✓ all three packages import cleanly');

  console.log('\nPackaging verified.');
} catch (error) {
  failed = true;
  console.error('\nPackaging check FAILED\n');
  console.error(error.stdout || error.message);
  if (error.stderr) console.error(error.stderr);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
