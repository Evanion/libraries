import type { Metadata } from 'next';
import { packages } from '../../app/navigation';
import type { ProductPage } from './types';

export const ORIGIN = 'https://libs.evanion.com';
const REPOSITORY = 'https://github.com/Evanion/libraries/tree/main';

/** The tab title: the page's own wording, then the package it is about. */
const titleOf = (page: ProductPage) =>
  `${page.metadata.title} | ${page.packageName}`;

const urlOf = (page: ProductPage) => `${ORIGIN}/${page.slug}/`;

export function productMetadata(page: ProductPage): Metadata {
  return {
    title: { absolute: titleOf(page) },
    description: page.metadata.description,
    alternates: { canonical: urlOf(page) },
    openGraph: {
      type: 'website',
      title: titleOf(page),
      description: page.metadata.description,
      url: urlOf(page),
    },
  };
}

export function productJsonLd(page: ProductPage): Record<string, unknown> {
  const entry = packages.find((p) => p.name === page.packageName);
  if (!entry)
    throw new Error(`No package in navigation.ts is named ${page.packageName}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: page.packageName,
    description: page.metadata.description,
    url: urlOf(page),
    codeRepository: `${REPOSITORY}/${entry.root}`,
    programmingLanguage: 'TypeScript',
    license: 'https://opensource.org/licenses/MIT',
  };
}
