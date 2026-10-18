import {
  createFeatures,
  type Decision,
  type EvaluationContext,
} from '@evanion/feature';

/**
 * The document behind the feature-flag demonstration, and the two places it is
 * decided: the build and the request.
 *
 * Three flags for the shop. `gift-cards` is on for everyone, `new-checkout` is
 * on for a share of visitors, and `express-pickup` depends on `new-checkout`.
 * Every answer on the page comes from `plan()` and `resolve()` on a store built
 * here by `createFeatures`; `FeatureDemo` renders them and decides nothing.
 * `rollout.test.ts` holds the lanes to direct calls on the same store.
 *
 * Shared by the server, which renders the opening state, and the client island,
 * which renders every state after it.
 */

/** The flags of the document, in the order it declares them. */
export const flagKeys = [
  'gift-cards',
  'new-checkout',
  'express-pickup',
] as const;

/** One flag of the document. */
export type FlagKey = (typeof flagKeys)[number];

/** The two values the reader edits. */
export interface RolloutState {
  /** The `enabled` switch of `new-checkout`. */
  checkoutOn: boolean;
  /** The `percent` of its rollout, 0 to 100. */
  percent: number;
}

/** What the demonstration opens on. */
export const openingState: RolloutState = { checkoutOn: true, percent: 25 };

/** The rule that carries the rollout, named so a decision can report it. */
const RAMP = 'ramp';

/** The document as a store, built the way the package's docs build one. */
export function buildFeatures({ checkoutOn, percent }: RolloutState) {
  return createFeatures([
    { key: 'gift-cards', enabled: true },
    {
      key: 'new-checkout',
      enabled: checkoutOn,
      rules: [{ id: RAMP, rollout: { percent, by: 'targetingKey' } }],
    },
    { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
  ]);
}

/** The store `buildFeatures` returns. */
export type Store = ReturnType<typeof buildFeatures>;

/**
 * What a static build knows: the game page it is rendering, and no visitor.
 *
 * A build renders one page per game, so the game is known and the person is
 * not. That absence is what defers a rollout.
 */
export const buildContext: EvaluationContext = { game: 'urn:game:azul' };

/** One flag as the build leaves it. */
export interface BuildFlag {
  key: FlagKey;
  /** `deferred` when the request has to decide it. */
  status: 'on' | 'off' | 'deferred';
  /** The context fields the request must supply, when `status` is `deferred`. */
  needs: readonly string[];
}

/** `plan()` against the build context, one entry per flag. */
export function buildLane(store: Store): BuildFlag[] {
  const plan = store.plan(buildContext);
  return flagKeys.map((key) => {
    const entry = plan[key];
    return {
      key,
      status:
        entry.resolved === 'deferred'
          ? 'deferred'
          : entry.resolved
            ? 'on'
            : 'off',
      needs: entry.needs,
    };
  });
}

/** The 24 visitors the request lane decides for, by their targeting key. */
export const visitorIds: readonly string[] = Array.from(
  { length: 24 },
  (_, index) => `cust-${String(index + 1).padStart(4, '0')}`,
);

/** One visitor and what the document decided for them on this request. */
export interface Visitor {
  id: string;
  checkout: Decision;
  pickup: Decision;
}

/** `resolve()` once per visitor, with that visitor's id as the targeting key. */
export function crowd(store: Store): Visitor[] {
  return visitorIds.map((id) => {
    const decisions = store.resolve({ targetingKey: id });
    return {
      id,
      checkout: decisions['new-checkout'],
      pickup: decisions['express-pickup'],
    };
  });
}

/** How many visitors have the new checkout, and how many of those pick up. */
export function tally(visitors: readonly Visitor[]): {
  checkout: number;
  pickup: number;
} {
  return {
    checkout: visitors.filter((visitor) => visitor.checkout.enabled).length,
    pickup: visitors.filter((visitor) => visitor.pickup.enabled).length,
  };
}

/** A decision as one phrase: its reason, and what the reason carries. */
function phrase(decision: Decision): string {
  if (decision.reason === 'dependency-off') {
    return `dependency-off · blocked by ${decision.blockedBy}`;
  }
  const rollout = decision.rules?.find((outcome) => outcome.rollout)?.rollout;
  if (decision.reason === 'no-rule-matched' && rollout?.bucket !== undefined) {
    return `no-rule-matched · bucket ${(rollout.bucket * 100).toFixed(1)} is not below ${rollout.percent}`;
  }
  return decision.reason;
}

/** What a visitor's dot says on hover, on focus and to a screen reader. */
export function describeVisitor(visitor: Visitor): string {
  const checkout = visitor.checkout.enabled ? 'on' : 'off';
  const pickup = visitor.pickup.enabled ? 'on' : 'off';
  return `${visitor.id}: new-checkout ${checkout} (${phrase(visitor.checkout)}); express-pickup ${pickup} (${phrase(visitor.pickup)})`;
}

/** A run of the document's text, or a value the reader changes. */
export type Segment = { text: string } | { value: 'enabled' | 'percent' };

/**
 * `buildFeatures` as text, with the two values the controls change left open.
 *
 * The component fills each `value` with the current state and marks it, so the
 * reader sees which words of the document the switch and the slider write.
 */
export const source: readonly (readonly Segment[])[] = [
  [{ text: 'createFeatures([' }],
  [{ text: "  { key: 'gift-cards', enabled: true }," }],
  [{ text: "  { key: 'new-checkout'," }],
  [{ text: '    enabled: ' }, { value: 'enabled' }, { text: ',' }],
  [
    { text: "    rules: [{ id: 'ramp', rollout: { percent: " },
    { value: 'percent' },
    { text: ", by: 'targetingKey' } }] }," },
  ],
  [
    {
      text: "  { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },",
    },
  ],
  [{ text: '])' }],
];
