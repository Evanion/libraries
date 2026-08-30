import type { BlockRegistry } from './types';

/**
 * Identity function that pins the registry's key union for editors and for
 * `validateBlocks`. It does no work at runtime by design.
 */
export function defineBlocks<M extends BlockRegistry>(map: M): M {
  return map;
}
