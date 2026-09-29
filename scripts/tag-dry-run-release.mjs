#!/usr/bin/env node
// Tags HEAD, in this clone only, with the tags `nx release` would push for the
// release set in $PROJECTS, so a dry run of the release workflow can run the
// steps that read the new tags against the release it plans.
//
// The versions come from `releaseVersion` with `dryRun`, the call `nx release`
// makes before it tags, and the tag names from `createGitTagValues`, the
// function it tags with. So the tags here are the ones a real run creates,
// under the same `releaseTag.pattern` and the same `updateDependents` bumps.
//
// Nothing here pushes. The tags sit on HEAD, where a real run's sit on the
// version-bump commit; the two trees differ only in manifests and changelogs.

import { execFileSync } from 'node:child_process';
import { releaseVersion } from 'nx/release';
import { createGitTagValues } from 'nx/src/command-line/release/utils/shared';

const projects = (process.env.PROJECTS ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

// An empty list omits the filter, as the version step omits `--projects`.
const { projectsVersionData, releaseGraph } = await releaseVersion({
  dryRun: true,
  verbose: false,
  ...(projects.length > 0 ? { projects } : {}),
});

const tags = createGitTagValues(
  releaseGraph.releaseGroups,
  releaseGraph.releaseGroupToFilteredProjects,
  projectsVersionData,
);

if (tags.length === 0) {
  console.log('\nnx release computes no new version, so it would push no tag.');
  process.exit(0);
}

console.log(`\nTagging HEAD in this clone with what nx release would push:`);
for (const tag of tags) {
  execFileSync('git', ['tag', tag, 'HEAD'], { stdio: 'inherit' });
  console.log(`  ${tag}`);
}
