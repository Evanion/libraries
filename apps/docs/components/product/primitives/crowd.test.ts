import { describe, expect, it } from 'vitest';
import { buildFeatures, crowd, pages, tally } from '../../landing/rollout';
import { CROWD_SIZE, crowdIds } from './crowd';

const SLIDER_STEPS = [10, 25, 50, 75, 90];
const TOLERANCE_POINTS = 6;

describe('the demo crowd', () => {
  it('has CROWD_SIZE distinct ids', () => {
    expect(crowdIds).toHaveLength(CROWD_SIZE);
    expect(new Set(crowdIds).size).toBe(CROWD_SIZE);
  });

  it.each(SLIDER_STEPS)(
    'puts a share within 6 points of the %i%% slider',
    (percent) => {
      const lit = tally(crowd(buildFeatures(percent), pages[0]));
      const share = (lit / CROWD_SIZE) * 100;
      expect(Math.abs(share - percent)).toBeLessThanOrEqual(TOLERANCE_POINTS);
    },
  );
});
