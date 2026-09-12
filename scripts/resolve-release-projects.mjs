#!/usr/bin/env node
// Resolves the release workflow's free-text `projects` input against the
// project graph, and writes the result to $GITHUB_OUTPUT as `projects`.
//
// Both `nx release` and `nx release publish` read that one output rather than
// the raw input, so the set that gets versioned and the set that gets published
// cannot drift apart.
//
// An unmatched name exits non-zero before either command runs, and the error
// lists what is releasable. Nx reports a filter matching nothing as "please
// report this as a bug", which is the right message for an Nx bug and the wrong
// one for a typo in a workflow input.

import { createProjectGraphAsync, parseJson, workspaceRoot } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals';
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Writes a `key=value` line to $GITHUB_OUTPUT, or to stdout when run locally. */
function writeOutput(key, value) {
  const line = `${key}=${value}\n`;
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, line);
  } else {
    process.stdout.write(line);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const raw = (process.env.PROJECTS ?? '').trim();

// An empty input is the default: release everything nx finds affected. The
// workflow omits `--projects` entirely in that case, because `--projects ""` is
// a filter matching nothing.
if (!raw) {
  writeOutput('projects', '');
  process.exit(0);
}

const requested = [
  ...new Set(
    raw
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  ),
];

if (requested.length === 0) {
  fail(
    `The 'projects' input was ${JSON.stringify(raw)} and named no projects.`,
  );
}

// nx.json carries `//` comments, so it needs the comment-tolerant parser nx
// itself reads it with; `JSON.parse` throws on it.
const nxJson = parseJson(
  readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
  {
    expectComments: true,
  },
);

const patterns = nxJson.release?.projects;
if (!patterns) {
  fail('nx.json defines no release.projects, so nothing here is releasable.');
}

const graph = await createProjectGraphAsync({ exitOnError: false });
const releasable = findMatchingProjects(
  Array.isArray(patterns) ? patterns : [patterns],
  graph.nodes,
);

if (releasable.length === 0) {
  fail(
    'release.projects matched no projects -- the globs or the graph are wrong.',
  );
}

// Project names carry an npm scope; commit scopes and everyday usage do not.
// Accepting both means the input takes the same vocabulary as a commit message.
// The bare form is derived from the graph rather than from a hard-coded scope,
// so a package published under a different scope needs no change here.
const byBareName = new Map();
for (const name of releasable) {
  byBareName.set(name.replace(/^@[^/]+\//, ''), name);
}

const resolved = [];
const unknown = [];
for (const name of requested) {
  const match = releasable.includes(name) ? name : byBareName.get(name);
  if (match) resolved.push(match);
  else unknown.push(name);
}

if (unknown.length > 0) {
  fail(
    `The 'projects' input names ${unknown.length === 1 ? 'a project' : 'projects'} ` +
      `this repository does not release: ${unknown.join(', ')}\n` +
      `Releasable: ${[...byBareName.keys()].sort().join(', ')}`,
  );
}

console.log(`Releasing ${resolved.length} of ${releasable.length} projects:`);
for (const name of resolved) console.log(`  ${name}`);

writeOutput('projects', resolved.join(','));
