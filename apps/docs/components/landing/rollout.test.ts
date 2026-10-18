import { describe, expect, it } from 'vitest';
import {
  buildFeatures,
  buildLane,
  crowd,
  describeVisitor,
  openingState,
  pageContext,
  pages,
  requestContext,
  tally,
  visitorIds,
} from './rollout';

const [brass, azul] = pages;

/** The percents the slider offers. */
const percents = Array.from({ length: 21 }, (_, step) => step * 5);

/** The ids of the visitors who see the new gallery. */
function litAt(percent: number, page = brass): string[] {
  return crowd(buildFeatures(percent), page)
    .filter((visitor) => visitor.gallery.enabled)
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
  it('answers the Azul page before deploy', () => {
    const entry = buildFeatures(25).plan(pageContext(azul))['new-gallery'];

    expect(entry.resolved).toBe(false);
    expect(buildLane(buildFeatures(25), azul)).toEqual({
      waits: false,
      settledOff: true,
    });
  });

  it('makes the Brass page wait for its visitors', () => {
    const entry = buildFeatures(25).plan(pageContext(brass))['new-gallery'];

    expect(entry.resolved).toBe('deferred');
    expect(entry.needs).toContain('targetingKey');
    expect(buildLane(buildFeatures(25), brass)).toEqual({
      waits: true,
      settledOff: false,
    });
  });

  it('never lets the percent change the plan', () => {
    for (const page of pages) {
      const first = buildFeatures(0).plan(pageContext(page));
      for (const percent of percents) {
        expect(buildFeatures(percent).plan(pageContext(page))).toEqual(first);
      }
    }
  });

  it('only ever adds visitors on Brass as the rollout widens', () => {
    let previous = new Set<string>();
    for (const percent of percents) {
      const now = new Set(litAt(percent));
      for (const id of previous) expect(now.has(id)).toBe(true);
      previous = now;
    }
  });

  it('lights nobody on Brass at 0% and everybody at 100%', () => {
    expect(litAt(0)).toEqual([]);
    expect(litAt(100)).toEqual([...visitorIds]);
  });

  it('never lights anybody on Azul', () => {
    for (const percent of percents) {
      expect(litAt(percent, azul)).toEqual([]);
    }
  });

  it('opens on Brass at 25% with some visitors lit and some not', () => {
    expect(openingState).toEqual({ page: 'brass', percent: 25 });
    const lit = litAt(openingState.percent).length;
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(visitorIds.length);
    expect(litAt(25)).toEqual(litAt(25));
  });

  it('answers each visitor exactly as a direct resolve does', () => {
    const direct = buildFeatures(40);

    for (const page of pages) {
      for (const visitor of crowd(buildFeatures(40), page)) {
        expect(visitor.gallery).toEqual(
          direct.resolve(requestContext(page, visitor.id))['new-gallery'],
        );
      }
    }
  });

  it('describes a visitor in plain words', () => {
    const none = crowd(buildFeatures(0), brass);

    expect(describeVisitor(none[0]!)).toBe(
      'Visitor cust-0001 sees the old gallery',
    );
    expect(tally(crowd(buildFeatures(100), brass))).toBe(visitorIds.length);
  });
});
