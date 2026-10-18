import { createFeatures } from '@evanion/feature';

/** The 24 visitors; three are booksellers. */
export const visitors = Array.from({ length: 24 }, (_, i) => {
  const id = `cust-${String(i + 1).padStart(4, '0')}`;
  return {
    id,
    bookseller: ['cust-0004', 'cust-0012', 'cust-0020'].includes(id),
  };
});

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
