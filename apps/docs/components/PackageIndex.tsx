import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Card, CardGrid, CardGridCell, Text, Title } from '@evanion/baize-ui';
import { packages, readmeUrl } from '../app/navigation';

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

/** What the package says it is, in its own manifest. */
function description(root: string): string {
  const manifest = JSON.parse(
    readFileSync(join(workspaceRoot(), root, 'package.json'), 'utf8'),
  ) as { description?: string };

  if (!manifest.description) {
    throw new Error(`${root}/package.json has no description`);
  }

  return manifest.description;
}

/**
 * Every package this site is responsible for, as a grid of cards.
 *
 * Usable as a JSX tag in any MDX page through the map in mdx-components.js, and
 * the reason the landing page does not list three packages by name. It renders
 * `app/navigation.ts`, which repo-checks holds equal to the set of projects
 * `nx.json` releases, so a package added to the repository appears here without
 * anyone editing this file or the page that uses it.
 *
 * A server component reading the filesystem, which is the whole point: each
 * card's sentence is the `description` from the package's own manifest, so the
 * index cannot describe a package differently from npm. `output: 'export'` means
 * this runs once, during the build.
 */
export default function PackageIndex() {
  return (
    <CardGrid as="ul" label="Packages">
      {packages.map((entry) => (
        <CardGridCell as="li" key={entry.name}>
          <Card
            head={
              <a href={entry.documented ? `/${entry.slug}` : readmeUrl(entry)}>
                <Title as="h3" size="sm">
                  {entry.title}
                </Title>
              </a>
            }
            foot={
              <Text size="xs" tone="moss">
                {entry.name}
              </Text>
            }
          >
            <Text size="sm" tone="lichen">
              {description(entry.root)}
            </Text>
          </Card>
        </CardGridCell>
      ))}
    </CardGrid>
  );
}
