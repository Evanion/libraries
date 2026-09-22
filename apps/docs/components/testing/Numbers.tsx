import { Figure, Stat, StatLine, Text } from '@evanion/baize-ui';

import './testing.css';
import { command, count, percent, statistics } from './statistics';

/**
 * Every count the `/testing` section shows, rendered from the file the build
 * wrote.
 *
 * Server components with no props to speak of. A figure a page could pass in
 * is a figure somebody typed, and the whole argument of the section is that
 * nothing on it was typed.
 */

/** What the run was, so a reader can check the site moves with the code. */
export function Provenance() {
  return (
    <Text size="sm" tone="moss">
      Measured at <code>{statistics.commit}</code> ({statistics.commitDate}) on
      Node {statistics.node}, by the build that produced this page.
    </Text>
  );
}

/** The documented examples that ran, and the fences that compiled. */
export function DocExamples() {
  return (
    <StatLine label="the executed documentation" size="lg">
      <Stat
        figure={count(statistics.docExamples.cases)}
        label="documented examples run as tests"
      />
      <Stat
        figure={count(statistics.docExamples.fromReadme)}
        label="of them from a package README"
      />
      <Stat
        figure={count(statistics.content.twoslash)}
        label="twoslash fences compiled against dist/"
      />
      <Stat
        figure={count(statistics.content.regions)}
        label={`region references across ${count(statistics.content.pages)} pages`}
      />
    </StatLine>
  );
}

/** The register, broken down by tier wherever it is counted. */
export function RegisterCounts() {
  const tier = (which: number) =>
    statistics.register.tiers.find((one) => one.tier === which)?.entries ?? 0;

  return (
    <StatLine label="the security register" size="lg">
      <Stat
        figure={count(statistics.register.entries)}
        label="classes of attack"
      />
      <Stat figure={count(tier(1))} label="prevented" />
      <Stat figure={count(tier(2))} label="primitive supplied" />
      <Stat figure={count(tier(3))} label="out of scope" />
      <Stat
        figure={count(statistics.register.adversarial)}
        label="cases in libs/acl/src/security"
      />
    </StatLine>
  );
}

/** What the OWASP and CWE columns are, stated as arithmetic. */
export function CrossReferences() {
  const { entries, owasp, owaspIdentifiers, cwes } = statistics.register;

  return (
    <Text>
      {owasp} of the {entries} entries carry an OWASP identifier and the other{' '}
      {entries - owasp} carry a CWE alone, over {cwes} distinct CWEs and{' '}
      {owaspIdentifiers.length} OWASP entries ({owaspIdentifiers.join(', ')}).
      The identifier is a property of one entry. This page counts entries and
      never categories.
    </Text>
  );
}

/**
 * The rule the thirty-six cases are ordered by, printed above them.
 *
 * Printed because a reader who cannot see the rule assumes the order was
 * arranged, and every criterion in it is read off the register's own columns.
 * The one editorial part is named: somebody decided SEC-001 carries API3:2023.
 */
export function RankRule() {
  return (
    <ol>
      {statistics.register.groups.map((group) => (
        <li key={group.name}>
          <strong>{group.name}</strong> — {group.why} {group.ids.length}{' '}
          entries: {group.ids.join(', ')}.
        </li>
      ))}
    </ol>
  );
}

/** The suite, one row per library, each with the command that reproduces it. */
export function SuiteTable() {
  return (
    <div className="docs-testing-scroll">
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th className="docs-testing-number">Test cases</th>
            <th className="docs-testing-number">Test files</th>
            <th>Kinds</th>
            <th>Reproduce</th>
          </tr>
        </thead>
        <tbody>
          {statistics.libraries.map((library) => (
            <tr key={library.name}>
              <td>
                <code>{library.name}</code>
              </td>
              <td className="docs-testing-number">
                <Figure size="base">{count(library.cases)}</Figure>
              </td>
              <td className="docs-testing-number">
                <Figure size="base">{count(library.files)}</Figure>
              </td>
              <td>{library.kinds.join(', ')}</td>
              <td>
                <code>{command(library)}</code>
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <strong>On this page</strong>
            </td>
            <td className="docs-testing-number">
              <Figure size="base">{count(statistics.totals.cases)}</Figure>
            </td>
            <td className="docs-testing-number">
              <Figure size="base">{count(statistics.totals.files)}</Figure>
            </td>
            <td colSpan={2}>
              {count(statistics.totals.libraries)} libraries under{' '}
              <code>libs/</code>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Coverage per package, never summed. */
export function CoverageTable() {
  return (
    <div className="docs-testing-scroll">
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th className="docs-testing-number">Statements</th>
            <th className="docs-testing-number">Branches</th>
            <th className="docs-testing-number">Functions</th>
            <th className="docs-testing-number">Lines</th>
            <th className="docs-testing-number">Files in the report</th>
          </tr>
        </thead>
        <tbody>
          {[...statistics.libraries]
            .sort(
              (left, right) =>
                right.coverage.branches.pct - left.coverage.branches.pct,
            )
            .map((library) => (
              <tr key={library.name}>
                <td>
                  <code>{library.name}</code>
                </td>
                {(
                  ['statements', 'branches', 'functions', 'lines'] as const
                ).map((metric) => (
                  <td className="docs-testing-number" key={metric}>
                    <Figure size="base">
                      {percent(library.coverage[metric].pct)}
                    </Figure>{' '}
                    <Text as="span" size="xs" tone="moss">
                      {count(library.coverage[metric].covered)}/
                      {count(library.coverage[metric].total)}
                    </Text>
                  </td>
                ))}
                <td className="docs-testing-number">
                  <Figure size="base">{count(library.coverage.files)}</Figure>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/** Where each package's branch coverage falls short, named file by file. */
export function CoverageShortfall() {
  return (
    <div className="docs-testing-shortfall">
      {statistics.libraries
        .filter((library) => library.shortfall.length > 0)
        .map((library) => (
          <details key={library.name}>
            <summary>
              <code>{library.name}</code> — {library.shortfall.length} files
              under 100% of branches
            </summary>
            <ul>
              {library.shortfall.map((entry) => (
                <li key={entry.file}>
                  <code>{entry.file}</code>: {percent(entry.branches)} of{' '}
                  {count(entry.total)} branches
                </li>
              ))}
            </ul>
            <Text size="sm" tone="moss">
              Reproduce with <code>{command(library)} --coverage</code>.
            </Text>
          </details>
        ))}
    </div>
  );
}

/** The kinds of test that run somewhere no library's config can name. */
export function KindsOutside() {
  return (
    <ul>
      {statistics.kindsOutside.map((kind) => (
        <li key={kind.kind}>
          <strong>{kind.kind}</strong> — {kind.where}, in{' '}
          <code>{kind.file}</code>. No count on this page.
        </li>
      ))}
    </ul>
  );
}

/** The guards, with the backlog they record against themselves. */
export function Guards() {
  return (
    <StatLine label="the repository guards" size="lg">
      <Stat
        figure={count(statistics.guards.files)}
        label="checks over this repository"
      />
      <Stat
        figure={count(statistics.guards.undocumented)}
        label={`exports documented nowhere, across ${count(statistics.guards.packages)} packages`}
      />
      <Stat
        figure={count(statistics.guards.unexercised)}
        label="exports with no example exercising them"
      />
      <Stat
        figure={count(statistics.guards.fences)}
        label="fences that are not region references"
      />
    </StatLine>
  );
}
