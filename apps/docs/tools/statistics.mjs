/**
 * The reduction behind the `/testing` section: vitest reports and coverage
 * summaries in, the numbers the page renders out.
 *
 * Pure, and separate from `test-statistics.mjs`, which runs the suite and
 * writes the file. Everything here is a function over data a caller read, so
 * the failure modes that decide the page -- a project that collected nothing,
 * a package with no coverage summary -- are tested against fixture reports
 * rather than against a run.
 *
 * Every function throws on missing input rather than returning a placeholder.
 * A failing test run writes no coverage summary at all, so an absent file is
 * already the signal that something went wrong, and a page that rendered a
 * dash there would turn a red build into a quiet one.
 */

/** A count a reader sees, with the separator the page's locale uses. */
export function format(count) {
  return count.toLocaleString('en-GB');
}

/**
 * One library's line on the page, from its vitest report and its coverage
 * summary.
 *
 * `report` is vitest's JSON reporter output and `coverage` is
 * `coverage-summary.json`. A report naming no test file means the project's
 * config failed to load or its run failed, and an absent project looks on the
 * page like a project with no tests, so this throws instead.
 */
export function reduceProject({ name, root, report, coverage }) {
  if (!report || !Array.isArray(report.testResults)) {
    throw new Error(`${name}: no vitest report`);
  }
  if (report.testResults.length === 0) {
    throw new Error(`${name}: collected no test file`);
  }
  if (report.numFailedTests > 0) {
    throw new Error(`${name}: ${report.numFailedTests} failing tests`);
  }
  if (!coverage || !coverage.total) {
    throw new Error(`${name}: no coverage summary`);
  }

  const files = report.testResults.map((result) => result.name);

  return {
    name,
    root,
    cases: report.numTotalTests,
    files: report.testResults.length,
    kinds: kindsOf(files),
    coverage: {
      statements: metric(coverage.total.statements),
      branches: metric(coverage.total.branches),
      functions: metric(coverage.total.functions),
      lines: metric(coverage.total.lines),
      files: Object.keys(coverage).filter((key) => key !== 'total').length,
    },
    shortfall: shortfall(coverage),
  };
}

function metric(entry) {
  return { pct: entry.pct, covered: entry.covered, total: entry.total };
}

/**
 * The files whose branch coverage is short, worst first, named so a reader can
 * open them.
 *
 * Branch coverage rather than statement coverage: the gap between the two is
 * the part of a coverage report that says something, and a file at 100% of
 * statements and 50% of branches is the one a reader wants named.
 */
function shortfall(coverage) {
  return Object.entries(coverage)
    .filter(([key]) => key !== 'total')
    .map(([path, entry]) => ({
      file: path.split('/src/').at(-1) ?? path,
      branches: entry.branches.pct,
      total: entry.branches.total,
    }))
    .filter((entry) => entry.branches < 100 && entry.total > 0)
    .sort((left, right) => left.branches - right.branches)
    .slice(0, 6);
}

/**
 * Which of the kinds in the documentation's list this project's run produced,
 * read off the paths of the files that ran.
 *
 * Derived rather than declared, so a library that starts carrying an
 * adversarial suite or an end-to-end test says so on the page with no edit
 * here. The kinds that live outside a library's vitest config are declared in
 * `test-statistics.mjs`, where the check that holds that list sits.
 */
function kindsOf(files) {
  const kinds = new Set();

  for (const file of files) {
    if (/\.test-d\.tsx?$/.test(file)) kinds.add('type');
    else if (/\.e2e\.spec\.ts$/.test(file)) kinds.add('end-to-end');
    else if (/\/security\//.test(file)) kinds.add('adversarial');
    else if (/\.astro\.test\.ts$/.test(file)) kinds.add('astro-container');
    else if (/\.(test|spec)\.tsx?$/.test(file)) kinds.add('behaviour');
    else kinds.add('doctest');
  }

  return [...kinds].sort();
}

/** The whole-section totals, which are sums and never averages. */
export function reduceRun(projects) {
  if (projects.length === 0) throw new Error('no library matched libs/*');

  return {
    libraries: projects.length,
    cases: projects.reduce((sum, project) => sum + project.cases, 0),
    files: projects.reduce((sum, project) => sum + project.files, 0),
  };
}

/**
 * The documented examples that ran, counted off the same reports.
 *
 * A result file that is not a test file is a doctest: `vite-plugin-doctest`
 * collects a README's fenced blocks and a source file's `@example` blocks
 * under the path they came from, so the path is what separates them.
 */
export function reduceDocExamples(reports) {
  let cases = 0;
  let files = 0;
  let fromReadme = 0;

  for (const report of reports) {
    for (const result of report.testResults) {
      if (/\.(test|spec|test-d)\.tsx?$/.test(result.name)) continue;
      files += 1;
      cases += result.assertionResults.length;
      if (result.name.endsWith('README.md'))
        fromReadme += result.assertionResults.length;
    }
  }

  return { cases, files, fromReadme };
}

const ROW = /^\|\s*(SEC-\d+)\s*\|(.*)\|\s*$/;

/**
 * A register cell as a sentence, with the markdown emphasis taken off.
 *
 * The register is read as markdown on GitHub and as text on the page, so the
 * backticks around an identifier and the bold around a word would arrive on the
 * page as themselves. The wording is the register's and stays as written.
 */
function sentence(cell) {
  const text = cell.replace(/[`*]/g, '').trim();

  return text.endsWith('.') ? text : `${text}.`;
}

/**
 * The register, parsed out of `libs/acl/SECURITY.md`.
 *
 * The file is the register and this reads it, rather than the page restating
 * it: a hand-typed second copy is what `tools/repo-checks/src/security-register.test.ts`
 * exists to catch, and a third copy would be a third thing to hold in step.
 */
export function parseRegister(markdown) {
  const entries = [];
  let tier = 0;

  for (const line of markdown.split('\n')) {
    const heading = line.match(/^## Tier (\d)/);
    if (heading) tier = Number(heading[1]);

    const row = line.match(ROW);
    if (!row || tier === 0) continue;

    const cells = row[2].split('|').map((cell) => cell.trim());
    const [className, identifiers, mechanism, test] = cells;
    const all = identifiers.split(',').map((one) => one.trim());

    entries.push({
      id: row[1],
      tier,
      className,
      cwe: all.filter((one) => one.startsWith('CWE-')),
      owasp: all.filter((one) => !one.startsWith('CWE-') && one.length > 0),
      mechanism: sentence(mechanism),
      test: test.split('›')[0].trim().replace(/`/g, ''),
    });
  }

  if (entries.length === 0)
    throw new Error('the register parsed to no entries');

  return entries;
}

