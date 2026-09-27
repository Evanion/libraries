import { describe, expectTypeOf, it } from 'vitest';

/**
 * Proves the typecheck harness runs. A deliberately wrong assertion here fails
 * the suite, and the same assertion in a tree with no `test.typecheck` block
 * passes, which is the failure `libs/urn/vite.config.ts` records.
 */
describe('the typecheck harness', () => {
  it('reads a string as a string', () => {
    expectTypeOf<string>().toEqualTypeOf<string>();
  });
});
