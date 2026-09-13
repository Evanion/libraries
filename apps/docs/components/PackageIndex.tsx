import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  ButtonLink,
  Card,
  CardGrid,
  CardGridCell,
  Chip,
  SectionHeader,
  Text,
  Title,
} from '@evanion/baize-ui';
import {
  groups,
  packages,
  readmeUrl,
  type DocumentedPackage,
} from '../app/navigation';

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

/** Where a card's title and buttons send a reader. */
function href(entry: DocumentedPackage): string {
  return entry.documented ? `/${entry.slug}` : readmeUrl(entry);
}

/**
 * The two facts a reader needs before opening a card: the stack it runs in, and
 * whether it is on npm.
 *
 * Plain text at the small step rather than a row of coloured pills, which would
 * compete with the sentence that says what the package does. The one exception
 * is `unreleased`, which is a chip because it changes what a reader can do --
 * "preview" would imply they can try it and "work in progress" that it is
 * unfinished, and neither is true: there is nothing on npm, and the
 * implementation is complete.
 */
function Marker({ entry }: { entry: DocumentedPackage }) {
  return (
    <Text size="xs" tone="moss">
      {entry.name} · {entry.framework}
      {entry.workshop ? <Chip>unreleased</Chip> : null}
    </Text>
  );
}

/** One package, one card. */
function PackageCard({ entry }: { entry: DocumentedPackage }) {
  return (
    <Card
      head={
        <a href={href(entry)}>
          <Title as="h3" size="sm">
            {entry.title}
          </Title>
        </a>
      }
      foot={<Marker entry={entry} />}
    >
      <Text size="sm" tone="lichen">
        {description(entry.root)}
      </Text>
    </Card>
  );
}

/** A whole group as one card: the shared description, then a way into each. */
function CombinedCard({
  group,
  members,
}: {
  group: (typeof groups)[number];
  members: readonly DocumentedPackage[];
}) {
  return (
    <Card
      head={
        <Title as="h3" size="sm">
          {group.title}
        </Title>
      }
      foot={
        <>
          {members.map((entry) => (
            <ButtonLink key={entry.name} href={href(entry)}>
              {entry.title}
            </ButtonLink>
          ))}
        </>
      }
    >
      <Text size="sm" tone="lichen">
        {group.line}
      </Text>
      {members.map((entry) => (
        <Marker key={entry.name} entry={entry} />
      ))}
    </Card>
  );
}

/**
 * One group: a heading, and either a card per package or the whole group as one.
 *
 * A combined group's line is its card's body, so it is not repeated under the
 * heading.
 */
function Group({ group }: { group: (typeof groups)[number] }) {
  const members = packages.filter((entry) => entry.group === group.id);

  if (members.length === 0) return null;

  return (
    <>
      <SectionHeader heading={<Title as="h2">{group.title}</Title>} />
      {group.combined ? null : (
        <Text size="sm" tone="lichen">
          {group.line}
        </Text>
      )}
      <CardGrid as="ul" label={group.title}>
        {group.combined ? (
          <CardGridCell as="li">
            <CombinedCard group={group} members={members} />
          </CardGridCell>
        ) : (
          members.map((entry) => (
            <CardGridCell as="li" key={entry.name}>
              <PackageCard entry={entry} />
            </CardGridCell>
          ))
        )}
      </CardGrid>
    </>
  );
}

/**
 * Every package this site is responsible for, as cards under the problem each
 * one is for.
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
    <>
      {groups.map((group) => (
        <Group key={group.id} group={group} />
      ))}
    </>
  );
}
