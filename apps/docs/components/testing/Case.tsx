import { AvailabilityPill, Text } from '@evanion/baize-ui';
import type { ReactNode } from 'react';

import './testing.css';
import { statistics, TIERS } from './statistics';

export interface CaseProps {
  /** The register identifier, which is the only thing a page writes. */
  id: string;
  /** The `file=… region=…` fence rendering the test that proves the entry. */
  children: ReactNode;
}

/**
 * One register entry, with the test CI ran underneath it.
 *
 * A page writes the identifier and the fence and nothing else. The tier, the
 * class, the CWE, the OWASP cross-reference and the mechanism are read out of
 * `libs/acl/SECURITY.md` by the build, so this page cannot disagree with the
 * register the way a hand-typed copy of it can.
 *
 * `AvailabilityPill` carries the tier. The shop's four stock states against the
 * register's three tiers leave `reprintPending` unused, which is the right
 * outcome: pressing a fourth state into service would invent a degree the
 * register does not have. `ComplexityRamp` is refused for the same reason the
 * kit refuses to colour a game's title by its category -- a ramp is ordinal and
 * tier is nominal, and rendering the entries this library does not defend as
 * the far end of a scale is the most misleading thing available on this page.
 *
 * Open by default where the entry leads its rank group, closed below that. A
 * closed `<details>` is still in the page and still in the search index, which
 * is the constraint the whole section is built around.
 */
export default function Case({ id, children }: CaseProps) {
  const entry =
    statistics.register.cases[id as keyof typeof statistics.register.cases];

  if (!entry) {
    throw new Error(`${id} is not an entry in libs/acl/SECURITY.md`);
  }

  const tier = TIERS[String(entry.tier) as keyof typeof TIERS];
  const group = statistics.register.groups.find((one) => one.ids.includes(id));
  const identifiers = [...entry.cwe, ...entry.owasp].join(', ');

  return (
    <article
      className="docs-case"
      data-identifiers={identifiers}
      data-search={`${entry.className} ${entry.mechanism}`.toLowerCase()}
      data-tier={entry.tier}
      id={id.toLowerCase()}
    >
      <div className="docs-case__head">
        <AvailabilityPill availability={tier.availability} label={tier.label} />
        <h3 className="docs-case__title">
          {id} — {entry.className}
        </h3>
      </div>
      <Text size="sm" tone="moss">
        {identifiers}
      </Text>
      <Text measured>{entry.mechanism}</Text>
      <details open={group?.ids[0] === id}>
        <summary>The test that proves it</summary>
        {children}
        <Text size="sm" tone="moss">
          <code>libs/acl/src/security/{entry.test}</code>, run by{' '}
          <code>npx nx test @evanion/acl</code>.
        </Text>
      </details>
    </article>
  );
}
