/**
 * Thin internal Nx plugin giving Astro projects inferred targets.
 *
 * Nx's own tooling-plugin guide parses srcDir/outDir out of the Astro config
 * with a regex, and says outright that there are better ways. A regex over a
 * JavaScript config breaks the moment a value is a variable, an import or a
 * spread. Every Astro project in this workspace uses Astro's documented
 * defaults, so we take the defaults and let nx.json override them.
 */
import {
  createNodesFromFiles,
  joinPathFragments,
  type CreateNodesContextV2,
  type CreateNodesV2,
  type TargetConfiguration,
} from '@nx/devkit';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface AstroPluginOptions {
  buildTargetName?: string;
  devTargetName?: string;
  previewTargetName?: string;
  checkTargetName?: string;
  srcDir?: string;
  publicDir?: string;
  outDir?: string;
}

const astroConfigGlob = '**/astro.config.{mjs,ts}';

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

  // Only treat it as a project if Nx would already consider it one.
  if (
    !existsSync(join(abs, 'package.json')) &&
    !existsSync(join(abs, 'project.json'))
  ) {
    return {};
  }

  const srcDir = opts.srcDir ?? './src';
  const publicDir = opts.publicDir ?? './public';
  const outDir = opts.outDir ?? 'dist';

  const build: TargetConfiguration = {
    command: 'astro build',
    options: { cwd: projectRoot },
    cache: true,
    inputs: [
      '{projectRoot}/astro.config.mjs',
      joinPathFragments('{projectRoot}', srcDir, '**', '*'),
      joinPathFragments('{projectRoot}', publicDir, '**', '*'),
      { externalDependencies: ['astro'] },
    ],
    outputs: [`{projectRoot}/${outDir}`],
  };

  const dev: TargetConfiguration = {
    command: 'astro dev',
    options: { cwd: projectRoot },
  };

  const preview: TargetConfiguration = {
    command: 'astro preview',
    options: { cwd: projectRoot },
  };

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
