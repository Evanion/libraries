import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { behavioursOf } from '@evanion/doc-examples/behaviours';

import { libraries } from './libraries.mjs';

/**
 * Writes what each library's tests state, for the reference loader to render.
 *
 * An entry on `/acl/api/` lists the sentences the package's own suite carries
 * about that export, and the sentence is the test's own name. This parses the
 * test sources and writes one file per library; `mdx-reference-loader.mjs`
 * reads the file while expanding a directive during `next build`.
 *
 * Parsing rather than running, and separate from `testing-data`. That target
 * runs the suites and counts what came back, which takes twenty seconds; this
 * one reads their sources, which takes under a second. Putting a reference
 * page's rebuild behind a sweep of every library's suite buys the page nothing,
 * so the two targets share the package list and nothing else.
 *
 * `next.config.ts` sets `output: 'export'`, so every byte a reader sees was
 * produced during the build and there is no request-time route this could take
 * instead.
 */

const docsRoot = join(import.meta.dirname, '..');
const workspaceRoot = join(docsRoot, '..', '..');
const output = join(docsRoot, 'components', 'api', 'behaviour');

/** One library's file, keyed the way the loader looks it up. */
function fileFor(project) {
  const { files, states } = behavioursOf(join(workspaceRoot, project.root));

  return {
    name: basename(project.root),
    contents: {
      package: project.name,
      // The sources behind the sentences, workspace relative. The loader
      // declares them as inputs of the page, so editing a test rebuilds the
      // page quoting it.
      files: files.map((path) => relative(workspaceRoot, path)),
      states: Object.fromEntries(
        [...states]
          .map(([name, held]) => [name, [...held.values()]])
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
    },
  };
}

const projects = await libraries(workspaceRoot);
if (projects.length === 0)
  throw new Error('no library matched release.projects');

// Written fresh each run, so a library that leaves the release scope takes its
// file with it rather than leaving one the loader would still read.
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

let stated = 0;
for (const project of projects) {
  const { name, contents } = fileFor(project);
  stated += Object.keys(contents.states).length;
  writeFileSync(
    join(output, `${name}.json`),
    `${JSON.stringify(contents, null, 2)}\n`,
  );
}

console.log(
  `${relative(workspaceRoot, output)}: ${stated} names stated across ${projects.length} libraries`,
);
