/**
 * Runs the libraries' suites with coverage and writes what the `/testing`
 * section renders.
 *
 * Nothing on that section is typed by a person and nothing is copied from
 * another file, because the reader the section is written for is a reader who
 * already suspects the numbers. A figure that cannot be reproduced is worth
 * less to them than no figure at all, so every one of them is produced here,
 * by the build that produces the page.
 *
 * The scope is `nx.json`'s `release.projects`, resolved through the Nx project
 * graph the way `tools/repo-checks/src/docs-navigation.test.ts` resolves it.
 * That makes the section's scope the same predicate as the release scope, so a
 * twelfth library appears on the page the day it is released and nothing here
 * is edited.
 *
 * A missing or unreadable report fails this script, which fails the build. A
 * failing run writes no coverage summary at all, so the absent file is already
 * the signal; rendering a dash or an earlier number in its place would turn a
 * red build into a quiet one.
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { createProjectGraphAsync, parseJson } from '@nx/devkit';
import { findMatchingProjects } from 'nx/src/devkit-internals.js';

import {
  groupEntries,
  KINDS_OUTSIDE,
  parseRegister,
  rankEntries,
  reduceDocExamples,
  reduceProject,
  reduceRun,
} from './statistics.mjs';

const docsRoot = join(import.meta.dirname, '..');
const workspaceRoot = join(docsRoot, '..', '..');
const output = join(docsRoot, 'components', 'testing', 'statistics.json');

/** The libraries `nx release` versions, which is what the section counts. */
async function libraries() {
  const nxJson = parseJson(
    readFileSync(join(workspaceRoot, 'nx.json'), 'utf-8'),
    { expectComments: true },
  );
  const patterns = nxJson.release?.projects;
  if (!patterns) throw new Error('nx.json must define release.projects');

  const graph = await createProjectGraphAsync({ exitOnError: false });
  const names = findMatchingProjects(
    Array.isArray(patterns) ? patterns : [patterns],
    graph.nodes,
  );

  return names
    .map((name) => ({ name, root: graph.nodes[name].data.root }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * The sweep: one `nx run-many` over the same pattern `release.projects`
 * carries, with coverage on.
 *
 * Through Nx rather than a `vitest` per project, for two reasons. Nx orders
 * each library's own build and its dependencies' builds ahead of its tests,
 * which a bare `vitest` does not, and a library whose type tests resolve a
 * dependency's declarations fails without them. And `npx nx test <package>` is
 * the line the page prints under that package's counts, so the numbers on the
 * page come from the command a reader is told to run.
 *
 * `--outputFile` is relative, so each project's Vitest resolves it against its
 * own root and the reports land one per library. Inside the coverage
 * directory, because that is what the `test` target declares as its output and
 * therefore what a cache replay restores.
 */
function sweep() {
  execFileSync(
    'npx',
    [
      'nx',
      'run-many',
      '--target=test',
      '--projects=libs/*',
      '--coverage',
      '--coverage.enabled',
      '--coverage.reporter=json-summary',
      '--reporter=json',
      `--outputFile=${REPORT}`,
    ],
    { cwd: workspaceRoot, stdio: 'inherit' },
  );
}

const REPORT = 'test-output/vitest/coverage/report.json';

/** What one library's run left behind, read back off disk. */
function reportsOf(project) {
  const directory = join(workspaceRoot, project.root, dirname(REPORT));
  const read = (name) => {
    const path = join(directory, name);
    return existsSync(path)
      ? JSON.parse(readFileSync(path, 'utf8'))
      : undefined;
  };

  return {
    report: read('report.json'),
    coverage: read('coverage-summary.json'),
  };
}

/** Every `.mdx` page under `content/`, so the fences in them can be counted. */
function pages(directory) {
  const found = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...pages(path));
    else if (entry.name.endsWith('.mdx')) found.push(path);
  }

  return found;
}

/**
 * What the site's own content carries: compiled fences and region references.
 *
 * The info string is read off the page as written, which is the rule a
 * measurement over `file=` fences inherits -- the loader fills the body during
 * the build, so a count taken from the body would count the source file's
 * lines and a count taken from the info string counts references.
 */
function content() {
  const sources = pages(join(docsRoot, 'content')).map((path) =>
    readFileSync(path, 'utf8'),
  );

  const count = (pattern) =>
    sources.reduce(
      (sum, source) => sum + (source.match(pattern)?.length ?? 0),
      0,
    );

  return {
    pages: sources.length,
    twoslash: count(/^```\w+[^\n]*\btwoslash\b/gm),
    regions: count(/^```\w+[^\n]*\bregion=/gm),
  };
}

/** The guards, and the backlog they record against themselves. */
function guards() {
  const allowance = (name) =>
    JSON.parse(
      readFileSync(
        join(workspaceRoot, 'tools', 'repo-checks', 'src', name),
        'utf8',
      ),
    );

  const exports = allowance('doc-export-coverage-allowance.json');
  const fences = allowance('doc-fence-allowance.json');
  const sum = (object, pick) =>
    Object.values(object).reduce((total, one) => total + pick(one), 0);

  return {
    files: readdirSync(
      join(workspaceRoot, 'tools', 'repo-checks', 'src'),
    ).filter((name) => name.endsWith('.test.ts')).length,
    undocumented: sum(exports, (one) => one.undocumented?.length ?? 0),
    unexercised: sum(exports, (one) => one.unexercised?.length ?? 0),
    packages: Object.keys(exports).length,
    fences: sum(fences, (one) => (typeof one === 'number' ? one : 0)),
  };
}

/** The entry whose test constructs the seeded generator, read off the suite. */
function seeded(source) {
  const found = [];
  let open = null;

  for (const line of source.split('\n')) {
    const heading = line.match(/^describe\('(SEC-\d+)/);
    if (heading) open = heading[1];
    if (open && line.includes('new Gen(')) {
      found.push(open);
      open = null;
    }
  }

  return [...new Set(found)];
}

const projects = await libraries();
sweep();
const runs = projects.map((project) => ({ project, ...reportsOf(project) }));

const register = parseRegister(
  readFileSync(join(workspaceRoot, 'libs', 'acl', 'SECURITY.md'), 'utf8'),
);
const generated = seeded(
  readFileSync(
    join(
      workspaceRoot,
      'libs',
      'acl',
      'src',
      'security',
      'tier1-prevented.test.ts',
    ),
    'utf8',
  ),
);

const libs = runs.map((one) => reduceProject({ ...one.project, ...one }));
const adversarial = runs
  .find((one) => one.project.name === '@evanion/acl')
  .report.testResults.filter((result) => result.name.includes('/src/security/'))
  .reduce((sum, result) => sum + result.assertionResults.length, 0);

const statistics = {
  commit: execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  }).trim(),
  commitDate: execFileSync('git', ['show', '-s', '--format=%cs', 'HEAD'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  }).trim(),
  node: process.version,
  libraries: libs,
  totals: reduceRun(libs),
  docExamples: reduceDocExamples(runs.map((one) => one.report)),
  content: content(),
  guards: guards(),
  kindsOutside: KINDS_OUTSIDE,
  register: {
    entries: register.length,
    tiers: [1, 2, 3].map((tier) => ({
      tier,
      entries: register.filter((entry) => entry.tier === tier).length,
    })),
    owasp: register.filter((entry) => entry.owasp.length > 0).length,
    owaspIdentifiers: [
      ...new Set(register.flatMap((entry) => entry.owasp)),
    ].sort(),
    cwes: [...new Set(register.flatMap((entry) => entry.cwe))].length,
    adversarial,
    ranked: rankEntries(register, { generated }).map((entry) => entry.id),
    groups: groupEntries(register, { generated }),
    seeded: generated,
    cases: Object.fromEntries(
      rankEntries(register, { generated }).map((entry) => [entry.id, entry]),
    ),
  },
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(statistics, null, 2)}\n`);
console.log(
  `${output}: ${statistics.totals.cases} cases over ${statistics.totals.files} files in ${statistics.totals.libraries} libraries`,
);
