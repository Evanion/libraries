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
  ['libs/luhn', '@evanion/luhn'],
  ['libs/feature', '@evanion/feature'],
  ['libs/token', '@evanion/token'],
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
import { createWidgets, DefaultItem, DefaultWrapper, validateItems } from '@evanion/react-widget';
import type { WidgetItem, WidgetItemProblem } from '@evanion/react-widget';
import { CorrelationModule, CorrelationService, withCorrelation } from '@evanion/nestjs-correlation-id';
import type { CorrelationConfig } from '@evanion/nestjs-correlation-id';
import { defineBlocks, validateBlocks } from '@evanion/astro-widget';
import type { BlockItem, BlockRegistry, BlockProblem } from '@evanion/astro-widget';
import { Luhn, createLuhn, InvalidDictionaryError, LuhnError } from '@evanion/luhn';
import type { LuhnOptions } from '@evanion/luhn';
import { createFeatures, FeatureCycleError } from '@evanion/feature';
import type { Decision, FeatureDefinition } from '@evanion/feature';
import { createToken, DEFAULT_DICTIONARY, InvalidAlphabetError, TokenError } from '@evanion/token';
import type { TokenOptions, ValidateResult } from '@evanion/token';
// Second entry point, and the only one that may touch React.
import { FeatureProvider, useFeature, useFeatureEnabled, useFeatures } from '@evanion/feature/react';

const parsed: ParsedURN = URN.parse('urn:user:1');
const arr: ProviderArray = [];
const err: ValidationError = new InvalidError('NSS', 'x', 'x');
const News = ({ title }: { title: string }) => null;
const { defineItems } = createWidgets({ components: { news: News } });
const items: WidgetItem<{ news: typeof News }>[] = defineItems([
  { id: '1', type: 'news', props: { title: 'ok' } },
]);
const widgetProblems: WidgetItemProblem[] = validateItems(items, ['news']);
const correlation: CorrelationConfig = { header: 'X-Correlation-Id', generator: () => 'x' };
const registry: BlockRegistry = defineBlocks({ hero: 'not-a-real-component' });
const sections: BlockItem[] = [{ type: 'hero', heading: 'ok' }];
const problems: BlockProblem[] = validateBlocks(sections, registry, { hero: ['heading'] });
const checksum: string = Luhn.generate('foo').checksum;
const luhnOptions: LuhnOptions = { dictionary: '0123456789' };
const filtered: number = createLuhn(luhnOptions).validate('79927398713').filtered;
const luhnErr: LuhnError = new InvalidDictionaryError('odd-length', 'abc', []);
const toggleConfig: FeatureDefinition<'payments-v3' | 'checkout-v2'>[] = [
  { key: 'payments-v3', enabled: true, rules: [{ rollout: { percent: 25 } }] },
  { key: 'checkout-v2', enabled: true, dependsOn: ['payments-v3'] },
];
const toggles = createFeatures(toggleConfig);
const toggleDecision: Decision<'payments-v3' | 'checkout-v2'> =
  toggles.resolve({ targetingKey: 'acct-1' })['checkout-v2'];
