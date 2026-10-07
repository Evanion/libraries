/**
 * Nextra's MDX loader, with `codeClasses()` and `popupPanels()` added to the
 * transformers it hands Shiki.
 *
 * Nextra's hook for a Shiki transformer is
 * `mdxOptions.rehypePrettyCodeOptions.transformers`, which its loader appends
 * after its own Twoslash transformer (`nextra/dist/server/loader.js`). Under
 * Turbopack a loader's options cross into Rust as JSON, so a transformer, which
 * is an object of functions, cannot be set in `next.config.ts`
 * (`next/dist/docs/01-app/02-guides/mdx.md`: "remark and rehype plugins without
 * serializable options cannot be used yet with Turbopack"). This loader takes
 * Nextra's place in the rules `next.config.ts` swaps it into, and builds the
 * option inside the loader worker, where functions exist.
 *
 * `nextraLoader` is the path of the loader it stands in for, which Nextra keeps
 * out of its package's `exports`.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { codeClasses } from './code-classes.mjs';
import { pageTime } from './page-dates.mjs';
import { popupPanels } from './popup-panels.mjs';

const require = createRequire(import.meta.url);

const docsRoot = join(import.meta.dirname, '..');
const roots = { docsRoot, workspaceRoot: join(docsRoot, '..', '..') };

/**
 * Sets the page's `metadata.timestamp`, which the theme renders as "Last
 * updated", to `pageTime` of the file being compiled.
 *
 * Nextra 4.6.1 passes each file's commit time to `remarkAssignFrontMatter` as a
 * plugin option, and `compileMdx` caches one compiler per format for the life of
 * the loader worker (`nextra/dist/server/compile.js`, `cachedCompilerForFormat`).
 * Every page a worker compiles carries the time of the first page it compiled
 * (shuding/nextra#4963). This plugin reads the file from the vfile, which is
 * per page, and runs after every remark plugin, so it overwrites the value
 * Nextra wrote.
 */
function rehypePageTime() {
  return async (tree, file) => {
    const metadata = tree.children.find(
      (node) =>
        node.type === 'mdxjsEsm' &&
        node.data?.estree?.body[0]?.declaration?.declarations?.[0]?.id.name ===
          'metadata',
    );
    if (!metadata) return;

    const object =
      metadata.data.estree.body[0].declaration.declarations[0].init;
    const time = await pageTime(roots, file.history[0]);

    object.properties = object.properties.filter(
      (property) => (property.key?.value ?? property.key?.name) !== 'timestamp',
    );
    if (time !== null)
      object.properties.push({
        type: 'Property',
        kind: 'init',
        key: { type: 'Literal', value: 'timestamp' },
        value: { type: 'Literal', value: time },
        method: false,
        shorthand: false,
        computed: false,
      });
  };
}

export default function loader(source) {
  const { nextraLoader, ...options } = this.getOptions();
  const mdxOptions = options.mdxOptions ?? {};
  const prettyCode = mdxOptions.rehypePrettyCodeOptions ?? {};

  this.getOptions = () => ({
    ...options,
    mdxOptions: {
      ...mdxOptions,
      rehypePlugins: [...(mdxOptions.rehypePlugins ?? []), rehypePageTime],
      rehypePrettyCodeOptions: {
        ...prettyCode,
        // In this order: the panels are serialised with the token classes
        // already on their spans.
        transformers: [
          ...(prettyCode.transformers ?? []),
          codeClasses(),
          popupPanels(),
        ],
      },
    },
  });

  return require(nextraLoader).call(this, source);
}
