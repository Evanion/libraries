#!/usr/bin/env node
/**
 * Packs every publishable library, installs the tarballs into a throwaway
 * project outside the workspace, and checks that a consumer can import them and
 * see their types.
 *
 * Nothing inside the repo can tell whether a package resolves as published.
 * tsconfig.base.json sets `customConditions: ["@evanion/source"]`, so every
 * in-workspace import reaches a package's TypeScript source and the exports map,
 * the emitted declarations and the build output are all bypassed. A package can
 * therefore typecheck, test and lint clean while exporting nothing a consumer
 * can reach -- an extensionless relative specifier in an emitted .d.ts is enough,
 * because `moduleResolution: nodenext` requires the extension.
 *
 * Everything that only exists once the package is packed is checked here: the
 * exports map, the conditions in it, the declarations as emitted, the entry
 * points, and the directives and imports the bundler left in the output.
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

/**
 * Every publishable package, as `[directory, package name]`.
 *
 * A package missing from this list is packed by nothing and checked by nothing;
 * the count is asserted after packing so a failed `npm pack` cannot pass as a
 * shorter list.
 */
const LIBS = [
  ['libs/compose', '@evanion/compose'],
  ['libs/urn', '@evanion/urn'],
  ['libs/react-widget', '@evanion/react-widget'],
  ['nest/correlation-id', '@evanion/nestjs-correlation-id'],
  ['libs/astro-widget', '@evanion/astro-widget'],
  ['libs/luhn', '@evanion/luhn'],
  ['libs/feature', '@evanion/feature'],
  ['libs/token', '@evanion/token'],
  ['libs/baize-ui', '@evanion/baize-ui'],
];

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' });

const dir = mkdtempSync(join(tmpdir(), 'evanion-packaging-'));
let failed = false;

