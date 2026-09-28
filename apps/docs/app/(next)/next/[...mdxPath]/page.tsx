import ContentPage, {
  contentMetadata,
  contentPaths,
} from '../../../content-page';

/**
 * Every page under `/next/`: each package section as `main` has it.
 *
 * The content tree holds these under `content/next/`, and the route names the
 * `next` segment itself so that `(next)/layout.tsx`, whose sidebar is that tree
 * alone, is the layout above them. The page is handed the full content path,
 * `next` included, which is the path Nextra compiled it under.
 */
export async function generateStaticParams() {
  return (await contentPaths())
    .filter((mdxPath) => mdxPath[0] === 'next' && mdxPath.length > 1)
    .map((mdxPath) => ({ mdxPath: mdxPath.slice(1) }));
}

interface PageProps {
  params: Promise<{ mdxPath: string[] }>;
}

export async function generateMetadata({ params }: PageProps) {
  return contentMetadata(['next', ...(await params).mdxPath]);
}

export default async function Page({ params }: PageProps) {
  return <ContentPage mdxPath={['next', ...(await params).mdxPath]} />;
}