const tokenOptions: TokenOptions = { dictionary: DEFAULT_DICTIONARY, length: 8 };
const tokenCheck: string = createToken(tokenOptions).generate({ prefix: 'ORD' }).check;
const tokenResult: ValidateResult = createToken().validate('a4kp-9mxa');
const tokenErr: TokenError = new InvalidAlphabetError('non-uniform', 'abcdef');
void [ComposeProvider, provider, parsed, arr, err, items, widgetProblems, DefaultItem, DefaultWrapper,
      CorrelationModule, CorrelationService, withCorrelation, correlation,
      registry, sections, problems, checksum, filtered, luhnErr,
      toggleDecision, FeatureCycleError, FeatureProvider, useFeature, useFeatureEnabled, useFeatures,
      tokenCheck, tokenResult, tokenErr];
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
      '@nestjs/common@12',
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
import { createWidgets, DefaultItem, DefaultWrapper, validateItems } from '@evanion/react-widget';
import { defineBlocks, validateBlocks } from '@evanion/astro-widget';
import { Luhn, createLuhn, InvalidDictionaryError } from '@evanion/luhn';
import { createFeatures } from '@evanion/feature';
import { FeatureProvider, useFeature } from '@evanion/feature/react';
import { createToken, InvalidAlphabetError, TokenError } from '@evanion/token';
const missing = Object.entries({
  URN, InvalidError, ValidationError, ComposeProvider, provider,
  createWidgets, DefaultItem, DefaultWrapper, validateItems,
  defineBlocks, validateBlocks, createLuhn, InvalidDictionaryError,
  createFeatures, FeatureProvider, useFeature,
  createToken, InvalidAlphabetError, TokenError,
}).filter(([, v]) => typeof v !== 'function').map(([k]) => k);
// token depends on luhn rather than bundling it, so a broken dependency range
// only shows up once both are installed from their tarballs: this call is the
// first thing that actually resolves the import.
const token = createToken();
const minted = token.generate({ prefix: 'ORD' });
if (!minted.value.startsWith('ORD-') || !token.validate(minted.value.slice(4)).valid) {
  console.error('@evanion/token cannot round-trip a code against the installed @evanion/luhn');
  process.exit(1);
}
if (!Object.isFrozen(token)) missing.push('createToken (result not frozen)');
// Luhn is the default instance rather than a class, and it is frozen so that
// assigning a dictionary to it throws instead of being silently ignored.
if (typeof Luhn?.generate !== 'function' || !Object.isFrozen(Luhn)) missing.push('Luhn');
if (missing.length) { console.error('not exported at runtime:', missing.join(', ')); process.exit(1); }
`,
  );
  run('node', ['runtime.mjs'], dir);
  console.log('  ✓ every package imports cleanly as ESM');

  // nestjs-correlation-id ships ESM only: exactly one build in the tarball,
  // no `require` condition in the exports map. A `require` condition would
  // let one copy be require()d and another imported, handing Nest two
  // unrelated CorrelationService class objects for what is a DI token.
  const nestPkg = JSON.parse(
    readFileSync(
      join(
        dir,
        'node_modules',
        '@evanion',
        'nestjs-correlation-id',
        'package.json',
      ),
      'utf8',
    ),
  );
  const conditions = Object.keys(nestPkg.exports['.']);
  if (conditions.includes('require')) {
    console.error(
      'nestjs-correlation-id exports a `require` condition again -- that is the dual-package hazard',
    );
    failed = true;
  }
  if (nestPkg.type !== 'module') {
    console.error('nestjs-correlation-id lost "type": "module"');
    failed = true;
  }
  const nestDist = join(
    dir,
    'node_modules',
    '@evanion',
    'nestjs-correlation-id',
    'dist',
  );
  const distDirs = readdirSync(nestDist, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'interfaces')
    .map((e) => e.name);
  if (distDirs.length) {
    console.error(
      `nestjs-correlation-id ships more than one build: dist/${distDirs.join(', dist/')}`,
    );
    failed = true;
  }
  if (!failed) {
    console.log(
      '  ✓ nestjs-correlation-id ships one ESM build, no require condition',
    );
  }

  // react-widget is importable from a React Server Component, which holds only
  // while it stays off createContext/useContext/Component -- none of which
  // React exposes under its `react-server` condition. Both halves of that break
  // silently: the build still succeeds and every test still passes, and it only
  // fails once someone imports it from a Server Component.
  //
  // The directive check alone is not enough. A context reintroduced *without* a
  // 'use client' directive would pass it and still fail at module evaluation in
  // an RSC graph, so the bundled entry is grepped as well.
  const widgetEntry = join(
    dir,
    'node_modules',
    '@evanion',
    'react-widget',
    'dist',
    'index.js',
  );
  const widgetSource = readFileSync(widgetEntry, 'utf8');
  const firstLine = widgetSource.split('\n')[0].trim();
  if (/^["']use client["'];?$/.test(firstLine)) {
    throw new Error(
      "@evanion/react-widget dist/index.js must NOT carry a 'use client' " +
        'directive: the package is meant to be usable from a Server Component.',
    );
  }
  console.log("  ✓ react-widget ships no 'use client' directive");

  // Grepping for `createContext(` would find nothing: rolldown renames imported
  // bindings, so a real context compiles to `import { createContext as t }` and
  // a call to `t(...)`. The imported *specifier* survives, so that is what is
  // checked -- and it is the stronger check anyway, catching an import whether
  // or not the call site is recognisable.
  const reactImport = widgetSource.match(
    /import\s*\{([^}]*)\}\s*from\s*["']react["']/,
  );
  const imported = (reactImport?.[1] ?? '')
    .split(',')
    .map((specifier) =>
      specifier
        .trim()
        .split(/\s+as\s+/)[0]
        .trim(),
    )
    .filter(Boolean);
  const clientOnly = [
    'createContext',
    'useContext',
    'useState',
    'useEffect',
    'useReducer',
    'useRef',
    'Component',
    'PureComponent',
  ];
  const found = clientOnly.filter((name) => imported.includes(name));
  if (found.length) {
    throw new Error(
      '@evanion/react-widget dist/index.js imports React APIs that the ' +
        '`react-server` condition does not provide: ' +
        found.join(', '),
    );
  }
  console.log('  ✓ react-widget imports no client-only React API');

  // @evanion/feature ships two entries for a reason that no in-repo check can
  // see: `'use client'` is a per-module directive, so the client layer needs its
  // own module in the published output. Both halves of that break silently. A
  // directive that migrated onto the core entry makes the whole package
  // client-only, and a React import that leaked into the core makes it
  // unimportable from the Nest API and from the build-time pass -- and in both
  // cases the build succeeds and every test passes.
  //
  // The core is emitted file-per-file, so checking the entry alone is not
  // enough: `dist/index.js` only re-exports, and a React import three files deep
  // would pass. Every core module is checked.
  const featureDist = join(dir, 'node_modules', '@evanion', 'feature', 'dist');
  const coreModules = readdirSync(featureDist, {
    recursive: true,
    withFileTypes: true,
  })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.js') &&
        !join(entry.parentPath, entry.name).includes(
          join(featureDist, 'react'),
        ),
    )
    .map((entry) => join(entry.parentPath, entry.name));

  if (coreModules.length === 0) {
    throw new Error('@evanion/feature ships no core modules at all');
  }

  const reactImporters = coreModules.filter((file) =>
    /(?:from|import)\s*["']react(?:\/[^"']*)?["']/.test(
      readFileSync(file, 'utf8'),
    ),
  );
  if (reactImporters.length) {
    throw new Error(
      '@evanion/feature core entry imports React: ' +
        reactImporters
          .map((file) => file.slice(featureDist.length + 1))
          .join(', ') +
        '. The core must be usable from the API and at build time, so nothing under it may import react.',
    );
  }
  console.log('  ✓ feature core imports nothing from react');

  const coreFirstLine = readFileSync(join(featureDist, 'index.js'), 'utf8')
    .split('\n')[0]
    .trim();
  if (/^["']use client["'];?$/.test(coreFirstLine)) {
    throw new Error(
      "@evanion/feature dist/index.js must NOT carry a 'use client' directive",
    );
  }

  const clientFirstLine = readFileSync(
    join(featureDist, 'react', 'index.js'),
    'utf8',
  )
    .split('\n')[0]
    .trim();
  if (!/^["']use client["'];?$/.test(clientFirstLine)) {
    throw new Error(
      "@evanion/feature dist/react/index.js must carry a 'use client' " +
        'directive as its first line; a bundler that collapsed the two entries ' +
        'into one module would drop it.',
    );
  }
  console.log("  ✓ feature ships 'use client' on the react entry only");

  const featurePkg = JSON.parse(
    readFileSync(
      join(dir, 'node_modules', '@evanion', 'feature', 'package.json'),
      'utf8',
    ),
  );
  const featureEntries = Object.keys(featurePkg.exports);
  for (const entry of ['.', './react']) {
    if (!featureEntries.includes(entry)) {
      throw new Error(`@evanion/feature stopped exporting "${entry}"`);
    }
  }
  console.log('  ✓ feature exports both entries');

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
