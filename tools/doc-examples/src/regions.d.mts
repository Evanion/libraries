/**
 * Types for `regions.mjs`.
 *
 * That module is plain JavaScript because `apps/docs/next.config.ts` imports
 * it, and Nx loads that config under Node's native type stripping while
 * building the project graph. A TypeScript import there fails to load.
 */

export interface Region {
  /** The fence's language, for the code block the docs app renders. */
  lang: string;
  /** The code between the fences, with the doctest marker already gone. */
  code: string;
}

export declare class RegionError extends Error {
  constructor(message: string);
}

export declare function parseRegions(
  source: string,
  file: string,
): Map<string, Region>;

export declare function readRegion(
  source: string,
  file: string,
  name: string,
): Region;
