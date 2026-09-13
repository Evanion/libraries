import { Card, Chip, SectionHeader, Text, Title } from '@evanion/baize-ui';
import { categoricalClass } from '@evanion/baize-ui/tokens';
import {
  groups,
  packages,
  readmeUrl,
  type DocumentedPackage,
  type PackageGroup,
} from '../../app/navigation';
import DataDemo from './DataDemo';
import { demoItems } from './demo';
import { listing } from './listing';
import { description } from './manifest';
import { platformsOf } from './platforms';
import { specimens } from './specimens';

/** Where a package's name and buttons send a reader. */
function href(entry: DocumentedPackage): string {
  return entry.documented ? `/${entry.slug}` : readmeUrl(entry);
}

/** The group `id` names, or a build failure naming the typo. */
function groupById(id: string): PackageGroup {
  const group = groups.find((candidate) => candidate.id === id);
  if (!group) throw new Error(`No group in navigation.ts has the id ${id}`);
  return group;
}

/** The packages under a group, in `navigation.ts` order. */
function members(group: PackageGroup): DocumentedPackage[] {
  return packages.filter((entry) => entry.group === group.id);
}

/** The class that binds a package's colour to everything inside an element. */
function identity(entry: DocumentedPackage): string {
  return `docs-identity ${categoricalClass(entry.hue)}`;
}

/**
 * The two facts a reader needs before opening anything: the published name,
 * and the stack it runs in, as a chip in that platform's own colour.
 *
 * `status` is where the unreleased mark goes. On a tile or a card it is the
 * ribbon across the corner, drawn by the tile, so the marker carries nothing;
 * in a row there is no corner to drape it over, so it is a chip here.
 */
function Marker({
  entry,
  status = 'ribbon',
}: {
  entry: DocumentedPackage;
  status?: 'ribbon' | 'chip';
}) {
  return (
    <span className="landing-marker">
      <span className="landing-marker__name">{entry.name}</span>
      {platformsOf(entry.framework).map(({ label, platform }) => (
        <Chip key={platform} platform={platform}>
          {label}
        </Chip>
      ))}
      {entry.workshop && status === 'chip' ? <Chip>unreleased</Chip> : null}
    </span>
  );
}

/**
 * The ribbon across a tile's corner for a package that is not on npm.
 *
 * Read at a glance without being read: a diagonal band on the one corner the
 * tile leaves empty. Quiet, on the ground's own colours -- the page's two
 * colour channels are the package hue and the platform chip, and a status is
 * neither. Derived from `workshop`, which repo-checks holds equal to
 * `private: true`, so it leaves the tile the day the package ships.
 */
function Ribbon({ entry }: { entry: DocumentedPackage }) {
  return entry.workshop ? (
    <span className="landing-ribbon">
      <span className="landing-ribbon__band">unreleased</span>
    </span>
  ) : null;
}

/**
 * The hero: what the site is, and every package on it.
 *
 * The index is the hero. A reader who knows what they want scans the tiles --
 * name, colour, stack -- and is one click away before scrolling. There is no
 * headline-and-two-buttons above it, because the buttons would only say "look
 * below", and the tiles are the thing a reader is looking for.
 */
