import {
  ButtonLink,
  Card,
  Chip,
  SectionHeader,
  Text,
  Title,
} from '@evanion/baize-ui';
import { categoricalClass } from '@evanion/baize-ui/tokens';
import type { ReactNode } from 'react';
import {
  groups,
  packages,
  readmeUrl,
  type DocumentedPackage,
  type PackageGroup,
} from '../../app/navigation';
import { listing } from './listing';
import { description } from './manifest';
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
 * and the stack it runs in. Plus `unreleased`, which is a chip because it
 * changes what a reader can do -- there is nothing on npm to install.
 */
function Marker({ entry }: { entry: DocumentedPackage }) {
  return (
    <span className="landing-marker">
      <span className="landing-marker__name">{entry.name}</span>
      <span className="landing-marker__stack">{entry.framework}</span>
      {entry.workshop ? <Chip>unreleased</Chip> : null}
    </span>
  );
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
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One item's JSON with three kinds of token told apart by colour: keys in the
 * reading colour, strings in the package's hue, punctuation and numbers in the
 * quiet one. A tokenizer of JSON and nothing else, which is all an item is
 * once serialised.
 */
function Tokens({ source }: { source: string }) {
  const tokens = source.split(/("(?:[^"\\]|\\.)*"\s*:?)/);

  return tokens.map((token, index) => {
    if (index % 2 === 0) return token;
    const key = token.trimEnd().endsWith(':');
    return (
      <span
        key={index}
        className={key ? 'landing-listing__key' : 'landing-listing__string'}
      >
        {token}
      </span>
    );
  });
}

/**
 * The page's items, as the array they are.
 *
 * Each item is its own block so the stylesheet can flow the array into two
 * columns beside the card it stands next to: five items one under the other
 * are twice the height of anything they could sit beside, and a listing a
 * reader has to scroll is not one they take in at a glance. The brackets and
 * the commas are still there, because it is still the array.
 */
function Listing({ items }: { items: readonly unknown[] }) {
  return (
    <pre className="landing-listing__code">
      <span className="landing-listing__bracket">[</span>
      {items.map((item, index) => (
        <code key={index} className="landing-listing__item">
          <Tokens source={listing(item, '  ')} />
          {index < items.length - 1 ? ',' : ''}
        </code>
      ))}
      <span className="landing-listing__bracket">]</span>
    </pre>
  );
}

/**
 * Rendering from data: the pair of widget renderers, and the proof.
 *
 * One model in two runtimes, so one description and a route into each -- two
 * cards side by side said nothing about the relationship. Beside it, the
 * `items` array this page was rendered from, because the page is a
 * `@evanion/react-widget` region and the section describing that library is
 * the place to show it.
 */
export function Pair({
  group: id,
  ctx,
}: {
  group: string;
  ctx?: Record<string, unknown>;
}) {
  const group = groupById(id);
  const items = Array.isArray(ctx?.items) ? ctx.items : [];
  const lead = members(group)[0];

  return (
    <>
      <SectionHeader
        heading={
          <Title as="h2" size="lg">
            {group.title}
          </Title>
        }
      />
      <div className="landing-pair">
        <Card>
          <Text measured>{group.line}</Text>
          <ul className="landing-routes" aria-label={group.title}>
            {members(group).map((entry) => (
              <li key={entry.name} className={identity(entry)}>
                <Title as="h3" size="md">
                  <a className="landing-route__title" href={href(entry)}>
                    {entry.title}
                  </a>
                </Title>
                <Marker entry={entry} />
                <ButtonLink href={href(entry)}>Read the manual</ButtonLink>
              </li>
            ))}
          </ul>
        </Card>
        {lead ? (
          <figure className={`landing-listing ${identity(lead)}`}>
            <figcaption className="landing-listing__caption">
              This page is a {lead.title} region. These are its items, as the
              page was rendered from them.
            </figcaption>
            <Listing items={items} />
          </figure>
        ) : null}
      </div>
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
 * where a grid of cards reads as a set.
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
            <Marker entry={entry} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Elsewhere({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <a className="landing-link" href={href}>
        {children}
      </a>
    </li>
  );
}

/** How the pages work, and where the rest of the project lives. */
export function Colophon() {
  return (
    <div className="landing-colophon">
      <div>
        <Title as="h2" size="sm">
          Reading these pages
        </Title>
        <Text size="sm" measured>
          Each package has an overview and then as many pages as its surface
          needs. They assume the package is installed. Every value stated in an
          example was produced by running the package. Some examples are pulled
          out of the package&apos;s README at build time, and the README runs
          them as tests.
        </Text>
      </div>
      <div>
        <Title as="h2" size="sm">
          Elsewhere
        </Title>
        <ul className="landing-elsewhere">
          <Elsewhere href="https://github.com/Evanion/libraries">
            GitHub: issues, discussions, source
          </Elsewhere>
          <Elsewhere href="https://github.com/Evanion/libraries/blob/main/CONTRIBUTING.md">
            Contributing
          </Elsewhere>
          <Elsewhere href="https://github.com/Evanion/libraries/blob/main/RELEASING.md">
            Releasing
          </Elsewhere>
          <Elsewhere href="https://github.com/Evanion/libraries/blob/main/SECURITY.md">
            Security policy
          </Elsewhere>
        </ul>
      </div>
    </div>
  );
}
