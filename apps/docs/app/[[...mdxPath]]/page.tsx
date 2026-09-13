import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { categoricalClass } from '@evanion/baize-ui/tokens';
import { useMDXComponents as getMDXComponents } from '../../mdx-components';
import { packages } from '../navigation';

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

/**
 * The class that binds a page's package colour, from the first path segment.
 *
 * A page under `content/urn/` is a URN page, which is the only thing the route
 * knows and all this needs: everything below it -- the title, the rule under it,
 * the anchor links -- reads `--baize-hue` and takes the package's colour. The
 * landing page and anything outside a package section get no class and fall back
 * to the ground, which is what the library's own rules already do.
 */
function identity(mdxPath: string[] | undefined): string {
  const entry = packages.find((item) => item.slug === mdxPath?.[0]);

  return entry ? `docs-identity ${categoricalClass(entry.hue)}` : '';
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
      <div className={identity(params.mdxPath)}>
        <MDXContent {...props} params={params} />
      </div>
    </Wrapper>
  );
}
