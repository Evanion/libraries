/**
 * Types for `behaviours.mjs`.
 *
 * That module is plain JavaScript for the reason `regions.d.mts` gives: the
 * docs app's build steps import it, and Nx loads `next.config.ts` under Node's
 * native type stripping while building the project graph.
 */

/** One case, or one block of generated cases, as the chain above it. */
export interface Chain {
  /** The `describe` titles above the case, outermost first, ending in its own. */
  chain: string[];
  /**
   * Whether this stands for a block of cases whose titles the runner computes
   * per row, in which case the chain ends at the `describe` naming what they
   * are about.
   */
  generated: boolean;
}

/** What a package's tests state, keyed by the name each `describe` spells. */
export interface Behaviours {
  /** The test sources the chains were read from. */
  files: string[];
  states: Map<string, Map<string, Chain>>;
}

export declare function testFilesOf(packageRoot: string): string[];
export declare function chainsOf(path: string): Chain[];
export declare function behavioursOf(packageRoot: string): Behaviours;
export declare function describedBy(packageRoot: string): Set<string>;
