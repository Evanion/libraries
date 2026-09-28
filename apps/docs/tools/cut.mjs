import { posix } from 'node:path';

import {
  expandReferences,
  mdxProse,
} from '@evanion/doc-examples/mdx-reference-loader';
import { readRegion } from '@evanion/doc-examples/regions';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { allowed, live } from '../components/archive/surface.mjs';

/**
 * One page, as a release shipped it, made safe to serve from `main`.
 *
 * A cut page is read out of git at a pinned commit and rendered by the site as
 * it is on `main`. Everything on it that the site resolves at build time would
 * otherwise resolve against `main`: a `file=… region=…` fence fills from the
 * current README, a reference directive from the current declarations, a
 * Twoslash fence compiles against the current package, and a probe or a
 * playground runs it. `docs/specs/2026-09-13-released-by-default.md` § 8 is the
 * rule this applies: every value on the page stays the one the release's own
 * CI produced, and the page says so.
 *
 * So each step here replaces something live with what it resolved to at the
 * pinned commit, and the last one parses the result and refuses any element
 * `components/archive/surface.mjs` does not list. The refusal happens here, at
 * cut time, when a person is present, and not on some later build after a
 * component the page named has changed shape.
 */

/** A fence opening or closing, with its indent, its backticks and its info. */
const FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/;

/** The reference a region fence carries in its info string. */
const REFERENCE = /(?:^|\s)file=(\S+)\s+region=([\w-]+)/;

/**
 * Applies `edit` to every fence in a page, and leaves the prose alone.
 *
 * `edit` receives the fence's info string and body lines and returns the pair
 * to write back. The scan is textual for the reason the region loader's is: a
 * fence is lines, and parsing the document buys nothing a line scan does not.
 */
function eachFence(source, edit) {
  const out = [];
  let open = null;

  for (const line of source.split('\n')) {
    const marker = line.match(FENCE);

    if (open === null) {
      if (marker)
        open = {
          indent: marker[1],
          ticks: marker[2],
          info: marker[3],
          body: [],
        };
      else out.push(line);
      continue;
    }

    if (marker && marker[2].startsWith(open.ticks) && marker[3].trim() === '') {
      const { info, body } = edit(open.info, open.body);
      out.push(`${open.indent}${open.ticks}${info}`, ...body, line);
      open = null;
      continue;
    }

    open.body.push(line);
  }

  if (open !== null)
    out.push(`${open.indent}${open.ticks}${open.info}`, ...open.body);

  return out.join('\n');
}

/**
 * Fills every `file=… region=…` fence from the file as it was at the pinned
 * commit, and drops the reference.
 *
 * The region loader would otherwise fill it from the README on disk, which is
 * `main`'s. With the code written into the fence the loader has nothing to do,
 * and a later rename of the region cannot reach the page.
 *
 * @param {string} source
 * @param {(path: string) => string} read the file at the pinned commit
 * @param {string} page where the page came from, for the error
 */
export function inlineRegions(source, read, page) {
  return eachFence(source, (info, body) => {
    const reference = info.match(REFERENCE);
    if (!reference) return { info, body };

    const [, path, name] = reference;
    let contents;
    try {
      contents = read(path);
    } catch {
      throw new Error(
        `${page}: '${path}' is not in the tree at the pinned commit, and region '${name}' names it`,
      );
    }

    const region = readRegion(contents, path, name);
    const indent = info.match(/^\s*/)?.[0] ?? '';
    const rest = info.replace(REFERENCE, '').trim();

    return {
      info: rest || region.lang || 'ts',
      body: region.code.split('\n').map((line) => indent + line),
    };
  });
}

/**
 * Turns every Twoslash fence into the plain fence a reader saw.
 *
 * A Twoslash fence is compiled during the build, against the workspace package
 * the docs app resolves, which is `main`'s. Its hovers would show `main`'s types
 * on a page about an older release, and a fence whose API has since changed
 * would fail the build. So the compile goes, and with it everything that only
 * the compiler read: the context above `// ---cut---`, the blocks between
 * `---cut-start---` and `---cut-end---`, and the `// ^?` queries and
 * `// @flag` directives. What is left is the code the rendered fence showed.
 */
