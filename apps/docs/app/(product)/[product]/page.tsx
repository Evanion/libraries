import { ProductPageView } from '../../../components/product/ProductPageView';
import {
  productJsonLd,
  productMetadata,
} from '../../../components/product/metadata';
import { regionCode } from '../../../components/product/region';
import { productBySlug, products } from '../../../components/product/registry';

export const dynamicParams = false;

export function generateStaticParams() {
  return products.map((p) => ({ product: p.slug }));
}

interface Props {
  params: Promise<{ product: string }>;
}

export async function generateMetadata({ params }: Props) {
  return productMetadata(productBySlug((await params).product));
}

export default async function Page({ params }: Props) {
  const page = productBySlug((await params).product);
  const code = regionCode(page.codeSample.file, page.codeSample.region);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd(page)),
        }}
      />
      <ProductPageView page={page} code={code} />
    </>
  );
}
