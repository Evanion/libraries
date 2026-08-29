import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodesV2 } from './index';

function workspaceWithAstroProject(): { root: string; configFile: string } {
  const root = mkdtempSync(join(tmpdir(), 'nx-astro-'));
  const projectRoot = join(root, 'apps', 'demo');
  mkdirSync(projectRoot, { recursive: true });
  writeFileSync(join(projectRoot, 'astro.config.mjs'), 'export default {};');
  writeFileSync(join(projectRoot, 'package.json'), '{"name":"demo"}');
  return { root, configFile: 'apps/demo/astro.config.mjs' };
}

describe('createNodesV2', () => {
  it('infers build, dev, preview and check targets', async () => {
    const { root, configFile } = workspaceWithAstroProject();
    const [, fn] = createNodesV2;
    const results = await fn([configFile], {}, { workspaceRoot: root } as never);
    const [, node] = results[0];
    const targets = node.projects!['apps/demo'].targets!;

    expect(Object.keys(targets).sort()).toEqual(['build', 'check', 'dev', 'preview']);
    expect(targets.build.command).toBe('astro build');
    expect(targets.build.options).toEqual({ cwd: 'apps/demo' });
    expect(targets.build.cache).toBe(true);
    expect(targets.build.outputs).toEqual(['{projectRoot}/dist']);
    expect(targets.dev.cache).toBeUndefined();
  });

  it('skips a directory with no package.json or project.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nx-astro-'));
    mkdirSync(join(root, 'stray'), { recursive: true });
    writeFileSync(join(root, 'stray', 'astro.config.mjs'), 'export default {};');
    const [, fn] = createNodesV2;
    const results = await fn(['stray/astro.config.mjs'], {}, { workspaceRoot: root } as never);
    expect(results[0][1]).toEqual({});
  });

  it('honours target name and directory overrides', async () => {
    const { root, configFile } = workspaceWithAstroProject();
    const [, fn] = createNodesV2;
    const results = await fn(
      [configFile],
      { buildTargetName: 'bundle', outDir: './out' },
      { workspaceRoot: root } as never
    );
    const targets = results[0][1].projects!['apps/demo'].targets!;
    expect(targets.bundle.outputs).toEqual(['{projectRoot}/./out']);
    expect(targets.build).toBeUndefined();
  });
});
