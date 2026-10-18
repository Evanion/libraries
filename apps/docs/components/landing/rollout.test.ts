import { describe, expect, it } from 'vitest';
import {
  buildContext,
  buildFeatures,
  buildLane,
  crowd,
  describeVisitor,
  flagKeys,
  openingState,
  tally,
  visitorIds,
  type RolloutState,
} from './rollout';

/** The percents the slider offers, and both switch positions. */
const percents = Array.from({ length: 21 }, (_, step) => step * 5);

/** The ids of the visitors the new checkout is on for. */
function litAt(state: RolloutState): string[] {
  return crowd(buildFeatures(state))
    .filter((visitor) => visitor.checkout.enabled)
    .map((visitor) => visitor.id);
}

/**
 * The lanes are the package's answers.
 *
 * Every value the demonstration shows was produced by `plan()` or `resolve()`
 * on the real store, so these tests drive the same functions and hold what the
 * page would render to what the package says.
 */
describe('the feature-flag demonstration', () => {
  it('only ever adds visitors as the rollout widens', () => {
    let previous = new Set<string>();
    for (const percent of percents) {
      const now = new Set(litAt({ checkoutOn: true, percent }));
      for (const id of previous) expect(now.has(id)).toBe(true);
      previous = now;
    }
  });

  it('lights nobody at 0% and everybody at 100%', () => {
    expect(litAt({ checkoutOn: true, percent: 0 })).toEqual([]);
    expect(litAt({ checkoutOn: true, percent: 100 })).toEqual([...visitorIds]);
  });

  it('opens with some visitors lit and some not', () => {
    const lit = litAt(openingState).length;
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(visitorIds.length);
  });

  it('settles both dependent flags off at build when the switch is off', () => {
    const store = buildFeatures({ checkoutOn: false, percent: 60 });
    const lane = buildLane(store);

    expect(lane.find((flag) => flag.key === 'new-checkout')?.status).toBe(
      'off',
    );
    expect(lane.find((flag) => flag.key === 'express-pickup')?.status).toBe(
      'off',
    );
  });

  it('blocks express pickup for every visitor when the switch is off', () => {
    const visitors = crowd(buildFeatures({ checkoutOn: false, percent: 100 }));

    for (const visitor of visitors) {
      expect(visitor.checkout.enabled).toBe(false);
      expect(visitor.pickup.reason).toBe('dependency-off');
      expect(visitor.pickup.blockedBy).toBe('new-checkout');
    }
  });

  it('defers both flags to the request when the switch is on', () => {
    const lane = buildLane(buildFeatures(openingState));

    for (const key of ['new-checkout', 'express-pickup'] as const) {
      const flag = lane.find((entry) => entry.key === key);
      expect(flag?.status).toBe('deferred');
      expect(flag?.needs).toContain('targetingKey');
    }
  });

  it('bakes gift cards in at build in every state', () => {
    for (const checkoutOn of [true, false]) {
      for (const percent of [0, 25, 100]) {
        const lane = buildLane(buildFeatures({ checkoutOn, percent }));
        expect(lane.find((flag) => flag.key === 'gift-cards')?.status).toBe(
          'on',
        );
      }
    }
  });

  it('lists every flag of the document in the build lane', () => {
    expect(
      buildLane(buildFeatures(openingState)).map((flag) => flag.key),
    ).toEqual([...flagKeys]);
  });

  it('answers each visitor exactly as a direct resolve does', () => {
    const state = { checkoutOn: true, percent: 40 };
    const store = buildFeatures(state);
    const direct = buildFeatures(state);

    for (const visitor of crowd(store)) {
      const decisions = direct.resolve({ targetingKey: visitor.id });
      expect(visitor.checkout).toEqual(decisions['new-checkout']);
      expect(visitor.pickup).toEqual(decisions['express-pickup']);
    }
  });

  it('answers the build lane exactly as a direct plan does', () => {
    const store = buildFeatures(openingState);
    const plan = store.plan(buildContext);

    expect(buildLane(store).map((flag) => flag.needs)).toEqual(
      flagKeys.map((key) => plan[key].needs),
    );
  });

  it('gives a visitor outside the rollout a reason that names the bucket', () => {
    const visitors = crowd(buildFeatures({ checkoutOn: true, percent: 5 }));
    const out = visitors.find((visitor) => !visitor.checkout.enabled)!;

    expect(out.checkout.reason).toBe('no-rule-matched');
    expect(describeVisitor(out)).toContain('no-rule-matched');
    expect(describeVisitor(out)).toContain('blocked by new-checkout');
  });

  it('counts what the dots show', () => {
    const visitors = crowd(buildFeatures({ checkoutOn: true, percent: 100 }));

    expect(tally(visitors)).toEqual({
      checkout: visitorIds.length,
      pickup: visitorIds.length,
    });
  });
});
