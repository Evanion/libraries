/**
 * Ambient types for `.astro` imports.
 *
 * Apps get these from `astro sync`, which writes `.astro/types.d.ts` into the
 * project. A library has no Astro project to sync, so the one declaration the
 * tests need is written by hand.
 */
declare module '*.astro' {
  const Component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default Component;
}
