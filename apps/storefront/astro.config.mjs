import { defineConfig } from 'astro/config';

// Empty, and required to be. tools/nx-astro infers this project's build, dev,
// preview and check targets from the presence of this file, and derives the
// paths it declares as inputs and outputs from Astro's documented defaults
// rather than by reading the config. Setting srcDir, publicDir or outDir here
// would leave those targets pointing at the old locations; set them in nx.json's
// plugin options instead, which is where the plugin takes overrides.
export default defineConfig({});
