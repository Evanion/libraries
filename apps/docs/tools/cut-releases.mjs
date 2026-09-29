import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { packages } from '../app/navigation.ts';
import { PIN_FILE, gitAt, prunePins, readPins } from './archives.mjs';
import { dryRunVersion, seedPin } from './seed.mjs';
import { releaseLines } from './versions.mjs';

/**
 * Brings `apps/docs/archives.json` up to the release tags, and writes it.
 *
 * Run after a release, with `main` checked out as `origin` has it:
 * `node apps/docs/tools/cut-releases.mjs`. It does two things, so that a
 * release never needs the pin file edited by hand:
 *
 * - It drops every pin a release made dead (`prunePins`). A pin names the
 *   x.y.0 its line is cut from, so a later x.y.0 in the line, or a line that
 *   leaves the two the site keeps, leaves it read by nothing, and the pin check
 *   in `tools/repo-checks` refuses it. A patch release drops nothing.
 * - It asks the seed question -- `seed.mjs` carries it -- of each current
 *   line whose x.y.0 shipped no pages and has no pin, and pins that release to
 *   `main` when it seeds, or to `/next/` under a notice when it does not, with
 *   the dry run's answer as the reason. An x.y.0 that shipped its pages takes
 *   no pin: the site cuts it from its own tag. An existing pin for the release
 *   is kept: re-cutting one is a pull request, which `docs-recut.yml` opens.
 *
 * A seed pins `origin/main`, because `main` is rebase-only: the pull request
 * that lands the pin file writes every branch commit again under another SHA,
 * and a pin naming the old one names nothing on `main`.
 */

const root = join(import.meta.dirname, '..', '..', '..');
const git = gitAt(root);
const main = git.commit('origin/main');

// The dry run below reads the checked-out tree, which has to be the commit a
// seed pins.
if (git.commit('HEAD') !== main)
  throw new Error(
    'Check out origin/main first: a seed pins the commit the dry run read, ' +
      'and only a commit on main outlives the pull request that lands the pin.',
  );

const tags = git.tags();

const { pins, dropped } = prunePins({ packages, pins: readPins(root), tags });
for (const { slug, segment, pin, read } of dropped)
  console.log(
    `${slug} ${segment}: dropped the pin for ${pin.version}, ${
      read
        ? `the site cuts ${segment} from ${read.version}`
        : `the site keeps no ${segment}`
    }`,
  );

const manifest = (name) =>
  JSON.parse(
    readFileSync(
      join(
        root,
        packages.find((entry) => entry.name === name).root,
        'package.json',
      ),
      'utf8',
    ),
  );

const workspace = new Set(packages.map((entry) => entry.name));
const dependencies = (name) =>
  Object.keys({
    ...manifest(name).dependencies,
    ...manifest(name).peerDependencies,
  }).filter((each) => workspace.has(each));

const computed = new Map();
const compute = (name) => {
  if (!computed.has(name)) {
    const output = execFileSync(
      'npx',
      ['nx', 'release', 'version', '--dry-run', `--projects=${name}`],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    computed.set(name, dryRunVersion(output, name));
  }
  return computed.get(name);
};

const hasPages = (sha, slug) =>
  [`apps/docs/content/next/${slug}`, `apps/docs/content/${slug}`].some((dir) =>
    git.files(sha, dir).includes(`${dir}/index.mdx`),
  );

for (const entry of packages) {
  if (!entry.documented || entry.unversioned || entry.workshop) continue;

  // A superseded line whose x.y.0 shipped no pages gets no directory, so only
  // the current line is asked the seed question.
  const [line] = releaseLines(entry.name, tags);
  if (!line) continue;

  const { cut } = line;
  if (pins[entry.slug]?.[line.segment]?.version === cut.version) continue;
  if (hasPages(git.commit(cut.tag), entry.slug)) continue;

  const pin = seedPin({
    name: entry.name,
    tag: cut.tag,
    version: cut.version,
    published: line.releases[0].version,
    main,
    computed: compute,
    dependencies,
  });

  pins[entry.slug] = { ...pins[entry.slug], [line.segment]: pin };
  console.log(`${entry.slug} ${line.segment}: ${pin.reason}`);
}

writeFileSync(join(root, PIN_FILE), `${JSON.stringify(pins, null, 2)}\n`);
