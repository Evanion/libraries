import type { PageMapItem } from 'nextra';
import { getPageMap } from 'nextra/page-map';
import { packageFor } from './sections';

/**
 * The page map the chrome outside `/next/` reads for a route: the content tree
 * without `next`, whose pages are `(next)`'s under a sidebar of their own.
 *
 * On a page of a release line, the section's folder is the line's. A line is a
 * directory inside its section, so the whole tree lists the release's pages
 * under the section, and the sidebar, the breadcrumbs and the pager built from
 * it would take a reader on `/urn/v1/` to `/urn/api/`: the newest release's
 * page, under the notice of an older one. The line's folder keeps the
 * section's name, which is the key `content/_meta.ts` titles it by.
 *
 * `mdxPath` is empty for a route in no section, which is served the whole tree.
 */
export async function sitePageMap(
  mdxPath: readonly string[],
): Promise<PageMapItem[]> {
  const tree = (await getPageMap()).filter(
    (item) => !('name' in item && item.name === 'next'),
  );
  const section = packageFor(mdxPath);

  if (!section?.segment) return tree;

  return tree.map((item) => {
    if (!('children' in item) || item.name !== section.entry.slug) return item;

    const line = item.children.find(
      (child) => 'children' in child && child.name === section.segment,
    );

    return line ? { ...line, name: item.name } : item;
  });
}
