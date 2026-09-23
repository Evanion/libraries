import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { DeclarationError, readReference } from './declarations.mjs';
import { preamblePath, readPreamble, withPreamble } from './preamble.mjs';
import { readRegion } from './regions.mjs';

/**
 * Fills an API reference entry from the package's own declarations, during
 * `next build`.
 *
 * A page writes the heading and whatever editorial prose it owes a reader, and
 * one directive under the heading:
 *
 *     ## `hydratePolicy`
 *
 *     <!-- reference @evanion/acl#hydratePolicy example=quick-start -->
 *
 *     Prose the author writes, which this never touches.
 *
 * The directive becomes five things: the docblock's first paragraph as the
 * entry's summary, its block tags as a parameter list, the rest of the docblock
 * inside a collapsed `<details>`, a `twoslash` fence querying the compiler for
 * the signature, and a `twoslash` fence holding the named README region. The
 * whole entry is wrapped in an element binding the export's kind hue, so the
 * name is coloured by what the export is while the chip beside it says the same
 * word in text.
 *
 * The example comes from a named region of the package's README, through the
 * same reader the region loader uses, so an example on a reference page is
 * still an example a package's own tests run and a renamed region fails the
 * build.
 *
 * Nextra injects the `Popup` component only for a fence whose meta is exactly
 * `twoslash`, so every fence here is emitted as `ts twoslash` and nothing else,
 * and the example's `file=`/`region=` is consumed by the loader that runs next.
 *
 * **What the signature fence contains.** The declaration the package
 * published, printed from its own `.d.ts` and given the imports it names. The
 * `signature` fences this replaces were hand-written and could not simply be
 * re-tagged: a `function` declaration with no implementation is a type error
 * and Twoslash refuses it, while a printed one carries `declare` and compiles.
 * `declarations.mjs` carries why this is printed rather than queried.
 *
 * **A reference that does not resolve fails the build.** The region loader
 * already throws on a missing file or region so that `next build` fails rather
 * than deploying a page with an empty code block. The same rule applied to a
 * symbol is what makes "every heading names a real export" structural rather
 * than a test's opinion.
 */

const DIRECTIVE =
  /^<!--\s*reference\s+(@?[\w./-]+)#([\w$]+)(?:\s+example=([\w-]+))?\s*-->\s*$/;
const HEADING = /^(#{1,6})\s+/;
const FENCE = /^(\s*)(`{3,})(.*)$/;

/** The words the chip shows, one per member of the export-kind scale. */
const KIND_LABELS = {
  error: 'error',
  class: 'class',
  function: 'function',
  constant: 'constant',
  interface: 'interface',
  typeAlias: 'type',
};

/**
 * A docblock's prose as MDX.
 *
 * A docblock is written for an editor's hover, where `{` and `<` are ordinary
 * characters. MDX reads `{` as the start of an expression and `<` as the start
 * of a tag, so a `{@link Matrix}` in a library's comment fails the whole build
 * with `Unexpected character '@'`. Six of `@evanion/acl`'s 105 entries carry
 * one.
 *
 * An inline tag becomes what it meant: the label where the author wrote one,
 * and the target as code where they did not. Everything else that MDX would
 * read as syntax is escaped, so a docblock written years before this loader
 * existed renders as the sentence it is.
 *
 * Code spans are left alone. MDX does not read an expression inside one, and
 * escaping there would put a backslash on the page.
 */
export function mdxProse(text) {
  return text
    .split(/(`+[^`]*`+)/)
    .map((part, at) => {
      if (at % 2 === 1) return part;

      return part
        .replace(
          /\{@(?:link|linkcode|linkplain)\s+([^}|\s]+)\s*(?:\|\s*)?([^}]*)\}/g,
          (_, target, label) =>
            label.trim() === '' ? `\`${target}\`` : label.trim(),
        )
        .replace(/[{}<]/g, (character) => `\\${character}`);
    })
    .join('');
}

