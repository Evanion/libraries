/**
 * Internal Nx plugin that gives every Astro project `build`, `dev`, `preview`
 * and `check` targets, inferred from the presence of an `astro.config`.
 *
 * The paths those targets declare as inputs and outputs come from Astro's
 * documented defaults, overridable through the plugin's options in nx.json. The
 * config file is never parsed: Nx's own tooling-plugin guide regexes srcDir and
 * outDir out of it while saying there are better ways, and a regex over a
 * JavaScript config reads nothing useful the moment a value is a variable, an
 * import or a spread -- silently, as a wrong cache key rather than an error.
 */
import {
  createNodesFromFiles,
  joinPathFragments,
  type CreateNodesContextV2,
  type CreateNodesV2,
  type TargetConfiguration,
} from '@nx/devkit';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** Plugin options, as given in nx.json's `plugins` entry for this file. */
export interface AstroPluginOptions {
  /** Defaults to `build`. */
  buildTargetName?: string;
  /** Defaults to `dev`. */
  devTargetName?: string;
  /** Defaults to `preview`. */
  previewTargetName?: string;
  /** Defaults to `check`. */
  checkTargetName?: string;
  /**
   * Astro's `srcDir`, `publicDir` and `outDir`, which are taken at their
   * documented defaults (`./src`, `./public`, `dist`) and have to be repeated
   * here whenever a project's astro.config overrides one. They decide what Nx
   * hashes as the target's inputs and what it caches as its outputs, so a stale
   * value means a build served from cache after the real sources changed.
   */
  srcDir?: string;
  publicDir?: string;
  outDir?: string;
}

const astroConfigGlob = '**/astro.config.{mjs,ts}';

/**
 * Registers one project per matched `astro.config`.
 *
 * `createNodesV2` is the entry name Nx looks up on a plugin module; a plugin
 * exporting anything else contributes no targets and reports no error.
 */
export const createNodesV2: CreateNodesV2<AstroPluginOptions> = [
  astroConfigGlob,
  async (configFiles, options, context) =>
    createNodesFromFiles(createNodesInternal, configFiles, options ?? {}, context),
];

async function createNodesInternal(
  configFilePath: string,
  options: AstroPluginOptions | undefined,
  context: CreateNodesContextV2
) {
  const opts = options ?? {};
  const projectRoot = dirname(configFilePath);
  const abs = join(context.workspaceRoot, projectRoot);

  // Nx identifies a project by its package.json or project.json. An astro
  // config anywhere else -- a fixture, an example, a template -- is not a
  // project, and adding targets to one produces a graph node nothing owns.
  if (
    !existsSync(join(abs, 'package.json')) &&
    !existsSync(join(abs, 'project.json'))
  ) {
    return {};
  }

  const srcDir = opts.srcDir ?? './src';
  const publicDir = opts.publicDir ?? './public';
  const outDir = opts.outDir ?? 'dist';

  // `^build` because an .astro file imports workspace libraries, and astro
  // resolves those through each package's exports map to its build output --
  // which has to exist by then.
  const build: TargetConfiguration = {
    command: 'astro build',
    dependsOn: ['^build'],
    options: { cwd: projectRoot },
    cache: true,
    inputs: [
      // The config file as matched, not a fixed name: the glob accepts .mjs and
      // .ts, and a config left out of the inputs means an edit to it does not
      // invalidate the cached build.
      `{projectRoot}/${basename(configFilePath)}`,
      joinPathFragments('{projectRoot}', srcDir, '**', '*'),
      joinPathFragments('{projectRoot}', publicDir, '**', '*'),
      { externalDependencies: ['astro'] },
    ],
    outputs: [`{projectRoot}/${outDir}`],
  };

  // Uncached, both of them: a long-running server has no output to replay.
  const dev: TargetConfiguration = {
    command: 'astro dev',
    options: { cwd: projectRoot },
  };

  const preview: TargetConfiguration = {
    command: 'astro preview',
    options: { cwd: projectRoot },
  };

  // Cached with no `outputs`, which is how Nx caches a pass/fail: `astro check`
  // writes nothing. It is a separate target because the `typecheck` target Nx
  // infers from tsconfig.json is disabled whenever the resolved config sets
  // `noEmit`, as Astro's shared config does, and `astro build` does not
  // typecheck -- so this is the only target that checks the .astro files.
  const check: TargetConfiguration = {
    command: 'astro check',
    options: { cwd: projectRoot },
    cache: true,
    inputs: [
      joinPathFragments('{projectRoot}', srcDir, '**', '*'),
      { externalDependencies: ['astro'] },
    ],
  };

  return {
    projects: {
      [projectRoot]: {
        targets: {
          [opts.buildTargetName ?? 'build']: build,
          [opts.devTargetName ?? 'dev']: dev,
          [opts.previewTargetName ?? 'preview']: preview,
          [opts.checkTargetName ?? 'check']: check,
        },
      },
    },
  };
}
