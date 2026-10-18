import { adoptDecisions, createFeatures } from '@evanion/feature';

export const VISITOR = { targetingKey: 'cust-0042', role: 'member' };

function store() {
  return createFeatures([
    {
      key: 'new-checkout',
      enabled: true,
      rules: [
        { id: 'members', when: [{ field: 'role', op: 'eq', value: 'member' }] },
      ],
    },
  ]);
}

/** The server's decisions for the visitor, as they arrive in the page: serialised and parsed. */
export function serverSet() {
  const set = store().snapshot(VISITOR);
  return JSON.parse(JSON.stringify(set)) as typeof set;
}

const paint = (enabled: boolean) => (enabled ? 'new' : 'old');

/** What the visitor ends up seeing. */
export function finalPaint(): 'old' | 'new' {
  return paint(store().resolve(VISITOR)['new-checkout'].enabled);
}

/**
 * The first paint. `adopted` is the browser adopting the server's set before it
 * renders. `client-only` stands for a page that renders before anything is
 * decided, so it paints the default (the old checkout) and swaps later.
 */
export function firstPaint(mode: 'client-only' | 'adopted'): 'old' | 'new' {
  if (mode === 'client-only') return 'old';
  return paint(
    adoptDecisions(store(), serverSet(), { context: VISITOR })['new-checkout']
      .enabled,
  );
}
