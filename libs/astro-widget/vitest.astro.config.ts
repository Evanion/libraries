/// <reference types='vitest' />
import { getViteConfig } from 'astro/config';
import type { ConfigEnv, PluginOption, UserConfig } from 'vite';

import { docExamples } from '@evanion/doc-examples';

const examples = docExamples();

const astro = getViteConfig({
  ...examples,
  test: {
    name: '@evanion/astro-widget:astro',
    globals: true,
    environment: 'node',
    include: ['src/**/*.astro.test.ts'],
    includeSource: ['README.md'],
    reporters: ['default'],
    // The README's first block is the first to import an `.astro` module, so
    // it waits for Astro to compile the examples it renders: three seconds on
    // an idle machine, and past Vitest's five-second default under `nx
    // run-many` with lint and typecheck beside it.
    testTimeout: 30_000,
  },
});

/** Whether a plugin, however deeply Vite's config nests it, is `name`. */
function named(plugin: PluginOption, name: string): boolean {
  return (
    typeof plugin === 'object' &&
    plugin !== null &&
    !Array.isArray(plugin) &&
    'name' in plugin &&
    plugin.name === name
  );
}

/**
 * Vitest project for everything that compiles a `.astro` module: the tests that
 * render `Widgets.astro` through Astro's container API, and the README's
 * documented examples.
 *
 * `Widgets.astro` is the one source file in this package the type checker
 * cannot see into, so it is the one that has to be rendered to be tested.
 * Compiling a `.astro` module needs Astro's own vite plugin, and the library
 * build in vite.config.ts must not carry that plugin -- hence a second config,
 * referenced from that file's `test.projects`.
 *
 * The README runs here for the same reason: its examples render a page built
 * from the `.astro` widgets under `examples/`, so the HTML a docs page prints
 * beside them is the HTML Astro wrote. `astro:markdown` is removed because it
 * loads every `.md` file as a rendered Astro page, and vite-plugin-doctest has
 * to read the README as markdown to find its fences. This package has no
 * markdown page for the plugin to serve.
 */
export default async (env: ConfigEnv): Promise<UserConfig> => {
  const config = await astro(env);

  return {
    ...config,
    plugins: (config.plugins ?? [])
      .flat(Number.POSITIVE_INFINITY)
      .filter((plugin) => !named(plugin, 'astro:markdown')),
  };
};
