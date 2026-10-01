/**
 * Nextra's MDX loader, with `codeClasses()` added to the transformers it hands
 * Shiki.
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

import { codeClasses } from './code-classes.mjs';

const require = createRequire(import.meta.url);

export default function loader(source) {
  const { nextraLoader, ...options } = this.getOptions();
  const mdxOptions = options.mdxOptions ?? {};
  const prettyCode = mdxOptions.rehypePrettyCodeOptions ?? {};

  this.getOptions = () => ({
    ...options,
    mdxOptions: {
      ...mdxOptions,
      rehypePrettyCodeOptions: {
        ...prettyCode,
        transformers: [...(prettyCode.transformers ?? []), codeClasses()],
      },
    },
  });

  return require(nextraLoader).call(this, source);
}
