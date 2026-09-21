/**
 * Types for `declarations.mjs`.
 *
 * That module is plain JavaScript for the reason `regions.d.mts` gives: the
 * docs app's MDX loaders import it, and Nx loads `next.config.ts` under Node's
 * native type stripping while building the project graph.
 */

import type ts from 'typescript';

/** What an export is, as the reference page classifies it. */
export type ExportKind =
  'error' | 'class' | 'function' | 'constant' | 'interface' | 'typeAlias';

/** One export, as a reference entry needs it. */
export interface Reference {
  name: string;
  specifier: string;
  kind: ExportKind;
  /** The declaration the package published, with the imports it names. */
  signature: {
    text: string;
    values: string[];
    types: string[];
  } | null;
  /** The docblock's first paragraph. */
  summary: string;
  /** Everything after the first paragraph. */
  rest: string;
  tags: { name: string; text: string }[];
  /** The declaration file the entry was read from. */
  declaration: string;
  /** The package's README, workspace relative. */
  readme: string;
}

export declare class DeclarationError extends Error {}

export declare function commentText(
  comment: string | ts.NodeArray<ts.JSDocComment> | undefined,
): string;

export declare function resolveAlias(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): ts.Symbol;

export declare function internalMark(
  symbol: ts.Symbol,
  resolved: ts.Symbol,
  checker: ts.TypeChecker,
): string | null;

export declare function readReference(
  root: string,
  specifier: string,
  name: string,
): Reference;