export function plainFences(source) {
  return eachFence(source, (info, body) => {
    const words = info.trim().split(/\s+/);
    if (!words.includes('twoslash')) return { info, body };

    let lines = body;
    const cut = lines.findLastIndex((line) =>
      /^\s*\/\/ ---cut---\s*$/.test(line),
    );
    if (cut !== -1) lines = lines.slice(cut + 1);

    const after = lines.findIndex((line) =>
      /^\s*\/\/ ---cut-after---\s*$/.test(line),
    );
    if (after !== -1) lines = lines.slice(0, after);

    const kept = [];
    let hidden = false;
    for (const line of lines) {
      if (/^\s*\/\/ ---cut-start---\s*$/.test(line)) hidden = true;
      else if (/^\s*\/\/ ---cut-end---\s*$/.test(line)) hidden = false;
      else if (hidden) continue;
      else if (/^\s*\/\/\s*\^[?|!~]/.test(line)) continue;
      else if (/^\s*\/\/ @\w+/.test(line)) continue;
      else kept.push(line);
    }

    return {
      info: words.filter((word) => word !== 'twoslash').join(' '),
      body: kept,
    };
  });
}

/**
 * The behaviour catalogue a reference entry carries, as the list it showed.
 *
 * The reference loader emits `<BehaviourCatalogue>` with the sentences in its
 * props and a count in a `<Figure>`. The catalogue fetches each case's source
 * from `/behaviour/`, which the build writes from `main`'s tests, so on a cut
 * page it would pair the release's sentences with today's code. The sentences
 * are what the release's suite stated, and they stay, as a list.
 */
export function freezeCatalogues(source) {
  return source
    .replace(
      /^<BehaviourCatalogue library="[^"]*" name="[^"]*" groups=\{(.*)\} \/>$/gm,
      (_, json) => {
        const groups = JSON.parse(json);

        return groups
          .flatMap(({ label, rows }) => [
            `- ${mdxProse(label)}`,
            ...rows.map((row) => `  - ${mdxProse(row.title)}`),
          ])
          .join('\n');
      },
    )
    .replace(/<Figure>(\d+)<\/Figure>/g, '$1');
}

/**
 * Every absolute link to a page in the section's own tree, made relative.
 *
 * A page cut from a commit before `content/next/` existed links its own
 * section absolutely, and served from `/urn/v1/` every one of those links
 * would leave the version and land on the newest release with a 200. The
 * section's own directory name at that commit is what the links spell, which is
 * not always the slug it is served under: `@evanion/react-widget` 0.2.0's pages
 * were at `content/widget/`.
 *
 * @param {string} source
 * @param {string} own the section's directory name at the pinned commit
 * @param {string} page the page's path inside the section, `api` or `index`
 */
export function relativeLinks(source, own, page) {
  const parts = page.split('/');
  if (parts.at(-1) === 'index') parts.pop();
  const base = posix.join('/', own, ...parts) + '/';
  const mine = new RegExp(`^/${own}(?=/|#|$)`);

  const swap = (href) => {
    if (!mine.test(href)) return null;

    const [path, ...hash] = href.split('#');
    const target = path.endsWith('/') ? path : `${path}/`;
    let relative = posix.relative(base, target);

    if (relative === '') relative = './';
    else if (relative.endsWith('..')) relative = `${relative}/`;
    else if (!relative.startsWith('.')) relative = `./${relative}`;

    return [relative, ...hash].join('#');
  };

  let fence = null;

  return source
    .split('\n')
    .map((line) => {
      const marker = line.match(FENCE);
      if (marker) {
        if (fence === null) fence = marker[2];
        else if (marker[2].startsWith(fence)) fence = null;
        return line;
      }
      if (fence !== null) return line;

      return line
        .replace(/\]\((\/[^)\s]*)\)/g, (match, href) => {
          const swapped = swap(href);
          return swapped === null ? match : `](${swapped})`;
        })
        .replace(/(['"])(\/[a-z0-9-]+[^'"\s]*)\1/g, (match, quote, href) => {
          const swapped = swap(href);
          return swapped === null ? match : `${quote}${swapped}${quote}`;
        });
    })
    .join('\n');
}

/** A page as MDX, for finding its elements and their offsets. */
function parse(source) {
  return unified().use(remarkParse).use(remarkMdx).parse(source);
}

/** Whether an element name is an HTML element rather than a component. */
function intrinsic(name) {
  return /^[a-z]/.test(name);
}

/** Whether a cut page may carry an element, by name. */
function permitted(name) {
  return (
    name === null ||
    intrinsic(name) ||
    allowed.has(name) ||
    allowed.has(name.split('.')[0])
  );
}