/** `typeAlias` as the stylesheet spells it, matching `slug` in the kit. */
function kindSlug(kind) {
  return kind.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * The block tags as one prose line.
 *
 * Prose and not a fence, because this is the half of an entry the search index
 * can reach: every `<pre>` on the site carries `data-pagefind-ignore`, so a
 * parameter named only inside the signature is a name no search finds.
 */
function tagLine(tags) {
  const rendered = tags.map((tag) => {
    if (tag.name === 'param') {
      const [name, ...rest] = tag.text.split(/\s+/);
      return `\`${name}\` ${mdxProse(rest.join(' '))}`.trim();
    }
    const label = tag.name === 'return' ? 'returns' : tag.name;
    return `**${label}** ${mdxProse(tag.text)}`.trim();
  });

  return rendered.filter(Boolean).join(' · ');
}

/**
 * The fence holding the declaration the package published.
 *
 * Wrapped in an element of its own, because this is the one fence on the site
 * that should wrap rather than scroll: a signature is a shape a reader reads
 * left to right once, not a program they follow down the page, and the longest
 * one here is 154 characters.
 *
 * An import line stays on one line. A prettier-wrapped multi-line `import`
 * inside a fence fails with a misleading "Cannot use import statement outside a
 * module" (issue #255), so the names go on one line and the stylesheet wraps
 * them.
 */
function signatureFence(reference) {
  const { signature, specifier } = reference;
  if (!signature) return [];

  const context = [
    signature.values.length > 0 &&
      `import { ${signature.values.join(', ')} } from '${specifier}';`,
    signature.types.length > 0 &&
      `import type { ${signature.types.join(', ')} } from '${specifier}';`,
    signature.fromRoot.length > 0 &&
      `import type { ${signature.fromRoot.join(', ')} } from '${reference.rootSpecifier}';`,
    ...signature.prelude,
  ].filter(Boolean);

  // The imports and the private types are compilation context and not the
  // entry's content, so they are cut from what the reader sees. A merging
  // declaration is wrapped in a module block for the reason `declarations.mjs`
  // gives, and the two lines of wrapper are cut as well, so the fence shows the
  // declaration and nothing around it.
  const body = signature.merges
    ? [
        '// ---cut-start---',
        `declare module '${specifier}' {`,
        '// ---cut-end---',
        ...signature.text.split('\n'),
        '// ---cut-start---',
        '}',
        '// ---cut-end---',
      ]
    : signature.text.split('\n');

  return [
    '<div className="docs-api-entry__signature">',
    '',
    '```ts twoslash',
    ...context,
    ...(context.length > 0 ? ['// ---cut---'] : []),
    ...body,
    '```',
    '',
    '</div>',
  ];
}

/** Where `docs:behaviour-data` writes what each library's tests state. */
const BEHAVIOURS = join('apps', 'docs', 'components', 'api', 'behaviour');

/** The kinds a reader is owed a catalogue for, empty or not. */
const STATED_KINDS = new Set(['function', 'class']);

/**
 * The file holding what the package behind an entry states.
 *
 * Named after the package's own directory, which the entry already carries
 * through its README path. A missing file fails the build, for the reason an
 * unresolved symbol and a missing README region already do: an entry that
 * rendered its catalogue as empty because a target had not run would be making
 * the claim of § 9 without having looked.
 */
export function behaviourPath(root, reference) {
  const packageDir = dirname(join(root, reference.readme));
  return join(root, BEHAVIOURS, `${basename(packageDir)}.json`);
}

/** What a package's tests state, read off disk. */
function readBehaviours(root, reference, file) {
  const path = behaviourPath(root, reference);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(
      `${file}: cannot read '${path}', which is where the behaviours of ` +
        `'${reference.specifier}' are written. Run ` +
        `\`npx nx run docs:behaviour-data\`.`,
    );
  }
}

