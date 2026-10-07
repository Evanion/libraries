import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';

import { getViteConfig } from 'astro/config';
import { createServer, defaultServerConditions } from 'vite';

import { EXAMPLES_FILE } from '@evanion/doc-examples/examples-file';
import { readRegion } from '@evanion/doc-examples/regions';

/**
 * Renders the payloads `/astro-widget/bad-items` offers through
 * `Widgets.astro`, and writes what Astro and `validateItems` made of each one.
 *
 * `next.config.ts` sets `output: 'export'`, so the page has no request-time
 * route and a browser has no Astro compiler. The HTML the control shows is
 * therefore written here, by Astro's container API, during the build that
 * produces the page. The control holds a fixed set of payloads because only a
 * payload rendered here has HTML to show.
 *
 * Each payload is a region of the package's `docs/examples.md` the page renders. The region runs as it
 * does under doctest, with one change: `validateItems` records its arguments.
 * The first call's items, `known` and `required` are the payload, so the
 * control shows the call the page's fence makes and nothing written for it.
 * The payload then renders through `Widgets.astro` with a registry holding the
 * `known` types, taken from the widgets under `examples/src/widgets`, or with
 * the registry itself where the region passes one.
 *
 * `sources` records a digest of every file the render read, this script
 * included. `tools/repo-checks/src/doc-widget-renders.test.ts` recomputes them,
 * so a render left behind by an earlier checkout fails the test run.
 */

const docsRoot = join(import.meta.dirname, '..');
const workspaceRoot = join(docsRoot, '..', '..');
const libraryRoot = join(workspaceRoot, 'libs', 'astro-widget');
const EXAMPLES = join(libraryRoot, EXAMPLES_FILE);
const examplesDir = dirname(EXAMPLES);
const WIDGETS = join(libraryRoot, 'examples', 'src', 'widgets');
const output = join(docsRoot, 'components', 'astro-widget', 'renders.json');

/** The regions the control offers, in the order the page renders them. */
const PAYLOADS = [
  { region: 'structural-rules', label: 'Five structural faults' },
  { region: 'not-a-list', label: 'An object where the list goes' },
  {
    region: 'nested-index',
    label: 'A grid with no title and an unknown child',
  },
  { region: 'nested-registry', label: 'A grid child the check passes' },
];

/**
 * The module id a region is served under, beside the file it came from, so a
 * relative import in it resolves the way it does under doctest.
 */
const regionId = (name) => join(examplesDir, `.region-${name}.ts`);

const RECORDER = '\0widget-renders:recorder';

/**
 * Serves each region as a module and hands its `@evanion/astro-widget` import
 * a `validateItems` that records the call before making it.
 */
const regions = {
  name: 'widget-renders:regions',
  enforce: 'pre',
  resolveId(source, importer) {
    if (source.startsWith(join(examplesDir, '.region-'))) return source;
    if (
      source === '@evanion/astro-widget' &&
      importer?.startsWith(join(examplesDir, '.region-'))
    ) {
      return RECORDER;
    }
    return undefined;
  },
  load(id) {
    if (id === RECORDER) {
      return [
        "import { validateItems as check } from '@evanion/astro-widget';",
        "export * from '@evanion/astro-widget';",
        'export const calls = [];',
        'export function validateItems(...args) {',
        '  const problems = check(...args);',
        '  calls.push({ args, problems });',
        '  return problems;',
        '}',
      ].join('\n');
    }
    const name = id.startsWith(join(examplesDir, '.region-'))
      ? basename(id, '.ts').slice('.region-'.length)
      : undefined;
    if (name === undefined) return undefined;
    return readRegion(readFileSync(EXAMPLES, 'utf8'), EXAMPLES_FILE, name).code;
  },
};

/** `GameGrid.astro` is the widget for `game-grid`. */
const typeOf = (file) =>
  basename(file, '.astro')
    .replace(/(?<=.)([A-Z])/g, '-$1')
    .toLowerCase();

const sha256 = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

const conditions = ['@evanion/source', ...defaultServerConditions];

// `warnOnce` prints only outside production. The warnings are what
// `astro dev` prints for the payload, and the control shows them.
process.env.NODE_ENV = 'development';

const config = await getViteConfig(
  {
    configFile: false,
    root: libraryRoot,
    logLevel: 'error',
    plugins: [regions],
    resolve: { conditions },
    ssr: { resolve: { conditions, externalConditions: conditions } },
    server: { middlewareMode: true, hmr: false, ws: false },
    // The root's `postcss.config.ts` belongs to the apps. Nothing here is CSS.
    css: { postcss: {} },
  },
  { root: libraryRoot, logLevel: 'error' },
)({ mode: 'development', command: 'serve' });

// `astro:server` starts Astro's request handler, which this script never
// calls, and closing the server under it logs the handler's failure.
const server = await createServer({
  ...config,
  plugins: (config.plugins ?? [])
    .flat(Number.POSITIVE_INFINITY)
    .filter((plugin) => plugin?.name !== 'astro:server'),
});

try {
  const load = (id) => server.ssrLoadModule(id);

  const { experimental_AstroContainer: AstroContainer } =
    await load('astro/container');
  const { default: Widgets } = await load(
    '@evanion/astro-widget/components/Widgets.astro',
  );
  const { resetWarnings } = await load('@evanion/widget');

  const widgets = new Map();
  for (const file of readdirSync(WIDGETS).filter((f) => f.endsWith('.astro'))) {
    widgets.set(typeOf(file), (await load(join(WIDGETS, file))).default);
  }

  const container = await AstroContainer.create();
  const payloads = [];

  for (const { region, label } of PAYLOADS) {
    const { calls } = await load(RECORDER);
    calls.length = 0;
    await load(regionId(region));

    const call = calls[0];
    if (call === undefined) {
      throw new Error(
        `${EXAMPLES_FILE} region ${region} makes no validateItems call.`,
      );
    }
    const [items, known, required] = call.args;

    const registry = Array.isArray(known)
      ? Object.fromEntries(
          known.map((type) => {
            const widget = widgets.get(type);
            if (widget === undefined) {
              throw new Error(
                `${EXAMPLES_FILE} region ${region} names ${type}, and examples/src/widgets has no widget for it.`,
              );
            }
            return [type, widget];
          }),
        )
      : known;

    const warnings = [];
    const warn = console.warn;
    resetWarnings();
    console.warn = (message) => warnings.push(String(message));
    let html;
    try {
      html = await container.renderToString(Widgets, {
        props: { items, registry },
      });
    } finally {
      console.warn = warn;
    }

    payloads.push({
      region,
      label,
      items,
      known: Array.isArray(known) ? known : Object.keys(known),
      registry: !Array.isArray(known),
      required: required ?? null,
      problems: call.problems,
      html,
      warnings,
    });
  }

  // Every workspace file the render compiled, plus the file the regions came
  // from and this script.
  const read = [...server.environments.ssr.moduleGraph.idToModuleMap.values()]
    .map((module) => module.file)
    .filter(
      (file) =>
        typeof file === 'string' &&
        isAbsolute(file) &&
        file.startsWith(workspaceRoot + sep) &&
        !file.includes(`${sep}node_modules${sep}`) &&
        !basename(file).startsWith('.region-'),
    );
  const files = [...new Set([...read, EXAMPLES, import.meta.filename])]
    .map((file) => relative(workspaceRoot, file).split(sep).join('/'))
    .sort();

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    `${JSON.stringify(
      {
        sources: Object.fromEntries(
          files.map((file) => [file, sha256(join(workspaceRoot, file))]),
        ),
        payloads,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await server.close();
}
