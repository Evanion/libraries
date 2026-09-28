import ContentPage, { contentMetadata, contentPaths } from '../../content-page';

/**
 * Every content page outside `/next/`: the released package sections, their
 * release lines, and the sections with no version.
 *
 * The segment is a required catch-all, `[...mdxPath]`, because `/` is
 * `app/(home)/page.tsx` -- the landing page, which is not an MDX document and
 * does not render inside the theme's article frame -- and Next refuses an
 * optional catch-all beside a page of the same specificity. The `/next/` tree is
 * `(next)/next/[...mdxPath]`'s, under its own sidebar, so it is left out here:
 * two routes listing one path fail the export.
 */
export async function generateStaticParams() {
  return (await contentPaths())
    .filter((mdxPath) => mdxPath[0] !== 'next')
    .map((mdxPath) => ({ mdxPath }));
}

interface PageProps {
  params: Promise<{ mdxPath: string[] }>;
}

export async function generateMetadata({ params }: PageProps) {
  return contentMetadata((await params).mdxPath);
}

export default async function Page({ params }: PageProps) {
  return <ContentPage mdxPath={(await params).mdxPath} />;
}