/** A JSX attribute's value, when it is a string literal. */
function attribute(node, name) {
  const found = node.attributes?.find(
    (each) => each.type === 'mdxJsxAttribute' && each.name === name,
  );
  return typeof found?.value === 'string' ? found.value : null;
}

/** A string as a JSX attribute value. */
function literal(value) {
  return JSON.stringify(value);
}

/**
 * The elements a release's page mounted that cannot run on a cut one, each
 * replaced by what it resolved to at the pinned commit.
 *
 * - `WorkshopNotice` reads the current navigation, and the release knew whether
 *   the package was private. So it becomes that answer: a literal panel if it
 *   was, and nothing if it was not.
 * - `Probe` becomes a `FrozenProbe` carrying the call and the value the README
 *   stated at the pinned commit.
 * - A playground, a specimen or a demo runs the workspace package live and has
 *   no value to freeze, so it becomes a line pointing at the same page under
 *   `/next/`, where it runs.
 *
 * Anything else outside `surface.mjs`'s list is left in place, and
 * `surfaceFaults` refuses the page.
 *
 * @param {string} source
 * @param {{
 *   private: boolean,
 *   live: string,
 *   probe: (pkg: string, name: string) => { label: string, input: string, call: string, value: string },
 *   provenance: { package: string, version: string, sha: string },
 * }} context
 */
export function resolveComponents(source, context) {
  const edits = [];

  visit(parse(source), (node) => {
    if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement')
      return undefined;

    const { start, end } = node.position;
    const replace = (text) => {
      edits.push({ start: start.offset, end: end.offset, text });
      return 'skip';
    };

    if (node.name === 'WorkshopNotice') {
      if (!context.private) return replace('');

      const children = node.children.length
        ? source.slice(
            node.children[0].position.start.offset,
            node.children.at(-1).position.end.offset,
          )
        : '';

      return replace(
        [
          '<Panel heading="Not on npm yet">',
          '',
          '<Text size="sm">',
          `\`npm install ${context.provenance.package}\` did not resolve at this release. The package was \`private: true\`, so a release run versioned and tagged it without publishing.`,
          '</Text>',
          ...(children ? ['', children] : []),
          '',
          '</Panel>',
        ].join('\n'),
      );
    }

    if (node.name === 'Probe') {
      const pkg = attribute(node, 'package');
      const name = attribute(node, 'probe');
      const frozen = context.probe(pkg, name);
      const { package: packageName, version, sha } = context.provenance;

      return replace(
        `<FrozenProbe label=${literal(frozen.label)} input=${literal(frozen.input)} ` +
          `call=${literal(frozen.call)} value=${literal(frozen.value)} ` +
          `package=${literal(packageName)} version=${literal(version)} ` +
          `sha=${literal(sha)} live=${literal(context.live)} />`,
      );
    }

    if (live.has(node.name))
      return replace(
        `*The interactive example this release showed here runs against the current source, so it is on [the same page under /next/](${context.live}) and not on this one.*`,
      );

    return undefined;
  });

  let out = source;
  for (const { start, end, text } of edits.sort((a, b) => b.start - a.start))
    out = out.slice(0, start) + text + out.slice(end);

  return out;
}

/**
 * The notice under a page's title, with every prop a literal.
 *
 * Under the first `# ` heading, which is the title Nextra reads, so the notice
 * is the first thing in the body. A page with no heading gets it at the top.
 */