export function Hero({ title, line }: { title: string; line: string }) {
  return (
    <div className="landing-hero">
      <div className="landing-hero__text">
        <Title as="h1" size="xl">
          {title}
        </Title>
        <Text size="md" measured>
          {line}
        </Text>
      </div>
      <ul className="landing-index" aria-label="Packages">
        {packages.map((entry) => (
          <li key={entry.name} className={`landing-tile ${identity(entry)}`}>
            <a className="landing-tile__link" href={href(entry)}>
              <Title as="h2" size="md">
                {entry.title}
              </Title>
              <Marker entry={entry} />
            </a>
            <Ribbon entry={entry} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Rendering from data: the two packages, the concept, and the demo.
 *
 * The packages come first, level with the heading, so a reader has the names
 * before the demonstration. One model in two runtimes, so the teasers carry
 * the name and the stack and nothing else: the section's own line explains
 * the concept once, and a paragraph each would say it twice more.
 *
 * The demo is the section. The concept is that a page is data and the library
 * renders it, and the only thing that proves that is data a reader can change
 * and a preview that follows. The editor opens on the same items the preview
 * first renders, serialised here on the server, so nothing moves at hydration.
 */
export function Pair({ group: id }: { group: string }) {
  const group = groupById(id);
  const lead = members(group)[0];

  return (
    <>
      <SectionHeader
        heading={
          <Title as="h2" size="lg">
            {group.title}
          </Title>
        }
        aside={
          <ul className="landing-teasers" aria-label={group.title}>
            {members(group).map((entry) => (
              <li key={entry.name} className={identity(entry)}>
                <a
                  className="landing-tile__link landing-teaser"
                  href={href(entry)}
                >
                  <Title as="h3" size="md">
                    {entry.title}
                  </Title>
                  <Marker entry={entry} status="chip" />
                </a>
              </li>
            ))}
          </ul>
        }
      />
      <Text measured>{group.line}</Text>
      {lead ? (
        <figure className={`landing-proof ${identity(lead)}`}>
          <DataDemo initial={listing(demoItems)} />
          <figcaption className="landing-proof__caption">
            Edit the items and the preview follows. A type the map does not know
            is reported, not rendered. This page is itself a {lead.title}{' '}
            region, built the same way.
          </figcaption>
        </figure>
      ) : null}
    </>
  );
}

/** The one line of what a package produces, in the package's own colour. */
function Specimen({ slug }: { slug: string }) {
  const segments = specimens[slug];
  if (!segments) return null;

  return (
    <p className="landing-specimen">
      {segments.map((segment, index) => (
        <span key={index} className={`landing-specimen__${segment.role}`}>
          {segment.text}
        </span>
      ))}
    </p>
  );
}

/**
 * Identifiers and codes: a card each, and a specimen on each.
 *
 * Three packages whose whole output is a short string, so the card leads with
 * the string. The grid takes exactly as many columns as the group has members,
 * which is what keeps three cards from rendering as two and an orphan.
 */
export function Cards({ group: id }: { group: string }) {
  const group = groupById(id);
  const entries = members(group);

  return (
    <>
      <SectionHeader
        heading={
          <Title as="h2" size="lg">
            {group.title}
          </Title>
        }
      />
      <Text measured>{group.line}</Text>
      <ul
        className="landing-cards"
        aria-label={group.title}
        style={{ '--landing-columns': entries.length } as React.CSSProperties}
      >
        {entries.map((entry) => (
          <li key={entry.name} className={identity(entry)}>
            <Card
              head={
                <Title as="h3" size="md">
                  <a className="landing-route__title" href={href(entry)}>
                    {entry.title}
                  </a>
                </Title>
              }
              foot={<Marker entry={entry} />}
            >
              <Specimen slug={entry.slug} />
              <Text size="sm">{description(entry.root)}</Text>
            </Card>
            <Ribbon entry={entry} />
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * On their own: a row each.
 *
 * Rows rather than cards, because the group's reason for existing is that its
 * members share nothing, and a list of rows reads as a list of separate things
 * where a grid of cards reads as a set. A row has no corner for a ribbon, so
 * the unreleased mark is a chip here.
 */
export function Rows({ group: id }: { group: string }) {
  const group = groupById(id);

  return (
    <>
      <SectionHeader
        heading={
          <Title as="h2" size="lg">
            {group.title}
          </Title>
        }
        aside={group.line}
      />
      <ul className="landing-rows" aria-label={group.title}>
        {members(group).map((entry) => (
          <li key={entry.name} className={`landing-row ${identity(entry)}`}>
            <Title as="h3" size="md">
              <a className="landing-route__title" href={href(entry)}>
                {entry.title}
              </a>
            </Title>
            <Text size="sm">{description(entry.root)}</Text>
            <Marker entry={entry} status="chip" />
          </li>
        ))}
      </ul>
    </>
  );
}

const elsewhere = [
  [
    'https://github.com/Evanion/libraries',
    'GitHub: issues, discussions, source',
  ],
  [
    'https://github.com/Evanion/libraries/blob/main/CONTRIBUTING.md',
    'Contributing',
  ],
  ['https://github.com/Evanion/libraries/blob/main/RELEASING.md', 'Releasing'],
  [
    'https://github.com/Evanion/libraries/blob/main/SECURITY.md',
    'Security policy',
  ],
] as const;

/** Where the rest of the project lives. */
export function Elsewhere() {
  return (
    <div className="landing-elsewhere">
      <Title as="h2" size="sm">
        Elsewhere
      </Title>
      <ul className="landing-elsewhere__links">
        {elsewhere.map(([url, label]) => (
          <li key={url}>
            <a className="landing-link" href={url}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
