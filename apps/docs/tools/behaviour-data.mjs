import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import { behavioursOf } from '@evanion/doc-examples/behaviours';
import { createTransformerFactory, rendererRich } from '@shikijs/twoslash';
import { codeToHast, hastToHtml } from 'shiki';
import ts from 'typescript';
import { createTwoslasher } from 'twoslash';

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
 * runs the suites and counts what came back; this one reads their sources,
 * parses them in under a second, and spends the rest of its fifty seconds
 * compiling each file for its types and highlighting every body. Putting a
 * reference page's rebuild behind a sweep of every library's suite buys the
 * page nothing, so the two targets share the package list and nothing else.
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
 *
 * The type a hover shows is highlighted against the same two themes, so its
 * tokens take their colours from the same classes and add two pairs of their
 * own for the frame Shiki draws around a signature that wraps.
 */
const palette = new Map();

const classOf = (declarations) => {
  if (!palette.has(declarations)) palette.set(declarations, palette.size);
  return `bh${palette.get(declarations)}`;
};

/**
 * What the compiler is told about a test file.
 *
 * `tsconfig.base.json`'s settings, down to the ones that decide whether a
 * specifier resolves: `customConditions` is what sends `@evanion/acl` to the
 * package's own TypeScript source, and `nodenext` on both is the mode the
 * repository's relative specifiers carry an extension for. `types: []` keeps
 * the compiler from sweeping every `@types` package in the workspace for a
 * hover the pane will never show.
 */
const COMPILER = {
  customConditions: ['@evanion/source'],
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: true,
  target: ts.ScriptTarget.ES2022,
  types: [],
};

/**
 * The compiler a directory's test files are read through.
 *
 * Twoslash puts the code it is given in a virtual file overlaid on the real
 * filesystem, so the directory it is rooted at is what makes `./authoring.js`
 * resolve. One instance per directory holds one language service across every
 * file under it, which is what takes `@evanion/acl`'s 22 files from 22 cold
 * program loads to one.
 */
const compilers = new Map();

function compilerFor(directory) {
  const held = compilers.get(directory);
  if (held) return held;

  const made = createTwoslasher({
    vfsRoot: directory,
    compilerOptions: COMPILER,
    // 20 of `@evanion/acl`'s cases hand `serialize` input it is meant to
    // refuse, and Twoslash reads a compiler error nobody marked as a failure
    // of the whole file. The pane shows hovers and never an error box, so the
    // errors are dropped below and the file keeps its types.
    handbookOptions: { noErrorValidation: true },
  });

  compilers.set(directory, made);
  return made;
}

/** What a file is written in, which decides both the compile and the grammar. */
const languageOf = (path) => (path.endsWith('x') ? 'tsx' : 'ts');

/**
 * Every type one test file's compile knows, at that file's own offsets.
 *
 * One compile per file and not one per case. Each case is a fragment standing
 * on imports and fixtures at module scope, so the compile unit has to be the
 * whole file either way; cutting the file down to one case with `// ---cut---`
 * would ask the language service for 418 programs where 22 answer the same
 * question. `chainsOf` already carries where each body sits in the file, so a
 * hover belongs to the case whose body its offset falls in.
 *
 * The `// @filename:` line names the virtual file after the real one. Without
 * it Twoslash writes `index.ts`, which in `libs/acl/src` is the package's own
 * entry and would hand `index.test.ts` itself back to the import of
 * `./index.js`. The line stays in the code Twoslash returns, so every offset
 * comes back shifted by its length.
 */
function hoversIn(path) {
  const code = readFileSync(path, 'utf8');
  const named = `// @filename: ${basename(path)}\n`;
  const read = compilerFor(dirname(path))(named + code, languageOf(path));

  if (read.code !== named + code)
    throw new Error(`twoslash rewrote ${relative(workspaceRoot, path)}`);

  return read.nodes
    .filter((node) => node.type === 'hover')
    .map((node) => ({ ...node, start: node.start - named.length }))
    .sort((left, right) => left.start - right.start);
}

/**
 * The hovers that fall inside one case, at that case's own offsets.
 *
 * A body is its file's text with the nesting's indentation taken off, so a
 * hover's position in the file is not its position in the body and `offsets`
 * is the map between them. A hover whose first character was cut away, or
 * whose span crosses a cut, is dropped: the pane would otherwise mark a run of
 * characters the reader is not looking at.
 */
function hoversOf(hovers, body, offsets) {
  const where = new Map();
  offsets.forEach((offset, at) => where.set(offset, at));

  // Where each line of the body starts, so a hover reports the line and column
  // the highlighter's own tokens are indexed by.
  const starts = [0];
  for (let at = 0; at < body.length; at += 1)
    if (body[at] === '\n') starts.push(at + 1);

  const within = [];

  for (const node of hovers) {
    const start = where.get(node.start);
    if (start === undefined) continue;
    if (where.get(node.start + node.length - 1) !== start + node.length - 1)
      continue;

    let line = starts.length - 1;
    while (starts[line] > start) line -= 1;

    within.push({ ...node, start, line, character: start - starts[line] });
  }

  return within;
}

