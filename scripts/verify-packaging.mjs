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
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
// [directory, package name]
const LIBS = [
  ['libs/compose', '@evanion/compose'],
  ['libs/urn', '@evanion/urn'],
  ['libs/widget', '@evanion/react-widget'],
  ['nest/correlation-id', '@evanion/nestjs-correlation-id'],
  ['libs/astro-widget', '@evanion/astro-widget'],
];

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' });

const dir = mkdtempSync(join(tmpdir(), 'evanion-packaging-'));
let failed = false;

try {
  console.log('Building libraries…');
  run('npx', ['nx', 'run-many', '-t', 'build'], ROOT);

  console.log(`Packing into ${dir}`);
  for (const [libDir] of LIBS) {
    run('npm', ['pack', '--pack-destination', dir], join(ROOT, libDir));
  }
  const tarballs = readdirSync(dir).filter((f) => f.endsWith('.tgz'));
  if (tarballs.length !== LIBS.length) {
    throw new Error(
      `expected ${LIBS.length} tarballs, found ${tarballs.length}`,
    );
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
        // nestjs-correlation-id's public types come off decorated classes.
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
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
import { CorrelationModule, CorrelationService, withCorrelation } from '@evanion/nestjs-correlation-id';
import type { CorrelationConfig } from '@evanion/nestjs-correlation-id';
import { defineBlocks, validateBlocks } from '@evanion/astro-widget';
import type { BlockItem, BlockRegistry, BlockProblem } from '@evanion/astro-widget';

const parsed: ParsedURN = URN.parse('urn:user:1');
const arr: ProviderArray = [];
const err: ValidationError = new InvalidError('NSS', 'x', 'x');
const News = ({ title }: { title: string }) => null;
const { defineItems } = createWidgets({ components: { news: News } });
const items: WidgetItem<{ news: typeof News }>[] = defineItems([
  { id: '1', type: 'news', props: { title: 'ok' } },
]);
const correlation: CorrelationConfig = { header: 'X-Correlation-Id', generator: () => 'x' };
const registry: BlockRegistry = defineBlocks({ hero: 'not-a-real-component' });
const sections: BlockItem[] = [{ type: 'hero', heading: 'ok' }];
const problems: BlockProblem[] = validateBlocks(sections, registry, { hero: ['heading'] });
void [ComposeProvider, provider, parsed, arr, err, items, DefaultItem, DefaultWrapper,
      CorrelationModule, CorrelationService, withCorrelation, correlation,
      registry, sections, problems];
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
      'reflect-metadata',
      '@nestjs/common@11',
      'rxjs',
      'typescript@6',
      '@types/react@19',
      '@types/react-dom@19',
    ],
    dir,
  );

  console.log('Type-checking a consumer…');
  run('npx', ['tsc', '-p', 'tsconfig.json'], dir);
  console.log('  ✓ every package exposes its types under nodenext');

  console.log('Importing at runtime…');
  writeFileSync(
    join(dir, 'runtime.mjs'),
    `
import { URN, InvalidError, ValidationError } from '@evanion/urn';
import { ComposeProvider, provider } from '@evanion/compose';
import { createWidgets, DefaultItem, DefaultWrapper } from '@evanion/react-widget';
import { defineBlocks, validateBlocks } from '@evanion/astro-widget';
const missing = Object.entries({
  URN, InvalidError, ValidationError, ComposeProvider, provider,
  createWidgets, DefaultItem, DefaultWrapper,
  defineBlocks, validateBlocks,
}).filter(([, v]) => typeof v !== 'function').map(([k]) => k);
if (missing.length) { console.error('not exported at runtime:', missing.join(', ')); process.exit(1); }
`,
  );
  run('node', ['runtime.mjs'], dir);
  console.log('  ✓ every package imports cleanly as ESM');

  // nestjs-correlation-id ships a dual build on purpose: NestJS 12 is ESM-only
  // but 10 and 11 are CommonJS, so its CJS half is the only way those consumers
  // can require() it. Assert both halves resolve, or a broken exports map would
  // go unnoticed until a CJS user hit it.
  writeFileSync(
    join(dir, 'runtime.cjs'),
    `
require('reflect-metadata');
const m = require('@evanion/nestjs-correlation-id');
const need = ['CorrelationModule','CorrelationService','CorrelationIdMiddleware','withCorrelation','CORRELATION_ID_HEADER'];
const missing = need.filter((k) => m[k] === undefined);
if (missing.length) { console.error('not exported via require():', missing.join(', ')); process.exit(1); }
if (!m.CorrelationModule.forRoot().global) { console.error('forRoot() lost its shape under CJS'); process.exit(1); }
`,
  );
  run('node', ['runtime.cjs'], dir);
  console.log(
    '  ✓ nestjs-correlation-id also resolves via require() (CJS half)',
  );

  // react-widget cannot exist without createContext/useContext, which React does
  // not expose under its `react-server` condition. Losing the 'use client'
  // directive breaks it silently: the build still succeeds, every test still
  // passes, and it only fails once someone imports it from a Server Component.
  const widgetEntry = join(
    dir,
    'node_modules',
    '@evanion',
    'react-widget',
    'dist',
    'index.js',
  );
  const firstLine = readFileSync(widgetEntry, 'utf8').split('\n')[0].trim();
  if (!/^["']use client["'];?$/.test(firstLine)) {
    throw new Error(
      "@evanion/react-widget dist/index.js must begin with a 'use client' directive, found: " +
        firstLine,
    );
  }
  console.log("  ✓ react-widget ships its 'use client' directive");

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