try {
  // CI builds from a checkout that has no `dist` at all. Here `dist` is whatever
  // the last local build left, and `nx build` empties it at no point: a file
  // planted in `libs/urn/dist` survives a rebuild, which overwrites what it
  // emits and touches nothing else, and survives a cache hit, which restores the
  // cached outputs alongside what is already on disk. A source file deleted
  // since the last build therefore leaves its JavaScript behind, `npm pack`
  // ships it, and every check below reports on a tarball that cannot be
  // published.
  //
  // Both halves are needed. Clearing alone is not enough, because a build that
  // ran against a dirty `dist` cached the stale file as part of its output, and
  // that cache entry is keyed on the sources as they are now -- so the build
  // after the clean hits it and puts the file straight back. `--skip-nx-cache`
  // alone is not enough either, since a rebuild does not prune. Together they
  // give a build from sources into an empty directory, which is what ships, and
  // the run replaces the poisoned cache entry on its way past.
  //
  // Only this script does it. Making `nx build` empty its own output would turn
  // every incremental local build into a full one, to catch something that shows
  // up only after a deletion; reproducing what ships is this script's whole
  // purpose and nothing else's.
  console.log('Clearing build output…');
  for (const [libDir] of LIBS) {
    rmSync(join(ROOT, libDir, 'dist'), { recursive: true, force: true });
  }

  console.log('Building libraries…');
  run('npx', ['nx', 'run-many', '-t', 'build', '--skip-nx-cache'], ROOT);

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
  // Names every public export and assigns the types to annotated bindings, so
  // `tsc` fails on a symbol that stopped being exported and on one whose type
  // stopped being reachable. `void [...]` at the end keeps the values used
  // without running anything.
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
import { AvailabilityPill, BoxArtPlaceholder, Button, ButtonLink, Card, CardGrid, CardGridCell, Chip, Figure, MechanismTag, Panel, SectionHeader, Stat, StatLine, TagRow, Text, Title, ComplexityRamp } from '@evanion/baize-ui';
import type { Availability, BoxArtPalette, ComplexityStop, Mechanism, StatProps, TitleSize } from '@evanion/baize-ui';
// The token entry, which may not touch React at all.
import { availability, boxArt, classNames, complexity, complexityTier, customProperties, ground, hueClass, ladderClass, mechanism, modifier, paletteClass, radius, renderTokensCss, space, stateClass } from '@evanion/baize-ui/tokens';

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
// The design system. Every prop that selects a token is an enum member and every
// prop that is displayed is a string, so a widened prop fails here.
const hue: Mechanism = 'areaControl';
const state: Availability = 'reprintPending';
const stop: ComplexityStop = 3;
const palette: BoxArtPalette = 'soot';
const titleSize: TitleSize = 'xl';
const statFigure: StatProps['figure'] = '40–70 min';
const felt: string = ground.felt;
const hueValue: string = mechanism[hue];
const stateValue: string = availability[state];
const stopValue: string = complexity[stop];
const tierName: string = complexityTier(2.4).name;
const rung: string = ladderClass(stop);
const artStop: string = boxArt[palette].from;
const cardRadius: string = radius.card;
const gutter: string = space[4];
const propertyName: string = customProperties[0]?.[0] ?? '';
const tokensCss: string = renderTokensCss();
void [ComposeProvider, provider, parsed, arr, err, items, widgetProblems, DefaultItem, DefaultWrapper,
      CorrelationModule, CorrelationService, withCorrelation, correlation,
      registry, sections, problems, checksum, filtered, luhnErr,
      toggleDecision, FeatureCycleError, FeatureProvider, useFeature, useFeatureEnabled, useFeatures,
      tokenCheck, tokenResult, tokenErr,
      AvailabilityPill, BoxArtPlaceholder, Button, ButtonLink, Card, CardGrid, CardGridCell, Chip,
      Figure, MechanismTag, Panel, SectionHeader, Stat, StatLine, TagRow, Text, Title, ComplexityRamp,
      felt, hueValue, stateValue, stopValue, tierName, rung, artStop, cardRadius, gutter, propertyName, tokensCss,
      titleSize, statFigure];
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

  // A second pass at runtime: the typecheck above resolves through the exports
  // map's `types` condition, node resolves through `import`, and the two point
  // at different files. A declaration can promise a value the emitted JavaScript
  // does not export.
  console.log('Importing at runtime…');
  writeFileSync(
    join(dir, 'runtime.mjs'),
    `
import { readFileSync } from 'node:fs';
import { URN, InvalidError, ValidationError } from '@evanion/urn';
import { ComposeProvider, provider } from '@evanion/compose';
import { createWidgets, DefaultItem, DefaultWrapper, validateItems } from '@evanion/react-widget';
import { defineBlocks, validateBlocks } from '@evanion/astro-widget';
import { Luhn, createLuhn, InvalidDictionaryError } from '@evanion/luhn';
import { createFeatures } from '@evanion/feature';
import { FeatureProvider, useFeature } from '@evanion/feature/react';
import { createToken, InvalidAlphabetError, TokenError } from '@evanion/token';
import { Card, StatLine, BoxArtPlaceholder } from '@evanion/baize-ui';
import { ground, hueClass, ladderClass, paletteClass, renderTokensCss, stateClass } from '@evanion/baize-ui/tokens';
const missing = Object.entries({
  URN, InvalidError, ValidationError, ComposeProvider, provider,
  createWidgets, DefaultItem, DefaultWrapper, validateItems,
  defineBlocks, validateBlocks, createLuhn, InvalidDictionaryError,
  createFeatures, FeatureProvider, useFeature,
  createToken, InvalidAlphabetError, TokenError,
  Card, StatLine, BoxArtPlaceholder,
  hueClass, ladderClass, paletteClass, stateClass,
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
// The stylesheet is a third entry rather than something a component imports, so
// what has to hold at runtime is that the specifier resolves from a consumer's
// own install and that the ground reached the file.
const stylesheet = readFileSync(new URL(import.meta.resolve('@evanion/baize-ui/styles.css')), 'utf8');
if (!stylesheet.includes(ground.felt.toLowerCase())) {
  console.error('@evanion/baize-ui/styles.css does not carry the felt token value');
  process.exit(1);
}
// The class-name resolvers are the only contract a non-React consumer has with
// the stylesheet: apps/storefront is pure Astro and emits these names from
// frontmatter, so they have to survive the build on the entry that imports no
// React.
if (hueClass('workerPlacement') !== 'baize-hue-worker-placement' ||
    stateClass('reprintPending') !== 'baize-state-reprint-pending' ||
    ladderClass(4) !== 'baize-ladder-4' ||
    paletteClass('terracotta') !== 'baize-palette-terracotta') {
  console.error('@evanion/baize-ui/tokens resolves a class name the stylesheet does not declare');
  process.exit(1);
}
if (!renderTokensCss().includes(ground.felt.toLowerCase())) {
  console.error('@evanion/baize-ui/tokens cannot render its own custom-property block');
  process.exit(1);
}
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

  // @evanion/baize-ui promises statelessness, and the packed entry is where a
  // promise kept in the source can still be broken: a bundler upgrade, a
  // transitive dependency or a generated helper can reintroduce an import the
  // source does not show. libs/baize-ui/src/react-imports.test.ts applies the
  // same allowlist to the source, and catches the author instead.
  //
  // An allowlist rather than a denylist, because a denylist has to be maintained
  // against React's surface: `/^use[A-Z]/` misses createContext, and the
  // client-only list above misses useMemo -- which the `react-server` condition
  // does provide, and which is still not stateless.
  const baizeDist = join(dir, 'node_modules', '@evanion', 'baize-ui', 'dist');
  const baizeEntry = readFileSync(join(baizeDist, 'index.js'), 'utf8');
  const baizeAllowed = {
    react: ['createElement', 'Fragment'],
    'react/jsx-runtime': ['jsx', 'jsxs', 'jsxDEV', 'Fragment'],
  };
  const baizeOffenders = [];
  for (const match of baizeEntry.matchAll(
    /import\s*(?:\{([^}]*)\}|(\*\s+as\s+\w+|\w+))\s*from\s*["']([^"']+)["']/g,
  )) {
    const module = match[3];
    if (!/^react(?:$|\/|-dom)/.test(module)) continue;
    const allowed = baizeAllowed[module];
    if (!allowed) {
      baizeOffenders.push(`${module} (whole module)`);
      continue;
    }
    const specifiers = (match[1] ?? '')
      .split(',')
      .map((specifier) =>
        specifier
          .trim()
          .split(/\s+as\s+/)[0]
          .trim(),
      )
      .filter(Boolean);
    for (const specifier of specifiers) {
      if (!allowed.includes(specifier)) {
        baizeOffenders.push(`${specifier} from ${module}`);
      }
    }
  }
  if (baizeOffenders.length) {
    throw new Error(
      '@evanion/baize-ui dist/index.js imports React APIs outside its ' +
        'allowlist: ' +
        baizeOffenders.join(', ') +
        '. The package is stateless: no hook, no context, no renderer.',
    );
  }
  console.log('  ✓ baize-ui imports only createElement-level React APIs');

  // The components ship class names and no stylesheet. Next resolves a CSS
  // import inside a package's module graph; Astro, plain Vite SSR and a bare
  // `node` import do not.
  if (/(?:from|import)\s*["'][^"']+\.css["']/.test(baizeEntry)) {
    throw new Error(
      '@evanion/baize-ui dist/index.js imports a stylesheet. The app imports ' +
        '@evanion/baize-ui/styles.css once in its root instead.',
    );
  }
  // Checking the entry for an import is not sufficient on its own: Vite's lib
  // mode extracts a component's CSS import into an asset of its own and removes
  // the import from the JavaScript, so the sabotage leaves the entry clean and
  // shows up as a second stylesheet in the output. One CSS file, and it is the
  // one the exports map names.
  const baizeStylesheets = readdirSync(baizeDist, {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
    .map((entry) =>
      join(entry.parentPath, entry.name).slice(baizeDist.length + 1),
    );
  if (baizeStylesheets.join() !== 'styles.css') {
    throw new Error(
      '@evanion/baize-ui ships stylesheets it does not export: ' +
        baizeStylesheets.join(', ') +
        '. A second CSS file in the output means a module under src/ imported ' +
        'one and the bundler extracted it.',
    );
  }
  if (/^["']use client["'];?$/.test(baizeEntry.split('\n')[0].trim())) {
    throw new Error(
      "@evanion/baize-ui dist/index.js must NOT carry a 'use client' " +
        'directive: a stateless presentational component renders the same under ' +
        'every rendering model.',
    );
  }
  console.log("  ✓ baize-ui ships no CSS import and no 'use client'");

  // The `./tokens` entry exists so that a build script, a Nest response or a
  // test can read a token value without React in its graph.
  const baizeTokens = readFileSync(
    join(baizeDist, 'tokens', 'index.js'),
    'utf8',
  );
  if (/(?:from|import)\s*["']react(?:\/[^"']*)?["']/.test(baizeTokens)) {
    throw new Error(
      '@evanion/baize-ui dist/tokens/index.js imports react. The token entry ' +
        'must stay reachable from anything that needs a value.',
    );
  }
  console.log('  ✓ baize-ui tokens entry imports nothing from react');

  const baizePkg = JSON.parse(
    readFileSync(
      join(dir, 'node_modules', '@evanion', 'baize-ui', 'package.json'),
      'utf8',
    ),
  );
  // Three entries and no deep-import path: the exports map lists these and
  // nothing else, so `@evanion/baize-ui/src/...` does not resolve.
  for (const entry of ['.', './tokens', './styles.css']) {
    if (!Object.keys(baizePkg.exports).includes(entry)) {
      throw new Error(`@evanion/baize-ui stopped exporting "${entry}"`);
    }
  }
  console.log('  ✓ baize-ui exports all three entries');

  // One stylesheet, with the generated custom properties inlined. A build that
  // stopped inlining the @import would publish a relative specifier resolved
  // against whatever directory the consumer's bundler put the file in.
  const baizeStyles = readFileSync(join(baizeDist, 'styles.css'), 'utf8');
  if (/@import/.test(baizeStyles)) {
    throw new Error(
      '@evanion/baize-ui dist/styles.css still carries an @import; the build ' +
        'inlines tokens.generated.css into it.',
    );
  }
  const groundHexes = [
    '#0c1714',
    '#142521',
    '#2a3f39',
    '#f2ede3',
    '#8fa69e',
    '#5e736c',
  ];
  const missingHexes = groundHexes.filter(
    (hex) => !baizeStyles.toLowerCase().includes(hex),
  );
  if (missingHexes.length) {
    throw new Error(
      '@evanion/baize-ui dist/styles.css is missing the approved ground: ' +
        missingHexes.join(', '),
    );
  }
  console.log('  ✓ baize-ui ships one stylesheet carrying the ground');

  // A helper tsc emits under `importHelpers` becomes an `import ... from
  // "tslib"` in the published JavaScript, which the consumer's package manager
  // has to have installed. Nothing inside the workspace can tell: tslib sits in
  // the root node_modules, so every in-repo build and test resolves it whether
  // the package declares it or not, and the import only fails once it is
  // resolved from a consumer's own install — which is this directory.
  //
  // tools/repo-checks/src/tslib-dependency.test.ts checks the setting that
  // governs the emit. This checks the emit, so it also covers a tslib import
  // written by hand and one a bundler left in its output.
  console.log('Checking tslib declarations against the packed output…');
  const tslibProblems = [];
  for (const [, name] of LIBS) {
    const root = join(dir, 'node_modules', ...name.split('/'));
    const manifest = JSON.parse(
      readFileSync(join(root, 'package.json'), 'utf8'),
    );
    const declared = 'tslib' in (manifest.dependencies ?? {});

    const modules = readdirSync(join(root, 'dist'), {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && /\.(?:js|cjs|mjs)$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name));

    const importers = modules.filter((file) =>
      /(?:from|import|require\s*\()\s*["']tslib(?:\/[^"']*)?["']/.test(
        readFileSync(file, 'utf8'),
      ),
    );

    if (importers.length && !declared) {
      tslibProblems.push(
        `${name} imports tslib from ${importers.length} module(s) but declares ` +
          `no tslib dependency: a consumer install resolves nothing`,
      );
    }
    if (!importers.length && declared) {
      tslibProblems.push(
        `${name} declares tslib but no module in its published output imports ` +
          `it: every consumer installs it for nothing`,
      );
    }
  }
  if (tslibProblems.length) {
    throw new Error(tslibProblems.join('\n'));
  }
  console.log('  ✓ tslib is declared by exactly the packages that import it');

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
