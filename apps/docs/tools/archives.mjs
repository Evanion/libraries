import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { behavioursOf } from '@evanion/doc-examples/behaviours';
import ts from 'typescript';

import { cutPage } from './cut.mjs';
import { releaseLines } from './versions.mjs';

/**
 * What each package section serves at its bare path and at each retained
 * release line, and the writer that puts it under `content/`.
 *
 * `docs/specs/2026-09-13-released-by-default.md` is the design. The pages a
 * person writes are at `content/next/<slug>/` and are served at `/next/<slug>/`.
 * The bare path `/<slug>/` serves the package's newest release, and
 * `/<slug>/v<seg>/` the newest release of the line before it. Both are written
 * here before `next build`, into directories git ignores, because Nextra reads
 * one content root at config load and every version has to be a directory
 * under it.
 *
 * A version directory is cut from git. `apps/docs/archives.json` pins what a
 * release line is cut from; a line whose newest release it does not name is cut
 * from that release's own tag. So a release needs no commit here to be
 * documented -- the push that tags it rebuilds the site, and the tag is what the
 * build reads -- and a pin exists only to record a decision a person made about
 * a release: a seed, a re-cut, a section that lived at another path, or a
 * release that shipped no pages at all.
 */

/** The pin file, relative to the workspace root. */
export const PIN_FILE = 'apps/docs/archives.json';

/** Where a section's pages live in a tree, newest layout first. */
const SOURCE_DIRS = (slug) => [
  `apps/docs/content/next/${slug}`,
  `apps/docs/content/${slug}`,
];

/** The generated file each version directory carries, naming what it is. */
const STAMP = '.cut.json';

/**
 * The file the site reads to know what was written.
 *
 * Also the one output of `docs:archives` that the build's cache key reads
 * (`apps/docs/package.json`). It names the release and commit behind every
 * directory written here, and the tags those come from are in no file nx
 * hashes: without it, a release of a package the site has no import of would
 * leave the build's inputs unchanged, and a cache hit would restore the
 * previous release's bare path.
 */
export const MANIFEST = 'versions.json';

function lines(output) {
  return output === '' ? [] : output.split('\n');
}

/**
 * The git questions the generator asks, over one repository.
 *
 * `show` keeps its output byte for byte, because a page's trailing newline is
 * part of the page.
 */
