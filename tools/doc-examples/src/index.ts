export {
  ExpectCommentError,
  rewriteJsDoc,
  rewriteLine,
  rewriteMarkdown,
} from './expect-comments.ts';
export { RegionError, parseRegions, readRegion } from './regions.mjs';
export type { Region } from './regions.mjs';
export { expectComments } from './vite-plugin.ts';
export { docExampleSources, docExamples } from './vite-config.ts';
