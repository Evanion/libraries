/**
 * Types for `md-siblings.mjs`.
 *
 * That module is plain JavaScript for the reason `regions.d.mts` gives: it
 * shares a module graph with the Turbopack loader, which Nx loads under Node's
 * native type stripping.
 */

export declare function mdSiblings(
  contentDir: string,
  root: string,
): Map<string, string>;
