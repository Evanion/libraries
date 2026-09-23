/**
 * Types for `mdx-reference-loader.mjs`.
 *
 * That module is plain JavaScript for the reason `regions.d.mts` gives: the
 * docs app's MDX loaders import it, and Nx loads `next.config.ts` under Node's
 * native type stripping while building the project graph.
 */

import type { Reference } from './declarations.d.mts';

/** One sentence the index carries, without the case behind it. */
export interface StatedChain {
  chain: string[];
  generated: boolean;
  /** What the sidecar keys this case's source by. */
  id: number;
}

/** One package's stated behaviours, as `docs:behaviour-data` writes them. */
export interface StatedFile {
  package: string;
  files: string[];
  states: Record<string, StatedChain[]>;
}

/** One row of the rail: a test's own name, and the case behind it. */
export interface StatedRow {
  title: string;
  id: number;
}

/** The sentences under one `describe` the suite wrote. */
export interface StatedGroup {
  label: string;
  rows: StatedRow[];
}

/** What one entry lists, grouped the way the suite wrote it. */
export interface Stated {
  groups: StatedGroup[];
  /** How many sentences the entry shows, which is what its count says. */
  stated: number;
}

export declare function behaviourPath(
  root: string,
  reference: Reference,
): string;

export declare function libraryOf(reference: Reference): string;

export declare function statedBy(behaviours: StatedFile, name: string): Stated;

export declare function expandReferences(
  source: string,
  root: string,
  file: string,
  read?: (root: string, specifier: string, name: string) => Reference,
  onResolve?: (reference: Reference, behaviours: StatedFile) => void,
): string;
