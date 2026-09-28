import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { categoricalClass } from '@evanion/baize-ui/tokens';
import { useMDXComponents as getMDXComponents } from '../mdx-components';
import ReleaseNotice from '../components/ReleaseNotice';
import VersionSwitcher from '../components/VersionSwitcher';
import { releaseState } from './release-state';
import { packageFor, versionOptions, type Section } from './sections';
import { versionsOf } from './versions';

/**
 * One page of the content tree, rendered in the theme's frame.
 *
 * Two routes render it. `(site)/[...mdxPath]` owns every content path outside
 * `/next/`, and `(next)/next/[...mdxPath]` owns the ones inside it, each under
 * a layout whose sidebar is that tree. Both hand this the full content path,
 * `next` included, so everything here reads a route the same way from either.
 */

const listPages = generateStaticParamsFor('mdxPath');

/**
 * Every content path, as Nextra enumerates the MDX files under `content/`.
 *
 * `output: 'export'` has no server to render an unlisted route, so a page
 * missing from this list is missing from the deployed site. Nextra lists the
 * root route as an empty path, which neither route can take -- `/` is
 * `app/(home)/page.tsx`, the landing page -- so it is dropped here.
 */
export async function contentPaths(): Promise<string[][]> {
  return (await listPages())
    .map((entry) => [entry.mdxPath ?? []].flat())
    .filter((path) => path.length > 0 && path[0] !== '');
}

/**
 * The page's metadata, with the index directive its tree carries.
 *
 * The bare path is the canonical copy of a package's documentation: it is what
 * a reader on the release they installed wants, and what a search engine should
 * rank. `/next/` and a superseded line are kept out of the index and keep
 * `follow`, so the links on them still carry weight to the pages they point
 * at. No canonical link is set across versions, because their content differs.
 */
export async function contentMetadata(mdxPath: string[]) {
  const { metadata } = await importPage(mdxPath);
  const section = packageFor(mdxPath);

  return section && (section.next || section.segment)
    ? { ...metadata, robots: { index: false, follow: true } }
    : metadata;
}

/**
 * The theme's page frame: table of contents, breadcrumbs, edit link and footer.
 * Rendering MDX content without it produces the body of a docs page with none
 * of the chrome around it.
 */
const Wrapper = getMDXComponents().wrapper;

/**
 * The class that binds a page's package colour.
 *
 * A page in a package section belongs to that package whichever version of it
 * the route names, so `/urn/api`, `/urn/v1/api` and `/next/urn/api` all take
 * URN's colour: everything below it -- the title, the rule under it, the anchor
 * links -- reads `--baize-hue`. A page outside a package section gets no class
 * and falls back to the ground, which is what the library's own rules already
 * do.
 */
function identity(section: Section | null): string {
  return section ? `docs-identity ${categoricalClass(section.entry.hue)}` : '';
}

/**
 * The release notice for a page built from `main`, or nothing.
 *
 * It mounts here rather than in each MDX file, the way `WorkshopNotice` does,
 * because it says the same thing on every page of a section: written per page it
 * is forty chances to be left off a new one. It is for the pages that are
 * `main`'s -- everything under `/next/`, and a section with no version. A page
 * the generator serves for a release carries its own statement, an
 * `ArchiveNotice` under its title, which says which commit its values came
 * from.
 */
function releaseNotice(section: Section | null) {
  if (!section || !(section.next || section.entry.unversioned)) return null;

  const state = releaseState(section.entry.slug);
  const documented =
    section.next && versionsOf(section.entry.slug)?.current.from === 'cut';

  return state ? (
    <ReleaseNotice
      {...state}
      next={section.next}
      releaseHref={documented ? `/${section.entry.slug}/` : undefined}
    />
  ) : null;
}

/** The version switcher for a page in a versioned section, or nothing. */
function switcher(section: Section | null) {
  if (!section || section.entry.unversioned) return null;

  const versions = versionsOf(section.entry.slug);
  if (!versions) return null;

  return (
    <VersionSwitcher
      package={section.entry.name}
      options={versionOptions(section, versions)}
    />
  );
}

/**
 * Where the page's "edit this page" link goes.
 *
 * The theme builds it from the file the page was compiled from, and on the bare
 * path and on a release line that file is generated and in no commit. The page
 * a person edits is the one under `content/next/`, so the link goes there when
 * that page exists and is not offered when it does not.
 */
function editablePath(
  section: Section | null,
  filePath: string | undefined,
): string | undefined {
  if (!section || section.next || section.entry.unversioned) return filePath;

  const page = section.page.join('/');
  const versions = versionsOf(section.entry.slug);

  if (!versions?.next.pages.includes(page)) return undefined;

  return `content/next/${section.entry.slug}/${page === '' ? 'index' : page}.mdx`;
}

/**
 * The search filters the page is indexed under, one element each.
 *
 * `version` is `next` under `/next/`, the line's segment on a superseded line,
 * and `current` everywhere else, including the pages that belong to no package,
 * so the default query in `components/ScopedSearch.tsx` finds them. `pkg` names
 * the package a page documents.
 *
 * One element per filter because Pagefind reads one `key:value` pair from an
 * attribute: a comma-separated pair is indexed as a single value of the first
 * key, and a query for `version: current` then matches nothing on that page.
 * Inside the content wrapper, which is inside the element the theme marks
 * `data-pagefind-body`, so Pagefind reads it on every page it indexes.
 */
function searchFilters(section: Section | null) {
  const version = section?.next ? 'next' : (section?.segment ?? 'current');

  return (
    <>
      <span hidden data-pagefind-filter={`version:${version}`} />
      {section ? (
        <span hidden data-pagefind-filter={`pkg:${section.entry.slug}`} />
      ) : null}
    </>
  );
}

/** The page at a content path, in the theme's frame. */
export default async function ContentPage({ mdxPath }: { mdxPath: string[] }) {
  const {
    default: MDXContent,
    toc,
    metadata,
    sourceCode,
  } = await importPage(mdxPath);
  const section = packageFor(mdxPath);
  return (
    <Wrapper
      toc={toc}
      metadata={{
        ...metadata,
        filePath: editablePath(section, metadata.filePath),
      }}
      sourceCode={sourceCode}
    >
      <div className={identity(section)}>
        {searchFilters(section)}
        {switcher(section)}
        {releaseNotice(section)}
        <MDXContent params={{ mdxPath }} />
      </div>
    </Wrapper>
  );
}
