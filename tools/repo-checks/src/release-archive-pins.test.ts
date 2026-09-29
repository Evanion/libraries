import { describe, expect, it } from 'vitest';
import { type Step, stepsOf } from './workflows';

/**
 * The invariant: a release run brings `apps/docs/archives.json` up to the tags
 * it pushed, and publishes whether or not that succeeds.
 *
 * `apps/docs/tools/cut-releases.mjs` drops the pins a new x.y.0 made dead and
 * seeds a release that shipped no pages. The pin check in `docs-archive.test.ts`
 * fails every pull request until it has run, so `.github/workflows/release.yml`
 * runs it between the step that pushes the tags and the step that publishes.
 * Ahead of the tags it reads the previous release; after Publish, a failed
 * publish would leave the pins unwritten for a release that is tagged.
 *
 * A failed pin commit leaves the pin check to report it, so Publish runs past
 * it. A step's default condition skips it after any failure, which would leave
 * the tagged versions off npm.
 */

const steps = stepsOf('release.yml');

/** The index of the one step whose script matches, failing on none or two. */
function indexOf(label: string, matches: (run: string) => boolean): number {
  const found = steps.flatMap((step, index) =>
    step.run !== undefined && matches(step.run) ? [index] : [],
  );

  expect(found, `release.yml must have exactly one ${label} step`).toHaveLength(
    1,
  );

  return found[0] as number;
}

const version = indexOf('nx release', (run) =>
  /npx nx release\b(?! publish)/.test(run),
);
const pins = indexOf('cut-releases.mjs', (run) =>
  run.includes('apps/docs/tools/cut-releases.mjs'),
);
const publish = indexOf('nx release publish', (run) =>
  run.includes('npx nx release publish'),
);

describe('the release docs archive pins', () => {
  it('runs cut-releases.mjs after the version step and before Publish', () => {
    expect(pins).toBeGreaterThan(version);
    expect(publish).toBeGreaterThan(pins);
  });

  it('publishes after a failed pin step, and only after a tagged version', () => {
    const { id } = steps[version] as Step;
    const condition = (steps[publish] as Step).if ?? '';

    expect(id, 'the version step needs an id for Publish to read').toBeTruthy();
    expect(condition).toContain('!cancelled()');
    expect(condition).toContain(`steps.${id}.outcome == 'success'`);
  });
});
