/**
 * Types for `mdx-reference-loader.mjs`.
 *
 * That module is plain JavaScript for the reason `regions.d.mts` gives: the
 * docs app's MDX loaders import it, and Nx loads `next.config.ts` under Node's
 * native type stripping while building the project graph.
 */

import type { Chain } from './behaviours.d.mts';
import type { Reference } from './declarations.d.mts';

/** One package's stated behaviours, as `docs:behaviour-data` writes them. */
export interface StatedFile {
  package: string;
  files: string[];
  states: Record<string, Chain[]>;
}

/** What one entry lists: the loose sentences, then the conditions. */
export interface Stated {
  loose: string[];
  conditions: [string, string[]][];
  /** How many sentences the entry shows, which is what its count says. */
  stated: number;
}

export declare function behaviourPath(
  root: string,
  reference: Reference,
): string;

export declare function statedBy(behaviours: StatedFile, name: string): Stated;

export declare function expandReferences(
  source: string,
  root: string,
  file: string,
  read?: (root: string, specifier: string, name: string) => Reference,
  onResolve?: (reference: Reference, behaviours: StatedFile) => void,
): string;
