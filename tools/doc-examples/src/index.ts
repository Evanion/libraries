export {
  ExpectCommentError,
  readValueClaim,
  rewriteJsDoc,
  rewriteLine,
  rewriteMarkdown,
} from './expect-comments.ts';
export type { ValueClaim } from './expect-comments.ts';
export {
  DeclarationError,
  commentText,
  internalMark,
  readReference,
  resolveAlias,
} from './declarations.mjs';
export type { ExportKind, Reference } from './declarations.mjs';
export { expandReferences } from './mdx-reference-loader.mjs';
export { mdSiblings } from './md-siblings.mjs';
export {
  PREAMBLE_FILE,
  preamblePath,
  readPreamble,
  withPreamble,
  writesOwnImports,
} from './preamble.mjs';
export { RegionError, parseRegions, readRegion } from './regions.mjs';
export type { Region } from './regions.mjs';
export { expectComments } from './vite-plugin.ts';
export { docExampleSources, docExamples } from './vite-config.ts';