/** Whether an element carries a class, however the producer wrote it. */
function classesOf(node) {
  const held = node.properties?.class ?? node.properties?.className ?? [];
  return Array.isArray(held) ? held : String(held).split(/\s+/);
}

function addClass(node, name) {
  const held = classesOf(node).filter(Boolean);
  delete node.properties.className;
  node.properties.class = [...held, name].join(' ');
}

/**
 * Shiki's per-token colours turned into palette classes, and each hover's type
 * lifted out of the token that carries it.
 *
 * `rendererRich` writes a whole popup into every token it decorates, and
 * `@evanion/acl` decorates 7478 of them with 1193 distinct types between
 * them. So the popup is stored once under a number and the token carries the
 * number, which is what the catalogue looks up when a reader reaches the token.
 */
function fold(node, popups) {
  if (node.type !== 'element') return;

  const declarations = node.properties?.style;
  if (typeof declarations === 'string' && declarations.includes('--shiki-')) {
    delete node.properties.style;
    addClass(node, classOf(declarations));
  }

  for (const child of node.children ?? []) fold(child, popups);

  if (!classesOf(node).includes('twoslash-hover')) return;

  const at = (node.children ?? []).findIndex((child) =>
    classesOf(child).includes('twoslash-popup-container'),
  );
  if (at === -1) return;

  const [popup] = node.children.splice(at, 1);
  const html = popup.children.map((child) => hastToHtml(child)).join('');
  if (!popups.has(html)) popups.set(html, popups.size);
  node.properties['data-pop'] = String(popups.get(html));
}

/**
 * One case, as the pane shows it.
 *
 * The frame is Shiki's `<pre>`, its `<code>` and a span per line, and none of
 * the three survives: the pane draws its own frame and nothing here styles a
 * line. Shiki produces them anyway because the transformer that puts a hover
 * on a token reads the line elements to find it, so the frame is taken off
 * after the transformer has run rather than never built.
 */
async function highlight(body, language, hovers, popups) {
  const twoslash =
    hovers === null
      ? []
      : [
          createTransformerFactory(
            () => ({ code: body, nodes: hovers, meta: {} }),
            // The type signature and not the docblock above it. A reader on
            // this entry has the export's own prose a few hundred pixels up
            // the page, and repeating it under every token it is mentioned in
            // took `@evanion/acl`'s cases past what a reader should download
            // to read four lines of a test.
            rendererRich({ jsdoc: false }),
          )({ langs: ['ts', 'tsx'] }),
        ];

  const tree = await codeToHast(body, {
    lang: language,
    themes: THEMES,
    defaultColor: false,
    transformers: twoslash,
  });

  const code = tree.children[0]?.children?.find(
    (child) => child.type === 'element' && child.tagName === 'code',
  );
  if (!code) throw new Error('shiki produced no code element');

  fold(code, popups);

  return code.children
    .flatMap((child) =>
      child.type === 'element' && classesOf(child).includes('line')
        ? child.children
        : [child],
    )
    .map((child) => hastToHtml(child))
    .join('');
}

/** How many cases came back without their types, across every library. */
let fallbacks = 0;

/** One library's two files, keyed the way the loader and the page look them up. */
async function filesFor(project) {
  const { files, chains, states } = behavioursOf(
    join(workspaceRoot, project.root),
  );

  // Per library, because a popup is a type out of that library's own sources
  // and a sidecar carrying every library's types would send `@evanion/urn`'s
  // reader the ones `@evanion/acl` needs.
  const popups = new Map();

  // A file whose compile threw takes its own cases down to plain highlighting
  // and leaves every other file's alone. A case is never lost: what falls away
  // is the type on a token, and the body the pane shows is the same either way.
  const compiled = new Map();
  for (const path of new Set(chains.map((each) => each.file))) {
    try {
      compiled.set(path, hoversIn(path));
    } catch (thrown) {
      compiled.set(path, null);
      console.warn(
        `  ${relative(workspaceRoot, path)}: ${thrown.message}, ` +
          'so its cases carry no types',
      );
    }
  }

  const bodies = {};
  for (const each of chains) {
    const hovers = compiled.get(each.file);
    let html;

    try {
      if (hovers === null) throw new Error('the file carries no types');
      html = await highlight(
        each.body,
        languageOf(each.file),
        hoversOf(hovers, each.body, each.offsets),
        popups,
      );
    } catch {
      fallbacks += 1;
      html = await highlight(each.body, languageOf(each.file), null, popups);
    }

    bodies[each.id] = {
      where: relative(workspaceRoot, each.file),
      line: each.line,
      html,
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
    sidecar: {
      package: project.name,
      bodies,
      popups: Object.fromEntries(
        [...popups].map(([html, at]) => [String(at), html]),
      ),
    },
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
  // highlighted and every sidecar carries the same rules. A sidecar carrying
  // only the classes its own bodies used would still be correct and would make
  // two libraries disagree about what `bh3` is.
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
    `cases in ${palette.size} colours, ${fallbacks} of them without types`,
);