/**
 * What one export's entry carries, in the order the suite states it.
 *
 * The owning segment is dropped along with everything above it, because the
 * reader is on that export's entry and has just read its name in the heading.
 * What sits below it is kept, and its first level is kept as structure rather
 * than folded into the sentence: `diffMatrix > a widening > reports an added
 * allow branch as granted` states the condition the sentence holds under, and
 * the suite writes several sentences under each condition. So `a widening` is a
 * heading over its own sentences, which is the one thing a test reporter gives
 * a reader that this block can take.
 *
 * `loose` holds what the suite states under the export's own name, with nothing
 * between. A level below the first is joined with the interpunct the rest of an
 * entry joins with, because three levels of indent inside a block this size
 * reads as a directory listing.
 *
 * A chain that ends at the owning `describe` contributes nothing. That is a
 * block of generated cases sitting directly under the export's own name, and
 * the only title it carries is the name the reader is already looking at.
 */
export function statedBy(behaviours, name) {
  const held = behaviours.states[name] ?? [];
  const loose = [];
  const conditions = new Map();

  for (const { chain } of held) {
    const rest = chain.slice(chain.indexOf(name) + 1);
    if (rest.length === 0) continue;

    if (rest.length === 1) {
      if (!loose.includes(rest[0])) loose.push(rest[0]);
      continue;
    }

    const under = conditions.get(rest[0]) ?? [];
    const sentence = rest.slice(1).join(' · ');
    if (!under.includes(sentence)) under.push(sentence);
    conditions.set(rest[0], under);
  }

  const stated = [...conditions.values()].reduce(
    (sum, each) => sum + each.length,
    loose.length,
  );

  return { loose, conditions: [...conditions], stated };
}

/** The sentences under one condition the suite wrote, as its own group. */
function condition(name, sentences) {
  return [
    '<div className="docs-api-entry__states-group">',
    '',
    `<p className="docs-api-entry__states-condition">${mdxProse(name)}</p>`,
    '',
    ...sentences.map((each) => `- ${mdxProse(each)}`),
    '',
    '</div>',
    '',
  ];
}

/**
 * What the tests state about this export.
 *
 * Prose and not a fence. Every `<pre>` on the site carries
 * `data-pagefind-ignore`, so a sentence inside one is a sentence no search
 * reaches, and these sentences are the most searchable thing on the entry: a
 * reader looking for the export that refuses an unknown key is looking for
 * words a test wrote.
 *
 * Shaped like the suite and not like a test report. What a reporter is good at
 * is making a nesting legible and saying how many cases sit in it, and both of
 * those are here: the conditions the suite wrote are headings over their own
 * sentences, and the count says how dense the export's catalogue is before the
 * reader has read a line of it. What a reporter is built on is status, and none
 * of that transfers. Every sentence here comes from a suite that passes, so a
 * tick on each line would carry no information, and a green tick reads as
 * "verified", which is the one thing this block may not claim. The honesty
 * argument is made in the prose, and markup that contradicted it would undo it.
 *
 * The heading says `state` and the line at the foot says what that leaves open.
 * The suite's authors wrote these sentences and this block reports them; a
 * sentence here is a name a test carries, and the assertions under that name
 * are a question only the test's source answers. `libs/acl/SECURITY.md` is the
 * other kind of claim: a person wrote each of its rows and chose its tier.
 *
 * An export with nothing stated says so, in a block of its own shape. Not a
 * blank, not an empty list, not a hidden block: an absent catalogue on a page
 * built for a sceptic is the one output that costs the project something to
 * publish. It says no test states a behaviour under this name, which is
 * narrower than untested, because a name with no `describe` of its own can
 * still be exercised by every case in the file.
 */
