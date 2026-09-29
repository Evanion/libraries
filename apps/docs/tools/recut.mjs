import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { PIN_FILE, gitAt, parsePins } from './archives.mjs';
import { dryRunAt } from './seed.mjs';
import { releaseLines, taggedPast } from './versions.mjs';

/**
 * Re-cuts one released version of a package's documentation from a later
 * commit, as a one-entry change to `apps/docs/archives.json`.
 *
 * `docs/specs/2026-09-13-released-by-default.md` § 7 is the design, and
 * `.github/workflows/docs-recut.yml` is the one caller: it runs this, commits
 * the pin file on a branch and opens a pull request whose body is what this
 * prints. Nothing here pushes. The pull request is the control, and its body
 * carries the diff of the section between the commit the version is cut from
 * now and the one it would be cut from, so a reviewer sees exactly how the
 * released documentation changes without going to look.
 *
 * The version is the line's x.y.0, which its patches are documented by, so a
 * documentation fix reaches a patch release through the x.y.0's pin.
 *
 * The guards are the pin file's own, asked before the pull request exists
 * rather than after: the version was released, the commit descends from its tag
 * and is on `main`, carries no tag of a later x.y, the reason is new, and
 * `nx release version --dry-run` at the commit computes no change.
 */

/**
 * The pin a re-cut writes, and the commit the version is cut from now.
 *
 * @param {{
 *   pins: ReturnType<typeof parsePins>,
 *   entry: { name: string, slug: string, documented: boolean, workshop: boolean, unversioned?: string },
 *   tags: readonly string[],
 *   segment: string,
 *   sha: string,
 *   reason: string,
 *   git: ReturnType<typeof gitAt>,
 *   main: string,
 *   computed: (sha: string, name: string) => string | null,
 * }} request
 */
export function recutPin({
  pins,
  entry,
  tags,
  segment,
  sha,
  reason,
  git,
  main,
  computed,
}) {
  if (!entry.documented || entry.unversioned || entry.workshop)
    throw new Error(`${entry.slug} has no versioned section to re-cut`);

  const line = releaseLines(entry.name, tags).find(
    (each) => each.segment === segment,
  );
  if (!line)
    throw new Error(
      `${entry.name} has released nothing in the line ${segment}`,
    );

  const release = line.cut;
  const tagged = git.commit(release.tag);
  const target = git.commit(sha);

  if (!target) throw new Error(`${sha} is not a commit in this repository`);
  if (!git.isAncestor(tagged, target))
    throw new Error(`${sha} does not descend from ${release.tag}`);
  if (!git.isAncestor(target, main)) throw new Error(`${sha} is not on main`);

  // The dry run measures from the newest tag, so past a later x.y.0 it
  // computes no change for an older one and cannot refuse the commit itself.
  // A patch of this x.y is documented by these pages, so carrying its tag is
  // not a reason to refuse.
  const later = taggedPast(entry.name, tags, release.version).filter((tag) =>
    git.isAncestor(git.commit(tag), target),
  );
  if (later.length > 0)
    throw new Error(
      `${sha} carries ${later.join(', ')}, so it is not documentation of ${release.version}`,
    );
  if (reason.trim() === '') throw new Error('a re-cut gives a reason');

  const taken = Object.entries(pins).flatMap(([slug, lines]) =>
    Object.entries(lines)
      .filter(([, pin]) => pin.reason === reason.trim())
      .map(([each]) => `${slug}.${each}`),
  );
  if (taken.length > 0)
    throw new Error(`${taken.join(', ')} already gives that reason`);

  if (target !== tagged) {
    const version = computed(target, entry.name);
    if (version !== null)
      throw new Error(
        `nx release version --dry-run at ${sha} computes ${version}, so it is ` +
          `not documentation of ${release.version}`,
      );
  }

  const held = pins[entry.slug]?.[segment];
  const same = held?.version === release.version;
  const current = same && held.sha ? git.commit(held.sha) : tagged;
  // A pinned path names where the section was at the old commit. It carries
  // over only if the section is still there at the new one.
  const path =
    same &&
    held.path &&
    git.files(target, held.path).includes(`${held.path}/index.mdx`)
      ? held.path
      : undefined;

  return {
    release,
    from: current,
    pin: {
      version: release.version,
      tag: release.tag,
      sha: target,
      ...(path ? { path } : {}),
      reason: reason.trim(),
    },
  };
}

/** The pull request body: what is re-cut, why, and how the pages change. */
export function recutBody({ entry, segment, release, from, pin, diff }) {
  return [
    `Re-cuts the documentation of \`${entry.name}\` ${release.version} (\`/${entry.slug}/\` or \`/${entry.slug}/${segment}/\`) from \`${pin.sha.slice(0, 7)}\`, where it is cut from \`${from.slice(0, 7)}\` today.`,
    '',
    `Reason: ${pin.reason}`,
    '',
    'How the released pages change:',
    '',
    '````diff',
    diff.trim() === '' ? '(no change under the section)' : diff.trim(),
    '````',
    '',
  ].join('\n');
}

if (argv[1] && resolve(argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      slug: { type: 'string' },
      segment: { type: 'string' },
      sha: { type: 'string', default: 'HEAD' },
      reason: { type: 'string' },
      body: { type: 'string' },
    },
  });
  const root = join(import.meta.dirname, '..', '..', '..');
  const { packages } = await import('../app/navigation.ts');
  const entry = packages.find((each) => each.slug === values.slug);
  if (!entry) throw new Error(`no package has the slug ${values.slug}`);

  const git = gitAt(root);
  const path = join(root, PIN_FILE);
  const pins = parsePins(readFileSync(path, 'utf8'));
  const recut = recutPin({
    pins,
    entry,
    tags: git.tags(),
    segment: values.segment ?? '',
    sha: values.sha || 'HEAD',
    reason: values.reason ?? '',
    git,
    main: git.commit('origin/main'),
    computed: (sha, name) => dryRunAt(root, sha, name),
  });

  pins[entry.slug] = { ...pins[entry.slug], [values.segment]: recut.pin };
  writeFileSync(path, `${JSON.stringify(pins, null, 2)}\n`);

  const diff = execFileSync(
    'git',
    [
      'diff',
      '-M',
      recut.from,
      recut.pin.sha,
      '--',
      `apps/docs/content/next/${entry.slug}/`,
      `apps/docs/content/${entry.slug}/`,
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const body = recutBody({ entry, segment: values.segment, ...recut, diff });

  if (values.body) writeFileSync(values.body, body);
  else console.log(body);
}
