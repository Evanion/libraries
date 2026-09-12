import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

// `srcDir`, `publicDir` and `outDir` are deliberately absent. tools/nx-astro
// infers this project's build, dev, preview and check targets from the presence
// of this file, and derives the paths it declares as inputs and outputs from
// Astro's documented defaults rather than by reading the config. Setting any of
// the three here would leave those targets pointing at the old locations; set
// them in nx.json's plugin options instead, which is where the plugin takes
// overrides.
//
// `output: 'server'` is the demo's point rather than a preference: a prerendered
// build would bake the catalogue into HTML at build time, and the correlation id
// would never cross storefront -> shop-api on a page view. The standalone node
// adapter is what serves it, so `node dist/server/entry.mjs` is a complete
// server with no host process to write.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
});