export function withNotice(source, props) {
  const attributes = Object.entries(props)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${literal(value)}`)
    .join(' ');
  const notice = `<ArchiveNotice ${attributes} />`;
  const lines = source.split('\n');
  const title = lines.findIndex((line) => /^# /.test(line));

  if (title === -1) return [notice, '', ...lines].join('\n');

  return [
    ...lines.slice(0, title + 1),
    '',
    notice,
    ...lines.slice(title + 1),
  ].join('\n');
}

/**
 * What a cut page carries that it may not, as one line each.
 *
 * An element outside the list, an ESM statement, a fence that would still be
 * filled or compiled from `main`, and a reference directive that was not
 * expanded. Empty for a page that can be served for as long as its release is
 * retained. The cut runs this on every page it writes and
 * `tools/repo-checks/src/docs-archive.test.ts` runs it again over every
 * generated directory.
 */
export function surfaceFaults(source) {
  const faults = [];

  if (/^<!--\s*reference\b/m.test(source))
    faults.push('a reference directive was not expanded');

  let tree;
  try {
    tree = parse(source);
  } catch (error) {
    return [...faults, `does not parse as MDX: ${error.message}`];
  }

  visit(tree, (node) => {
    if (
      (node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement') &&
      !permitted(node.name)
    )
      faults.push(`<${node.name}> is not an element a cut page may carry`);

    if (node.type === 'mdxjsEsm')
      faults.push(`imports or exports: ${node.value.split('\n')[0]}`);

    if (node.type === 'code') {
      const info = `${node.lang ?? ''} ${node.meta ?? ''}`;
      if (REFERENCE.test(info))
        faults.push(`a fence still names a region: ${info.trim()}`);
      if (/\btwoslash\b/.test(info))
        faults.push(`a fence still compiles: ${info.trim()}`);
    }
  });

  return faults;
}

/**
 * The probe a page mounted, as the pinned commit defined it and its README
 * stated it.
 *
 * The probe's module at that commit names its label and the README region it
 * reproduces. The region's first value claim whose call opens with a string
 * argument is the pair a reader saw seeded in the field: the argument, and the
 * value CI checked the call returns.
 *
 * @param {(path: string) => string} read a file at the pinned commit
 * @param {string} pkg the probe's package, as `<Probe package>` names it
 * @param {string} name the probe's export
 */
export function readProbe(read, pkg, name) {
  const definitions = read(`apps/docs/components/probes/${pkg}.ts`);
  const start = definitions.search(
    new RegExp(`export const ${name}\\b[^=]*=\\s*\\{`),
  );
  if (start === -1)
    throw new Error(
      `no probe '${name}' in probes/${pkg}.ts at the pinned commit`,
    );

  const body = definitions.slice(start);
  const string = (key) =>
    body.match(new RegExp(`\\b${key}:\\s*(['"])((?:\\\\.|(?!\\1).)*)\\1`))?.[2];
  const label = string('label');
  const region = body.match(
    /region:\s*\{\s*file:\s*(['"])([^'"]+)\1,\s*name:\s*(['"])([^'"]+)\3/,
  );

  if (!label || !region)
    throw new Error(
      `probe '${name}' in probes/${pkg}.ts names no label or region at the pinned commit`,
    );

  const code = readRegion(read(region[2]), region[2], region[4]).code;

  for (const line of code.split('\n')) {
    const claim = line.match(/^\s*(.*?);?\s*\/\/\s*->\s*(.+)$/);
    const call = claim?.[1].match(/^[\w.]+\((['"])((?:\\.|(?!\1).)*)\1.*\)$/);
    if (claim && call)
      return {
        label,
        input: call[2],
        call: claim[1],
        value: claim[2].trim(),
      };
  }

  throw new Error(
    `probe '${name}' has no stated call in ${region[2]} region '${region[4]}' at the pinned commit`,
  );
}

/**
 * Cuts one page.
 *
 * @param {string} source the page at the pinned commit
 * @param {{
 *   page: string,
 *   own: string,
 *   read: (path: string) => string,
 *   references?: { root: string } | null,
 *   private: boolean,
 *   live: string,
 *   notice: Record<string, string | undefined>,
 *   provenance: { package: string, version: string, sha: string },
 * }} context
 */
export function cutPage(source, context) {
  let page = source;

  if (/^<!--\s*reference\b/m.test(page)) {
    if (!context.references)
      throw new Error(
        `${context.page}: carries reference directives and no package was materialised to expand them`,
      );
    page = expandReferences(page, context.references.root, context.page);
  }

  page = inlineRegions(page, context.read, context.page);
  page = plainFences(page);
  page = freezeCatalogues(page);
  page = resolveComponents(page, {
    private: context.private,
    live: context.live,
    provenance: context.provenance,
    probe: (pkg, name) => readProbe(context.read, pkg, name),
  });
  page = relativeLinks(page, context.own, context.page.replace(/\.mdx$/, ''));
  page = withNotice(page, context.notice);

  const faults = surfaceFaults(page);
  if (faults.length > 0)
    throw new Error(
      `${context.page} cannot be cut:\n  ${faults.join('\n  ')}\n` +
        'Add a component to components/archive/surface.mjs only if it reads ' +
        'nothing that changes with main.',
    );

  return page;
}
