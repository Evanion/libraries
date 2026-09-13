import { workspaceRoot } from '@nx/devkit';
import { hasCurrentAgentRules } from 'next/dist/server/lib/generate-agent-files.js';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Next writes an agent-rules block into each app's `AGENTS.md` and `CLAUDE.md`
 * when `next dev` runs under an AI agent
 * (next/dist/server/lib/app-info-log.js -> ensureAgentRulesForDev). The block
 * says which Next release the app is on and where that release's docs live, so
 * it is worth having in the repository rather than appearing as an uncommitted
 * change in whichever branch happens to start a dev server.
 *
 * Its text is a constant inside the installed Next, so a Next upgrade makes the
 * committed copy wrong, and the only thing that would notice is another agent
 * running `next dev`. `hasCurrentAgentRules` is the same predicate Next uses to
 * decide whether to rewrite the file, so asking it here fails the upgrade PR
 * instead.
 *
 * The fix is to run `next dev` once in the failing app, or to set
 * `agentRules: false` in its next.config and delete both files.
 */

const appsDir = join(workspaceRoot, 'apps');

const nextApps = readdirSync(appsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) =>
    readdirSync(join(appsDir, name)).some((file) =>
      file.startsWith('next.config.'),
    ),
  );

describe('the committed Next agent rules match the installed Next', () => {
  it('finds the Next apps to check', () => {
    expect(nextApps.length).toBeGreaterThan(0);
  });

  it.each(nextApps)('%s carries the current block', (app) => {
    expect(
      hasCurrentAgentRules(join(appsDir, app)),
      `apps/${app}/AGENTS.md does not carry the agent-rules block that the ` +
        `installed Next writes. Run \`nx dev ${app}\` once and commit the ` +
        `result, so the block in the repository names the Next release the app ` +
        `is actually on.`,
    ).toBe(true);
  });
});
