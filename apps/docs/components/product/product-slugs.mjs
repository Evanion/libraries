/**
 * The URL segment of every product page, in registry order.
 *
 * Plain ESM so the docs link check in tools/repo-checks can read it: the
 * product route is dynamic (`app/(product)/[product]`), and a link check that
 * walks route directories sees no segment there. `registry.test.ts` holds
 * this list to the registry's definitions.
 */
export const productSlugs = ['feature-flags', 'authorization', 'rendering'];
