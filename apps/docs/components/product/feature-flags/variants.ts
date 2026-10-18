import { createFeatures } from '@evanion/feature';
import { crowdIds } from '../primitives/crowd';

/** Every eighth visitor from `cust-0004` is a bookseller. */
const BOOKSELLER_EVERY = 8;
const FIRST_BOOKSELLER_INDEX = 3;

/** The crowd, with the booksellers marked. */
export const visitors = crowdIds.map((id, index) => ({
  id,
  bookseller: index % BOOKSELLER_EVERY === FIRST_BOOKSELLER_INDEX,
}));

/** How many of the crowd are booksellers. */
export const booksellerCount = visitors.filter((v) => v.bookseller).length;

/**
 * The document: a two-way split of the checkout button. With `pinned`, booksellers
 * always get blue. Rules are OR-ed, so the pin sits beside a rule every visitor
 * matches, or the feature would turn off for everyone else.
 */
export function variantStore(blueWeight: number, pinned: boolean) {
  return createFeatures([
    {
      key: 'checkout-cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 100 - blueWeight, order: 0 },
        { name: 'blue', weight: blueWeight, order: 1 },
      ],
      ...(pinned
        ? {
            rules: [
              {
                id: 'booksellers',
                when: [{ field: 'role', op: 'eq', value: 'bookseller' }],
                variant: 'blue',
              },
              { id: 'everyone', rollout: { percent: 100, by: 'targetingKey' } },
            ],
          }
        : {}),
    },
  ]);
}

/** Each visitor's variant at a split. */
export function assign(
  blueWeight: number,
  pinned: boolean,
): Record<string, 'control' | 'blue'> {
  const store = variantStore(blueWeight, pinned);
  return Object.fromEntries(
    visitors.map((v) => [
      v.id,
      store.resolve({
        targetingKey: v.id,
        role: v.bookseller ? 'bookseller' : 'customer',
      })['checkout-cta'].variant as 'control' | 'blue',
    ]),
  );
}

/** The visitors whose variant differs between two assignments. */
export function moved(
  a: Record<string, string>,
  b: Record<string, string>,
): string[] {
  return Object.keys(a).filter((id) => a[id] !== b[id]);
}
