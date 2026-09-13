import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * The workspace root, found by walking up from wherever the build was started.
 *
 * `nx` runs this app's targets from `apps/docs` and a developer may run them from
 * the repository root, so neither is safe to assume. `nx.json` only exists in one
 * place.
 */
function workspaceRoot(): string {
  let directory = process.cwd();

  while (!existsSync(join(directory, 'nx.json'))) {
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`No nx.json above ${process.cwd()}`);
    }
    directory = parent;
  }

  return directory;
}

/**
 * What the package says it is, in its own manifest.
 *
 * Read from the filesystem at build time -- `output: 'export'` means once -- so
 * the sentence on a package's card is the `description` npm shows, and the
 * landing page cannot describe a package differently from the registry.
 */
export function description(root: string): string {
  const manifest = JSON.parse(
    readFileSync(join(workspaceRoot(), root, 'package.json'), 'utf8'),
  ) as { description?: string };

  if (!manifest.description) {
    throw new Error(`${root}/package.json has no description`);
  }

  return manifest.description;
}