function statedBlock(reference, behaviours) {
  const { loose, conditions, stated } = statedBy(behaviours, reference.name);
  if (stated === 0 && !STATED_KINDS.has(reference.kind)) return [];

  if (stated === 0) {
    return [
      '<div className="docs-api-entry__states docs-api-entry__states--silent">',
      '',
      '<p className="docs-api-entry__states-heading">What the tests state</p>',
      '',
      '<p className="docs-api-entry__states-silence">No test in this package ' +
        'states a behaviour under this name.</p>',
      '',
      '</div>',
    ];
  }

  return [
    '<div className="docs-api-entry__states">',
    '',
    '<div className="docs-api-entry__states-head">',
    '',
    '<p className="docs-api-entry__states-heading">What the tests state</p>',
    '',
    `<p className="docs-api-entry__states-count"><Figure>${stated}</Figure> ` +
      `${stated === 1 ? 'behaviour' : 'behaviours'}</p>`,
    '',
    '</div>',
    '',
    ...(loose.length > 0
      ? [...loose.map((each) => `- ${mdxProse(each)}`), '']
      : []),
    ...conditions.flatMap(([name, sentences]) => condition(name, sentences)),
    // One line, because MDX reads an indented block inside a tag as markdown
    // and wraps it in a paragraph of its own, which puts a `<p>` inside a `<p>`.
    '<p className="docs-api-entry__states-note">Each line is the name of a ' +
      'test in the package. Whether a test proves what its name states is a ' +
      'question its own source answers.</p>',
    '',
    '</div>',
  ];
}

/** Everything an entry emits between its heading and its editorial prose. */
function head(reference) {
  const lines = [];

  if (reference.summary) lines.push(mdxProse(reference.summary), '');

  const tags = tagLine(reference.tags);
  if (tags) lines.push(tags, '');

  if (reference.rest) {
    lines.push(
      '<details className="docs-api-entry__more">',
      '<summary>Full documentation</summary>',
      '',
      mdxProse(reference.rest),
      '',
      '</details>',
      '',
    );
  }

  return lines;
}

/**
 * The example fence, filled from the named region of the package's README.
 *
 * Resolved here rather than left as a `file=`/`region=` reference for the
 * region loader to fill on a later pass. Turbopack runs the `*.mdx` loaders in
 * the reverse of the order they are listed, so a fence this emits for another
 * loader arrives after that loader has already run and reaches the page empty.
 * The region reader is a module either loader can call, so calling it is the
 * fix that does not depend on which way round the chain runs.
 *
 * The README's preamble goes in front of the region behind a `// ---cut---`
 * the reader never sees, which is what `expandRegions` does for a Twoslash
 * fence and for the same reason: the fence has to compile and the README does
 * not show the imports that make it compile.
 */
function exampleFence(root, reference, region, file) {
  const path = join(root, reference.readme);
  let contents;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `${file}: cannot read '${reference.readme}', which is where ` +
        `'${reference.name}' names the region '${region}'`,
    );
  }

  const found = readRegion(contents, reference.readme, region);
  const code = withPreamble(readPreamble(dirname(path)), found.code);

  return ['```ts twoslash', ...code.split('\n'), '```'];
}

/**
 * What closes an entry: the signature, what the tests state, then a call.
 *
 * In that order because it is the order a reader needs it in. The signature
 * says what the export is, the sentences say what it does, and the example
 * shows a call.
 */
function foot(root, reference, behaviours, example, file) {
  const lines = ['', ...signatureFence(reference)];

  const stated = statedBlock(reference, behaviours);
  if (stated.length > 0) lines.push('', ...stated);

  if (example) {
    lines.push('', ...exampleFence(root, reference, example, file));
  }

  return lines;
}

/**
 * Expands every reference directive in an MDX source.
 *
 * Textual for the reason `expandRegions` is textual: a directive is a line and
 * its replacement is lines, so parsing the document buys nothing the line scan
 * does not give.
 *
 * `read` is the declaration reader, taken as an argument so a test can drive
 * the expansion without a built package behind it.
 */