/** Every clause of a mechanism cell, so each can be asked what it names. */
function clauses(mechanism) {
  return mechanism
    .split(/[;.]\s+|\.$/)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

/**
 * Whether the whole of an entry's defence is a construction error.
 *
 * Every clause has to name construction, not just one of them: SEC-011 answers
 * an unknown key on the untrusted path and throws on the authored one, and
 * SEC-018 answers an unparseable clock with `unusable-clock` before it refuses
 * a boundary at construction. Both defend a decision as well, so both rank
 * with the decision-time group.
 */
function refusedAtConstruction(entry) {
  const parts = clauses(entry.mechanism);
  const names = (clause) => /construction|throws/i.test(clause);

  return parts.length > 0 && parts.every(names);
}

/**
 * The thirty-six cases in the order the page shows them, by the rule the page
 * prints above them.
 *
 * Every criterion is read off the register's own columns. Tier 3 leads because
 * an entry publishing a non-defence is the least fakeable thing here. Tier 2
 * follows, because those are the mistakes a competent engineer makes. Then
 * tier 1 whose defence acts when a decision is made, which is where a wrong
 * grant would be silent, with the entries carrying an OWASP identifier first
 * and the seeded generator after them. Last, the entries refused at
 * construction, because a construction error is loud.
 */
export function rankEntries(entries, { generated = [] } = {}) {
  const rank = (entry) => {
    if (entry.tier === 3) return 0;
    if (entry.tier === 2) return 1;
    return refusedAtConstruction(entry) ? 3 : 2;
  };

  const within = (entry) => {
    if (rank(entry) !== 2) return 0;
    if (entry.owasp.length > 0) return 0;
    return generated.includes(entry.id) ? 1 : 2;
  };

  return [...entries].sort(
    (left, right) =>
      rank(left) - rank(right) ||
      within(left) - within(right) ||
      left.id.localeCompare(right.id),
  );
}

/**
 * The four groups of the rank, named and in order, with the reason each sits
 * where it does. The page prints this, so a reader can check the selection
 * against the register rather than taking it on trust.
 */
export const RANK_GROUPS = [
  {
    name: 'Out of scope, published as a non-defence',
    why: 'An entry stating that no defence exists is the least fakeable thing here, so it leads.',
  },
  {
    name: 'The primitive exists, the consumer has to use it',
    why: 'The register states the wrong idiom beside the right one, which is the mistake a competent engineer actually makes.',
  },
  {
    name: 'Prevented when a decision is made',
    why: 'A wrong grant with no error is the failure a reviewer never catches by reading. Within the group: the entries carrying an OWASP identifier, then the entry drawing from the seeded generator, then the rest by identifier.',
  },
  {
    name: 'Refused at construction',
    why: 'Last, because a construction error is loud: the first developer to run the code sees a thrown exception, so no silent failure was avoided.',
  },
];

/** The ranked entries, cut into the four groups the page prints. */
export function groupEntries(entries, options) {
  const ranked = rankEntries(entries, options);
  const of = (entry) => {
    if (entry.tier === 3) return 0;
    if (entry.tier === 2) return 1;
    return refusedAtConstruction(entry) ? 3 : 2;
  };

  return RANK_GROUPS.map((group, index) => ({
    ...group,
    ids: ranked.filter((entry) => of(entry) === index).map((entry) => entry.id),
  }));
}

/**
 * The kinds of test that do not live in a matched library's vitest config, so
 * nothing about a library's configuration can derive them.
 *
 * Each says where it runs and whether it carries a count on the page. None of
 * them does: a kind outside `libs/` is outside the section's scope, and the
 * page names it so that a reader looking for "does this project compile its
 * documentation examples" gets an answer whichever project the examples are
 * in.
 *
 * This list is the thing that goes stale, so
 * `tools/repo-checks/src/test-statistics.test.ts` reads it and fails when an entry
 * names a file that is gone.
 */
export const KINDS_OUTSIDE = [
  {
    kind: 'expectation comments',
    file: 'tools/doc-examples/src/expect-comments.ts',
    where:
      'a rewrite inside the doctest pipeline, with no test file of its own',
  },
  {
    kind: 'repository checks',
    file: 'tools/repo-checks/vitest.config.ts',
    where: 'tools/repo-checks, which is not a published library',
  },
  {
    kind: 'build-output assertions',
    file: 'apps/storefront/src/build.test.ts',
    where: 'a demo app, which reads what its own build emitted',
  },
  {
    kind: 'packaging verification',
    file: 'scripts/verify-packaging.mjs',
    where: 'its own CI job, belonging to no Nx project',
  },
];
