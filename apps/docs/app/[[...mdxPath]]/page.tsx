import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents as getMDXComponents } from '../../mdx-components';

/**
 * Enumerates one route per MDX file under `content/`.
 *
 * `output: 'export'` in next.config.ts has no server to render an unlisted
 * route, so a page missing from this list is missing from the deployed site.
 */
export const generateStaticParams = generateStaticParamsFor('mdxPath');

interface GenerateMetadataProps {
  params: Promise<{ mdxPath: string[] }>;
}

export async function generateMetadata(props: GenerateMetadataProps) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath);
  return metadata;
}

/**
 * The theme's page frame: table of contents, breadcrumbs, edit link and footer.
 * Rendering MDX content without it produces the body of a docs page with none
 * of the chrome around it.
 */
const Wrapper = getMDXComponents().wrapper;

interface PageProps {
  params: Promise<{ mdxPath: string[] }>;
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const {
    default: MDXContent,
    toc,
    metadata,
    sourceCode,
  } = await importPage(params.mdxPath);
  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
