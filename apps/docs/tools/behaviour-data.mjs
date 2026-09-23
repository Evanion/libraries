import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { behavioursOf } from '@evanion/doc-examples/behaviours';
import { codeToHtml } from 'shiki';

import { libraries } from './libraries.mjs';

/**
 * Writes what each library's tests state, for the reference loader to render.
 *
 * An entry on `/acl/api/` lists the sentences the package's own suite carries
 * about that export, and opening one shows the case the sentence names. This
 * parses the test sources and writes two files per library. The index, under
 * `components/api/behaviour`, holds the sentences; `mdx-reference-loader.mjs`
 * reads it while expanding a directive during `next build` and puts the
 * sentences in the page. The sidecar, under `public/behaviour`, holds the
 * cases, highlighted, and the catalogue fetches it when a reader reaches one.
 *
 * Apart because of what they weigh. `@evanion/acl` states 418 cases whose
 * bodies come to 541 kB highlighted, against 105 entries on one page, and a
 * page carrying every body would send that to every reader who opened the page
 * to read one signature. The sentences are what search indexes and what a
 * reader scans, so they stay in the HTML; the cases are code, which
 * `search: { codeblocks: false }` keeps out of the index anyway.
 *
 * Highlighted here rather than in the browser. `next.config.ts` sets
 * `output: 'export'`, so there is no request-time route to highlight on, and
 * the alternative is shipping a highlighter and a TextMate grammar to a reader
 * who wanted to read four lines of a test.
 *
 * Parsing rather than running, and separate from `testing-data`. That target
 * runs the suites and counts what came back, which takes twenty seconds; this
 * one reads their sources, which takes under a second of parsing plus the
 * highlighting. Putting a reference page's rebuild behind a sweep of every
 * library's suite buys the page nothing, so the two targets share the package
 * list and nothing else.
 */

const docsRoot = join(import.meta.dirname, '..');
const workspaceRoot = join(docsRoot, '..', '..');
const index = join(docsRoot, 'components', 'api', 'behaviour');
const sidecars = join(docsRoot, 'public', 'behaviour');

/** The two themes every fence on the site is already highlighted against. */
const THEMES = { light: 'github-light', dark: 'github-dark' };

/**
 * The declarations a token carries, as a class rather than on the token.
 *
 * Shiki writes the two themes' colours into every span's `style`, which is 45
 * bytes a token and 1.36 MB across `@evanion/acl` alone. The github themes
 * colour TypeScript with nine pairs between them, so a class per pair and a
 * rule per class takes the same file to 541 kB and changes no colour: these
 * are the values Nextra's own fences carry, read out of the same themes.
 */
const palette = new Map();

const classOf = (declarations) => {
  if (!palette.has(declarations)) palette.set(declarations, palette.size);
  return `bh${palette.get(declarations)}`;
};

/**
 * One case, as the pane shows it.
 *
 * `structure: 'inline'` leaves out the `<pre>`, the `<code>` and the per-line
 * spans, because the pane draws its own frame and nothing here styles a line.
 * What comes back is spans and newlines.
 */
async function highlight(body) {
  const html = await codeToHtml(body, {
    lang: 'ts',
    themes: THEMES,
    defaultColor: false,
    structure: 'inline',
  });

  return html.replace(
    / style="(--shiki-[^"]*)"/g,
    (_, declarations) => ` class="${classOf(declarations)}"`,
  );
}

/** One library's two files, keyed the way the loader and the page look them up. */
async function filesFor(project) {
  const { files, chains, states } = behavioursOf(
    join(workspaceRoot, project.root),
  );

  const bodies = {};
  for (const each of chains) {
    bodies[each.id] = {
      where: relative(workspaceRoot, each.file),
      line: each.line,
      html: await highlight(each.body),
    };
  }

  return {
    name: basename(project.root),
    index: {
      package: project.name,
      // The sources behind the sentences, workspace relative. The loader
      // declares them as inputs of the page, so editing a test rebuilds the
      // page quoting it.
      files: files.map((path) => relative(workspaceRoot, path)),
      states: Object.fromEntries(
        [...states]
          .map(([name, held]) => [
            name,
            [...held.values()].map(({ chain, generated, id }) => ({
              chain,
              generated,
              id,
            })),
          ])
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
    },
    sidecar: { package: project.name, bodies },
  };
}

const projects = await libraries(workspaceRoot);
if (projects.length === 0)
  throw new Error('no library matched release.projects');

// Written fresh each run, so a library that leaves the release scope takes its
// files with it rather than leaving ones the loader would still read.
for (const directory of [index, sidecars]) {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
}

let stated = 0;
let weight = 0;
const written = [];

for (const project of projects) {
  written.push({ project, ...(await filesFor(project)) });
}

for (const { name, index: contents, sidecar } of written) {
  stated += Object.keys(contents.states).length;
  writeFileSync(
    join(index, `${name}.json`),
    `${JSON.stringify(contents, null, 2)}\n`,
  );

  // The palette is shared, so it is written after every library has been
  // highlighted and every sidecar carries the same nine rules. A sidecar
  // carrying only the classes its own bodies used would still be correct and
  // would make two libraries disagree about what `bh3` is.
  const body = `${JSON.stringify({ ...sidecar, styles: styles() })}\n`;
  weight += body.length;
  writeFileSync(join(sidecars, `${name}.json`), body);
}

/** The palette as rules, keyed by the class each token carries. */
function styles() {
  return Object.fromEntries(
    [...palette].map(([declarations, at]) => [`bh${at}`, declarations]),
  );
}

console.log(
  `${relative(workspaceRoot, index)}: ${stated} names stated across ` +
    `${projects.length} libraries`,
);
console.log(
  `${relative(workspaceRoot, sidecars)}: ${Math.round(weight / 1024)} kB of ` +
    `cases in ${palette.size} colours`,
);
