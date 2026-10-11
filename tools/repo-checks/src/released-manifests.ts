import { createProjectGraphAsync, parseJson, workspaceRoot } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The manifest of every released package, read off the project graph.
 *
 * The released packages are the projects `release.projects` in nx.json matches,
 * which are the ones `nx release` versions, whose dependents it rewrites and
 * whose non-private members it publishes. The glob is read here rather than
 * listed, so a directory added under it is a released package from the moment
 * it exists.
 *
 * Every rule that reads these manifests takes them as an argument, so the rule
 * can be asserted against fixtures and the workspace is one more case.
 */

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

export type DependencyField = (typeof DEPENDENCY_FIELDS)[number];

/** The fields in the order every rule walks them. */
export const dependencyFields: readonly DependencyField[] = DEPENDENCY_FIELDS;

export type Manifest = {
  /** The project's directory, relative to the workspace root. */
  root: string;
  name: string;
  version: string;
  /** `true` where `nx release publish` skips the package. */
  private?: boolean;
} & Partial<Record<DependencyField, Record<string, string>>>;

function releaseProjectPatterns(): string[] {
  const nxJson = parseJson<{ release?: { projects?: string | string[] } }>(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
    { expectComments: true },
  );
  const patterns = nxJson.release?.projects;

  if (patterns === undefined) {
    throw new Error('nx.json must define release.projects');
  }

  return Array.isArray(patterns) ? patterns : [patterns];
}

export async function releasedManifests(): Promise<Manifest[]> {
  const graph = await createProjectGraphAsync({ exitOnError: false });

  const names = new Set(
    findMatchingProjects(releaseProjectPatterns(), graph.nodes),
  );

  return Object.values(graph.nodes)
    .filter((node) => names.has(node.name))
    .map(({ data: { root } }) => {
      const manifest = JSON.parse(
        readFileSync(join(workspaceRoot, root, 'package.json'), 'utf-8'),
      ) as Omit<Manifest, 'root'>;

      return { ...manifest, root };
    });
}
