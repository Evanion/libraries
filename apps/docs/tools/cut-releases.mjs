import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { packages } from '../app/navigation.ts';
import { PIN_FILE, gitAt, readPins } from './archives.mjs';
import { dryRunVersion, seedPin } from './seed.mjs';
import { releaseLines } from './versions.mjs';

/**
 * Pins every retained release line that has no pin for its newest release,
 * and writes `apps/docs/archives.json`.
 *
 * Run by a person, with `main` checked out as `origin` has it, when the site
 * should record what each line is cut from:
 * `node apps/docs/tools/cut-releases.mjs`. A line whose release carries its
 * section is pinned to its tag. A current release that shipped no pages is
 * asked the seed question -- `seed.mjs` carries it -- and pinned to that
 * commit when it seeds, or to `/next/` under a notice when it does not, with
 * the dry run's answer as the reason. An existing pin for the same release is
 * kept: re-cutting one is a pull request, which `docs-recut.yml` opens.
 *
 * A seed pins `origin/main`, because `main` is rebase-only: the pull request
 * that lands the pin file writes every branch commit again under another SHA,
 * and a pin naming the old one names nothing on `main`.
 */

const root = join(import.meta.dirname, '..', '..', '..');
const git = gitAt(root);
const pins = readPins(root);
const main = git.commit('origin/main');

// The dry run below reads the checked-out tree, which has to be the commit a
// seed pins.
if (git.commit('HEAD') !== main)
  throw new Error(
    'Check out origin/main first: a seed pins the commit the dry run read, ' +
      'and only a commit on main outlives the pull request that lands the pin.',
  );

const tags = git.tags();

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

  const [current, previous] = releaseLines(entry.name, tags);

  for (const line of [current, previous]) {
    if (!line) continue;

    const newest = line.releases[0];
    if (pins[entry.slug]?.[line.segment]?.version === newest.version) continue;

    const tagged = git.commit(newest.tag);
    const pin = hasPages(tagged, entry.slug)
      ? { version: newest.version, tag: newest.tag, sha: tagged }
      : line === current
        ? seedPin({
            name: entry.name,
            tag: newest.tag,
            version: newest.version,
            main,
            computed: compute,
            dependencies,
          })
        : null;

    if (!pin) continue;

    pins[entry.slug] = { ...pins[entry.slug], [line.segment]: pin };
    console.log(
      `${entry.slug} ${line.segment}: ${pin.reason ?? `tag ${pin.sha.slice(0, 7)}`}`,
    );
  }
}

writeFileSync(join(root, PIN_FILE), `${JSON.stringify(pins, null, 2)}\n`);
