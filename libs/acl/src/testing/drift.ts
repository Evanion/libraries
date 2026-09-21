import type { Subject } from '../hydrate-policy.js';
import { parseMatrix } from '../parse-matrix.js';
import type { Decision, Instant, Matrix } from '../types.js';

import { AclAssertionError } from './errors.js';
import { explainDecision } from './assertions.js';

/**
 * One question a consumer's UI asks, stated so it can be replayed against two
 * versions of the same contract.
 *
 * The three positional arguments of `can` in a bag, plus a name for the report.
 * `key` is the object kind and `action` the action, the way `can` takes them;
 * the permission key the document carries is `${key}.${action}`.
 */
export interface DecisionCase {
  /** What the report calls this case. Defaults to `${key}.${action}`. */
  readonly name?: string;
  readonly subject: Subject;
  readonly key: string;
  readonly action: string;
  readonly object?: Record<string, unknown>;
  /** Overrides the instant `contractDrift` settled for the whole run. */
  readonly now?: Instant;
}

/** A case the two versions answer differently. */
export interface DecisionChange {
  readonly name: string;
  readonly case: DecisionCase;
  readonly pinned: Decision;
  readonly fetched: Decision;
}

/**
 * The seam `diffMatrix` drops into.
 *
 * `contractDrift` decides nothing from the result and only carries it onto the
 * report, so the diff's own shape stays the diff's business and lands here as
 * `D`. A caller that passes `diffMatrix` gets `report.diff` typed as whatever
 * `diffMatrix` returns; a caller that passes nothing gets `undefined`.
 */
export type MatrixDiffer<D> = (pinned: Matrix, fetched: Matrix) => D;

export interface ContractDriftOptions<D = never> {
  /** The contract this consumer pinned, as fetched at the version it compiled against. */
  readonly pinned: Matrix;
  /** The contract the producer publishes now, fetched in CI. */
  readonly fetched: Matrix;
  /** The decisions this application renders. Replayed against both documents. */
  readonly cases?: readonly DecisionCase[];
  /**
   * The instant every case without its own `now` is decided at. Settled once,
   * so two versions of a time-windowed permission are compared at one epoch
   * rather than at two readings of the wall clock.
   */
  readonly now?: Instant;
  /** The full document diff, when one is available. */
  readonly diff?: MatrixDiffer<D>;
}

export interface ContractDriftReport<D = never> {
  readonly pinnedVersion: string | number | undefined;
  readonly fetchedVersion: string | number | undefined;
  /**
   * Permission keys the pinned contract carries and the fetched one does not.
   *
   * A producer removing a published key breaks the contract, and it is the
   * finding that is never deliberate on the consumer's side.
   */
  readonly removed: readonly string[];
  /** Permission keys the fetched contract added. Not a break. */
  readonly added: readonly string[];
  /** The replayed cases whose decision is not deep-equal across the two. */
  readonly changed: readonly DecisionChange[];
  /** Whatever `options.diff` returned, and `undefined` when none was passed. */
  readonly diff: D | undefined;
}

function keysOf(matrix: Matrix): Set<string> {
  return new Set(matrix.permissions.map((permission) => permission.key));
}

/**
 * Whether two decisions state the same thing.
 *
 * Every member of `Decision` is compared, `missing` element by element: a
 * refusal that started naming a second unreadable path is a change a consumer's
 * refetch loop has to hear about, and `reason` alone does not carry it.
 */
function sameDecision(a: Decision, b: Decision): boolean {
  if (a.key !== b.key || a.allowed !== b.allowed || a.reason !== b.reason) {
    return false;
  }
  if (a.rule !== b.rule) return false;
  const left = a.missing ?? [];
  const right = b.missing ?? [];
  return (
    left.length === right.length && left.every((path, i) => path === right[i])
  );
}