export function gitAt(root) {
  const run = (args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  return {
    root,
    tags: () => lines(run(['tag', '--list']).trim()),
    commit(ref) {
      try {
        return run([
          'rev-parse',
          '--verify',
          '--quiet',
          `${ref}^{commit}`,
        ]).trim();
      } catch {
        return null;
      }
    },
    files: (sha, dir) =>
      lines(run(['ls-tree', '-r', '--name-only', sha, '--', `${dir}/`]).trim()),
    show: (sha, path) => run(['show', `${sha}:${path}`]),
    isAncestor(ancestor, descendant) {
      try {
        run(['merge-base', '--is-ancestor', ancestor, descendant]);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * The pin file, checked for shape.
 *
 * One entry per (slug, segment). An entry names the release it applies to, so
 * a pin for 3.0.0 says nothing about 3.0.1 and a release in the same line is cut
 * from its own tag until somebody pins it.
 *
 * @returns {Record<string, Record<string, {
 *   version: string, tag: string, sha?: string, path?: string,
 *   next?: true, reason?: string,
 * }>>}
 */
export function parsePins(text, file = PIN_FILE) {
  const pins = JSON.parse(text);
  const faults = [];

  for (const [slug, entries] of Object.entries(pins)) {
    for (const [segment, pin] of Object.entries(entries)) {
      const at = `${file}: ${slug}.${segment}`;

      if (typeof pin.version !== 'string')
        faults.push(`${at} names no version`);
      if (typeof pin.tag !== 'string') faults.push(`${at} names no tag`);
      if (pin.next === true) {
        if (pin.sha !== undefined)
          faults.push(`${at} is served from /next/ and pins a commit`);
      } else if (
        typeof pin.sha !== 'string' ||
        !/^[0-9a-f]{7,40}$/.test(pin.sha)
      ) {
        faults.push(`${at} pins no commit`);
      }
      if (pin.path !== undefined && typeof pin.path !== 'string')
        faults.push(`${at} names a path that is not a string`);
      if (
        pin.reason !== undefined &&
        (typeof pin.reason !== 'string' || pin.reason.trim() === '')
      )
        faults.push(`${at} gives an empty reason`);
    }
  }

  if (faults.length > 0) throw new Error(faults.join('\n'));

  return pins;
}

/** The pin file of the repository at `root`, or no pins when it has none. */
export function readPins(root) {
  const path = join(root, PIN_FILE);

  return existsSync(path) ? parsePins(readFileSync(path, 'utf8')) : {};
}

/**
 * The directory a section's pages are in at a commit, or `null` when the
 * commit carries no section index there.
 */
function sourceDir(git, sha, slug, path) {
  for (const dir of path ? [path] : SOURCE_DIRS(slug)) {
    if (git.files(sha, dir).some((file) => file === `${dir}/index.mdx`))
      return dir;
  }

  return null;
}

/**
 * How a line's newest release is served.
 *
 * The pin decides when it names that release. Otherwise the release's own tag,
 * and when the tag carries no section index, `main` under a notice.
 */
function resolveLine(git, entry, line, pins) {
  const newest = line.releases[0];
  const tagged = git.commit(newest.tag);
  const pin = pins[entry.slug]?.[line.segment];
  const pinned = pin?.version === newest.version ? pin : null;
  const release = {
    version: newest.version,
    tag: newest.tag,
    segment: line.segment,
  };

  if (pinned?.next)
    return { ...release, from: 'next', reason: pinned.reason ?? null };

  const sha = pinned ? git.commit(pinned.sha) : tagged;
  if (!sha)
    throw new Error(
      `${PIN_FILE}: ${entry.slug}.${line.segment} pins ${pinned?.sha ?? newest.tag}, which is not a commit in this repository`,
    );

  const dir = sourceDir(git, sha, entry.slug, pinned?.path);
  if (!dir) {
    if (pinned?.path)
      throw new Error(
        `${PIN_FILE}: ${entry.slug}.${line.segment} names ${pinned.path}, which holds no index.mdx at ${pinned.sha}`,
      );
    return {
      ...release,
      from: 'next',
      reason: `${newest.tag} carries no pages`,
    };
  }

  const source =
    sha === tagged
      ? 'tag'
      : /^seed:/.test(pinned?.reason ?? '')
        ? 'seed'
        : 'recut';

  return {
    ...release,
    from: 'cut',
    sha,
    dir,
    source,
    reason: pinned?.reason ?? null,
  };
}

/**
 * Every directory the generator writes, for every documented package.
 *
 * Retention is the current line plus the one before it
 * (`docs/specs/2026-09-13-versioned-docs.md` decision 10, which the
 * released-by-default spec keeps). A previous line whose release carries no
 * pages gets no directory: there is nothing it documented.
 *
 * A workshop package is served as one with no release. It is `private`, so a
 * release run tags it and publishes nothing, and a tag of it names no version
 * `npm install` can give a reader.
 *
 * @param {{
 *   packages: readonly { name: string, slug: string, documented: boolean, workshop: boolean, unversioned?: string }[],
 *   git: ReturnType<typeof gitAt>,
 *   pins: ReturnType<typeof parsePins>,
 * }} inputs
 */
export function plan({ packages, git, pins }) {
  const tags = git.tags();
  const sections = [];

  for (const entry of packages) {
    if (!entry.documented || entry.unversioned) continue;

    const released = entry.workshop ? [] : releaseLines(entry.name, tags);
    const [current, previous] = released;
    const section = {
      slug: entry.slug,
      name: entry.name,
      current: null,
      lines: [],
    };

    section.current = current
      ? resolveLine(git, entry, current, pins)
      : { version: null, tag: null, segment: null, from: 'next', reason: null };

    if (previous) {
      const line = resolveLine(git, entry, previous, pins);
      if (line.from === 'cut')
        section.lines.push({ ...line, current: current.releases[0].version });
    }

    sections.push(section);
  }

  return sections;
}

/** Every file under a directory, relative to it, with `/` separators. */
function walk(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return walk(path).map((each) => `${entry.name}/${each}`);
    return [entry.name];
  });
}

/** The pages in a directory as routes inside it: `''` for the index. */
function routesOf(files) {
  return files
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => file.replace(/\.mdx$/, '').replace(/(^|\/)index$/, ''))
    .sort();
}

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

/** A page with its `# ` title followed by an element, as `cut.mjs` places one. */
function underTitle(source, element) {
  const lines = source.split('\n');
  const title = lines.findIndex((line) => /^# /.test(line));

  if (title === -1) return [element, '', ...lines].join('\n');

  return [
    ...lines.slice(0, title + 1),
    '',
    element,
    ...lines.slice(title + 1),
  ].join('\n');
}

/**
 * The bare path of a release that shipped no pages, as `main`'s pages under a
 * notice saying so.
 *
 * A copy and not a cut: the pages are `main`'s, their regions and probes run
 * against the current source like every page under `/next/`, and the notice is
 * what says that is what the reader is looking at.
 */
function mirror(contentDir, section) {
  const from = join(contentDir, 'next', section.slug);
  const to = join(contentDir, section.slug);
  const version = section.current.version;

  for (const file of walk(from)) {
    const source = readFileSync(join(from, file), 'utf8');

    write(
      join(to, file),
      file.endsWith('.mdx') && version
        ? underTitle(
            source,
            `<ArchiveNotice kind="next" package=${JSON.stringify(section.name)} version=${JSON.stringify(version)} />`,
          )
        : source,
    );
  }

  return routesOf(walk(from));
}

/**
 * Every workspace package in the tree at a commit, by name.
 *
 * Read from the tree rather than from today's project graph, because a
 * package's directory moves: `@evanion/nestjs-correlation-id` was under `nest/`
 * for its first releases.
 */
function workspaceAt(git, sha) {
  const found = new Map();

  for (const dir of ['libs', 'nest', 'internal']) {
    for (const file of git.files(sha, dir)) {
      if (!/^[^/]+\/[^/]+\/package\.json$/.test(file)) continue;
      const manifest = JSON.parse(git.show(sha, file));
      found.set(manifest.name, { dir: dirname(file), manifest });
    }
  }

  return found;
}

/**
 * A package's declarations as its own build would have written them at the
 * pinned commit, for the reference loader to read.
 *
 * The loader reads `dist/*.d.ts` through the package's `exports`, and a
 * commit's `dist/` is not in git. So the package's source is compiled here, with
 * declarations only, and a workspace dependency is compiled first so the
 * package resolves it the way a consumer would.
 */
function emitDeclarations(packageDir) {
  const sources = walk(join(packageDir, 'src'))
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => !/\.(test|spec|test-d)\.tsx?$/.test(file))
    .filter((file) => !file.startsWith('security/') && file !== 'test-setup.ts')
    .map((file) => join(packageDir, 'src', file));

  const program = ts.createProgram(sources, {
    declaration: true,
    emitDeclarationOnly: true,
    noEmitOnError: false,
    rootDir: join(packageDir, 'src'),
    outDir: join(packageDir, 'dist'),
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    skipLibCheck: true,
    types: [],
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  });

  program.emit();
}

/**
 * The packages a set of pages references, as they were at the pinned commit,
 * under a root the reference loader can read them from.
 *
 * Under `node_modules/.cache` in the workspace, so a package's own imports of
 * something the workspace installs -- React, for a binding -- still resolve by
 * walking up, while each `@evanion/*` package resolves to its copy here. Keyed
 * by the generator as well as the commit, because the declarations and the
 * behaviour data are the generator's reading of that commit.
 */
function materialise(git, sha, names, workspaceRoot, generator) {
  const root = join(
    workspaceRoot,
    'node_modules',
    '.cache',
    'docs-archives',
    `${generator}-${sha}`,
  );
  const done = join(root, '.complete');
  if (existsSync(done)) return root;

  rmSync(root, { recursive: true, force: true });
  const workspace = workspaceAt(git, sha);
  const needed = [];
  const visit = (name) => {
    if (needed.includes(name) || !workspace.has(name)) return;
    const { manifest } = workspace.get(name);
    for (const dependency of Object.keys({
      ...manifest.dependencies,
      ...manifest.peerDependencies,
    }))
      visit(dependency);
    needed.push(name);
  };
  for (const name of names) visit(name);

  for (const name of needed) {
    const { dir } = workspace.get(name);
    const packageDir = join(root, 'node_modules', name);

    for (const file of git.files(sha, dir)) {
      if (!/\.(tsx?|mts|json|md)$/.test(file)) continue;
      write(join(packageDir, relative(dir, file)), git.show(sha, file));
    }

    emitDeclarations(packageDir);

    const { files, states } = behavioursOf(packageDir);
    write(
      join(
        root,
        'apps',
        'docs',
        'components',
        'api',
        'behaviour',
        `${dir.split('/').at(-1)}.json`,
      ),
      `${JSON.stringify({
        package: name,
        files: files.map((file) => relative(root, file).split(sep).join('/')),
        states: Object.fromEntries(
          [...states].map(([key, held]) => [
            key,
            [...held.values()].map(({ chain, generated, id }) => ({
              chain,
              generated,
              id,
            })),
          ]),
        ),
      })}\n`,
    );
  }

  writeFileSync(done, '');
  return root;
}

/**
 * Cuts one version directory from git.
 *
 * `own` is the section's directory name at the commit, which is what its
 * absolute links spell. `notice` is what the cut writes under every title.
 * `generator` is `generatorHash()`, which keys the packages it compiles.
 */
function cut(
  git,
  contentDir,
  workspaceRoot,
  generator,
  section,
  line,
  target,
  notice,
) {
  const own = line.dir.split('/').at(-1);
  const files = git
    .files(line.sha, line.dir)
    .map((file) => file.slice(line.dir.length + 1));
  const pages = files.filter((file) => file.endsWith('.mdx'));
  const workspace = workspaceAt(git, line.sha);
  const packageAt = workspace.get(section.name);
  const read = (path) => git.show(line.sha, path);
  const nextPages = new Set(
    routesOf(walk(join(contentDir, 'next', section.slug))),
  );

  const referenced = new Set();
  for (const page of pages)
    for (const match of read(`${line.dir}/${page}`).matchAll(
      /^<!--\s*reference\s+(@[\w-]+\/[\w-]+)/gm,
    ))
      referenced.add(match[1]);

  const references =
    referenced.size > 0
      ? {
          root: materialise(
            git,
            line.sha,
            [...referenced],
            workspaceRoot,
            generator,
          ),
        }
      : null;

  for (const file of files) {
    const source = read(`${line.dir}/${file}`);

    if (!file.endsWith('.mdx')) {
      write(join(target, file), source);
      continue;
    }

    const route = file.replace(/\.mdx$/, '').replace(/(^|\/)index$/, '');
    const live = `/next/${section.slug}/${nextPages.has(route) && route !== '' ? `${route}/` : ''}`;

    write(
      join(target, file),
      cutPage(source, {
        page: file,
        own,
        read,
        references,
        private: packageAt?.manifest.private === true,
        live,
        notice,
        provenance: {
          package: section.name,
          version: line.version,
          sha: line.sha.slice(0, 7),
        },
      }),
    );
  }

  return routesOf(files);
}

/**
 * Hides the release lines inside a bare section from its sidebar.
 *
 * A line is a directory inside the section, and Nextra lists a directory its
 * `_meta` does not name after the pages it does. The section's own `_meta` is
 * the release's, so it is kept under another name and extended here rather
 * than edited.
 */
function hideLines(dir, segments) {
  if (segments.length === 0) return;

  const meta = join(dir, '_meta.ts');
  const hidden = Object.fromEntries(
    segments.map((segment) => [segment, { display: 'hidden' }]),
  );

  if (existsSync(meta)) {
    cpSync(meta, join(dir, 'meta.cut.ts'));
    writeFileSync(
      meta,
      `import cut from './meta.cut';\n\nexport default { ...cut, ...${JSON.stringify(hidden)} };\n`,
    );
  } else {
    writeFileSync(meta, `export default ${JSON.stringify(hidden)};\n`);
  }
}

/** A fingerprint of everything that decides what a cut writes. */
function generatorHash() {
  const hash = createHash('sha256');
  for (const file of [
    'archives.mjs',
    'cut.mjs',
    'versions.mjs',
    '../components/archive/surface.mjs',
    '../../../tools/doc-examples/src/mdx-reference-loader.mjs',
    '../../../tools/doc-examples/src/regions.mjs',
    '../../../tools/doc-examples/src/declarations.mjs',
    '../../../tools/doc-examples/src/behaviours.mjs',
  ])
    hash.update(readFileSync(join(import.meta.dirname, file)));
  return hash.digest('hex').slice(0, 16);
}

/** A fingerprint of every file under a directory but its stamp. */
function contentsHash(dir) {
  const hash = createHash('sha256');
  for (const file of walk(dir).sort()) {
    if (file === STAMP) continue;
    hash.update(`${file}\0`);
    hash.update(readFileSync(join(dir, file)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

/**
 * Writes every version directory under `content/`, and the manifest the site
 * reads to know what it wrote.
 *
 * A cut directory whose stamp names the same commit, notice and generator, and
 * whose files are the ones the stamp recorded, is kept as it is: reading a
 * section out of git and compiling a package's declarations is seconds, and
 * the development server runs this on every start. A directory someone edited
 * or deleted a page from is cut again. A copy of `content/next/` is always
 * written again, because the pages it copies are the ones being edited.
 *
 * @param {{
 *   docsRoot: string,
 *   workspaceRoot: string,
 *   packages: readonly { name: string, slug: string, documented: boolean, workshop: boolean, unversioned?: string }[],
 * }} options
 */
export function writeArchives({ docsRoot, workspaceRoot, packages }) {
  const git = gitAt(workspaceRoot);
  const pins = readPins(workspaceRoot);
  const contentDir = join(docsRoot, 'content');
  const sections = plan({ packages, git, pins });
  const generator = generatorHash();
  const manifest = { sections: {} };

  // A section that stopped being generated -- its package left the release
  // scope, or its pages went back to being written in place -- leaves nothing
  // behind for Nextra to serve.
  const generated = new Set(sections.map((section) => section.slug));
  for (const entry of packages) {
    if (!generated.has(entry.slug) && !entry.unversioned)
      rmSync(join(contentDir, entry.slug), { recursive: true, force: true });
  }

  for (const section of sections) {
    const bare = join(contentDir, section.slug);
    const wanted = {
      version: generator,
      current: section.current,
      lines: section.lines,
    };
    const stampPath = join(bare, STAMP);
    const stamp = existsSync(stampPath)
      ? JSON.parse(readFileSync(stampPath, 'utf8'))
      : null;
    let pages;

    if (
      section.current.from === 'cut' &&
      JSON.stringify(stamp?.wanted) === JSON.stringify(wanted) &&
      stamp.contents === contentsHash(bare)
    ) {
      pages = stamp.pages;
    } else {
      rmSync(bare, { recursive: true, force: true });
      pages = { current: null, lines: {} };

      const { current } = section;
      pages.current =
        current.from === 'cut'
          ? cut(
              git,
              contentDir,
              workspaceRoot,
              generator,
              section,
              current,
              bare,
              {
                kind: 'current',
                source: current.source,
                package: section.name,
                version: current.version,
                sha: current.sha.slice(0, 7),
              },
            )
          : mirror(contentDir, section);

      for (const line of section.lines) {
        pages.lines[line.segment] = cut(
          git,
          contentDir,
          workspaceRoot,
          generator,
          section,
          line,
          join(bare, line.segment),
          {
            kind: 'line',
            source: line.source,
            package: section.name,
            version: line.version,
            sha: line.sha.slice(0, 7),
            current: line.current,
            href: `/${section.slug}/`,
          },
        );
      }

      hideLines(
        bare,
        section.lines.map((line) => line.segment),
      );

      if (current.from === 'cut')
        write(
          stampPath,
          `${JSON.stringify({ wanted, pages, contents: contentsHash(bare) })}\n`,
        );
    }

    manifest.sections[section.slug] = {
      name: section.name,
      current: { ...section.current, pages: pages.current },
      lines: section.lines.map((line) => ({
        ...line,
        pages: pages.lines[line.segment],
      })),
      next: { pages: routesOf(walk(join(contentDir, 'next', section.slug))) },
    };
  }

  write(join(contentDir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);

  return manifest;
}