export function expandReferences(
  source,
  root,
  file,
  read = readReference,
  onResolve,
) {
  const out = [];
  let fence = null;
  // The entry whose fences have not been emitted yet.
  let open = null;
  // One read per package rather than one per entry: `/acl/api/` holds 107
  // entries and every one of them asks the same file the same question.
  const behaviours = new Map();

  const statedFor = (reference) => {
    const path = behaviourPath(root, reference);
    const held = behaviours.get(path) ?? readBehaviours(root, reference, file);
    behaviours.set(path, held);
    return held;
  };

  const close = () => {
    if (!open) return;
    // Trailing blank lines belong after the entry, not inside it.
    while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
    out.push(
      ...foot(root, open.reference, open.behaviours, open.example, file),
      '',
      '</div>',
      '',
    );
    open = null;
  };

  for (const line of source.split('\n')) {
    const marker = line.match(FENCE);

    if (marker && fence === null) {
      fence = marker[2];
      out.push(line);
      continue;
    }

    if (marker && fence !== null && marker[2].startsWith(fence)) {
      fence = null;
      out.push(line);
      continue;
    }

    if (fence !== null) {
      out.push(line);
      continue;
    }

    if (HEADING.test(line)) {
      close();
      out.push(line);
      continue;
    }

    const directive = line.match(DIRECTIVE);
    if (!directive) {
      out.push(line);
      continue;
    }

    const [, specifier, name, example] = directive;

    // The heading is the entry's identity and the guards read it off the page
    // as written, so the directive names nothing and stands under one.
    let at = out.length - 1;
    while (at >= 0 && out[at].trim() === '') at -= 1;
    if (at < 0 || !HEADING.test(out[at])) {
      throw new Error(
        `${file}: the reference to '${specifier}#${name}' has no heading ` +
          `above it. An entry is a heading and a directive, in that order.`,
      );
    }

    let reference;
    try {
      reference = read(root, specifier, name);
    } catch (error) {
      if (!(error instanceof DeclarationError)) throw error;
      throw new Error(`${file}: ${error.message}`);
    }

    const stated = statedFor(reference);
    onResolve?.(reference, stated);

    const heading = out.splice(at).filter((each) => each.trim() !== '');
    // The name and the chip share a row, so they share a parent. The heading
    // stays a markdown heading inside it, which is what keeps its anchor, its
    // place in the table of contents and its entry in the search index.
    out.push(
      `<div className="docs-api-entry baize-kind-${kindSlug(reference.kind)}">`,
      '',
      '<div className="docs-api-entry__name">',
      '',
      ...heading,
      '',
      `<Chip>${KIND_LABELS[reference.kind]}</Chip>`,
      '',
      '</div>',
      '',
      ...head(reference),
    );

    open = { reference, behaviours: stated, example: example ?? null };
  }

  close();

  return out.join('\n');
}

/**
 * The loader entry point, configured in `apps/docs/next.config.ts` under
 * `turbopack.rules` ahead of the region loader. `root` is the workspace root
 * every specifier resolves from.
 */
export default function mdxReferenceLoader(source) {
  const { root } = this.getOptions();

  // Declares what each entry was read from as an input of this page, so
  // rebuilding a library rebuilds the pages quoting its signatures and editing
  // a README rebuilds the pages quoting its regions. Without this the page's
  // own mtime is the only thing the build watches, and an entry keeps showing
  // a signature the package no longer has.
  return expandReferences(
    source,
    root,
    this.resourcePath,
    readReference,
    (reference, behaviours) => {
      const readme = join(root, reference.readme);
      this.addDependency(reference.declaration);
      this.addDependency(readme);
      this.addDependency(preamblePath(dirname(readme)));
      this.addDependency(behaviourPath(root, reference));
      // The test sources behind the sentences, so editing a test rebuilds the
      // page quoting it rather than leaving a name the suite no longer carries.
      for (const each of behaviours.files) this.addDependency(join(root, each));
    },
  );
}
