import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
      return `\`${name}\` ${rest.join(' ')}`.trim();
    }
    const label = tag.name === 'return' ? 'returns' : tag.name;
    return `**${label}** ${tag.text}`.trim();
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

  const imports = [
    signature.values.length > 0 &&
      `import { ${signature.values.join(', ')} } from '${specifier}';`,
    signature.types.length > 0 &&
      `import type { ${signature.types.join(', ')} } from '${specifier}';`,
  ].filter(Boolean);

  return [
    '<div className="docs-api-entry__signature">',
    '',
    '```ts twoslash',
    ...imports,
    ...(imports.length > 0 ? [''] : []),
    ...signature.text.split('\n'),
    '```',
    '',
    '</div>',
  ];
}

/** Everything an entry emits between its heading and its editorial prose. */
function head(reference) {
  const lines = [];

  if (reference.summary) lines.push(reference.summary, '');

  const tags = tagLine(reference.tags);
  if (tags) lines.push(tags, '');

  if (reference.rest) {
    lines.push(
      '<details className="docs-api-entry__more">',
      '<summary>Full documentation</summary>',
      '',
      reference.rest,
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

/** The two fences that close an entry: what it takes, then what a call is. */
function foot(root, reference, example, file) {
  const lines = ['', ...signatureFence(reference)];

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

  const close = () => {
    if (!open) return;
    // Trailing blank lines belong after the entry, not inside it.
    while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
    out.push(
      ...foot(root, open.reference, open.example, file),
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

    onResolve?.(reference);

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

    open = { reference, example: example ?? null };
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
    (reference) => {
      const readme = join(root, reference.readme);
      this.addDependency(reference.declaration);
      this.addDependency(readme);
      this.addDependency(preamblePath(dirname(readme)));
    },
  );
}