/**
 * What changed between the contract a consumer pinned and the one its producer
 * publishes now.
 *
 * The assertion runs in the direction the published-contract design requires:
 * the consumer holds the producer's document and replays its own questions
 * against it. A fixture matrix written by the consumer to stand in for the
 * contract would be a second copy of somebody else's rules, which is the
 * failure the contract exists to remove, and a test file is no better a place
 * for that copy than production code is.
 *
 * Two findings, kept apart because the consumer's move differs. A key the
 * producer removed breaks a published contract and the producer has to hear
 * about it. A decision that changed may be exactly what the producer intended,
 * and the consumer decides whether its UI still reads correctly.
 *
 * Both documents are adopted with `parseMatrix`, which fails closed, so a
 * removed key answers `unknown-action` and is reported beside the others rather
 * than throwing partway through the run. Neither adoption reports a
 * `fetchedAt`, so no freshness budget applies and no case answers
 * `stale-contract` for a reason that has nothing to do with the two versions.
 */
export function contractDrift<D = never>(
  options: ContractDriftOptions<D>,
): ContractDriftReport<D> {
  const { pinned, fetched, cases = [], now, diff } = options;

  const before = keysOf(pinned);
  const after = keysOf(fetched);

  const removed = [...before].filter((key) => !after.has(key));
  const added = [...after].filter((key) => !before.has(key));

  const pinnedAccess = parseMatrix(pinned);
  const fetchedAccess = parseMatrix(fetched);
  const settled = now ?? Date.now();

  const changed: DecisionChange[] = [];
  for (const one of cases) {
    const instant = one.now ?? settled;
    const a = pinnedAccess.can(
      one.subject,
      one.key,
      one.action,
      one.object,
      instant,
    );
    const b = fetchedAccess.can(
      one.subject,
      one.key,
      one.action,
      one.object,
      instant,
    );
    if (!sameDecision(a, b)) {
      changed.push({
        name: one.name ?? `${one.key}.${one.action}`,
        case: one,
        pinned: a,
        fetched: b,
      });
    }
  }

  return {
    pinnedVersion: pinned.version,
    fetchedVersion: fetched.version,
    removed,
    added,
    changed,
    diff: diff === undefined ? undefined : diff(pinned, fetched),
  };
}

/**
 * The report as a reader sees it, removals first.
 *
 * A removal is stated as a broken contract and a changed decision is stated as
 * a change, because a report that spelled them the same way would leave the
 * consumer to work out which of the two it is looking at.
 */
export function describeContractDrift(
  report: ContractDriftReport<unknown>,
): string {
  const versions = `${String(report.pinnedVersion)} -> ${String(report.fetchedVersion)}`;
  const lines = [`contract drift, ${versions}`];

  if (report.removed.length > 0) {
    lines.push(
      `  ${report.removed.length} published key(s) removed, which breaks the contract:`,
    );
    for (const key of report.removed) lines.push(`    - ${key}`);
  }

  if (report.changed.length > 0) {
    lines.push(`  ${report.changed.length} decision(s) changed:`);
    for (const change of report.changed) {
      lines.push(`    ${change.name}`);
      lines.push(`      pinned:  ${explainDecision(change.pinned)}`);
      lines.push(`      fetched: ${explainDecision(change.fetched)}`);
    }
  }

  if (report.added.length > 0) {
    lines.push(
      `  ${report.added.length} key(s) added: ${report.added.join(', ')}`,
    );
  }

  if (report.removed.length === 0 && report.changed.length === 0) {
    lines.push('  no key removed and no decision changed');
  }

  return lines.join('\n');
}

/** A removed key or a changed decision, raised with the whole report attached. */
export class ContractDriftError extends AclAssertionError {
  readonly report: ContractDriftReport<unknown>;
  constructor(report: ContractDriftReport<unknown>) {
    super(describeContractDrift(report));
    this.name = 'ContractDriftError';
    this.report = report;
  }
}

/**
 * Throws when the producer removed a published key or a replayed decision
 * changed, and returns the report otherwise.
 *
 * An added key passes. A consumer pinned to a contract version gets a red build
 * when the producer publishes a change its own questions can see, and a green
 * one when the producer only widened the surface.
 */
export function assertNoContractDrift<D = never>(
  options: ContractDriftOptions<D>,
): ContractDriftReport<D> {
  const report = contractDrift(options);
  if (report.removed.length > 0 || report.changed.length > 0) {
    throw new ContractDriftError(report);
  }
  return report;
}
