/**
 * Types for `mdx-reference-loader.mjs`.
 *
 * That module is plain JavaScript for the reason `regions.d.mts` gives: the
 * docs app's MDX loaders import it, and Nx loads `next.config.ts` under Node's
 * native type stripping while building the project graph.
 */

import type { Reference } from './declarations.d.mts';

export declare function expandReferences(
  source: string,
  root: string,
  file: string,
  read?: (root: string, specifier: string, name: string) => Reference,
  onResolve?: (reference: Reference) => void,
): string;
