/**
 * `@evanion/acl/testing` -- test helpers for a consumer of a published policy
 * contract.
 *
 * A vitest file calling `can` needs none of this, and `hydratePolicy` over a
 * 200-permission document takes single-digit milliseconds, so nothing here
 * builds a faster way to construct a policy. There is no shorter syntax for
 * authoring one either: a helper that built a test document would be a second
 * authoring surface, and its documents would differ from production documents
 * in ways nobody reviews.
 *
 * What is here is the three things a consumer cannot write clearly on its own.
 *
 * `contractDrift` and `assertNoContractDrift` replay a consumer's own questions
 * against the producer's document at two versions, and report a removed key
 * apart from a changed decision. `fixtureClock` names the two instants that
 * bracket a document's freshness budget, so a test reaches `stale-contract` on
 * purpose. `assertAllowed`, `assertRefused` and `assertFieldState` throw
 * messages that name the reason, the rule and the missing paths.
 *
 * This is a secondary entry point. `@evanion/acl` does not re-export it, so an
 * application importing the engine pulls none of it into its bundle. Nothing
 * here imports a test framework: every helper returns a value or throws a plain
 * `Error`, which vitest, node:test and jest each report the same way.
 */

export {
  assertAllowed,
  assertFieldState,
  assertRefused,
  explainDecision,
  explainFieldDecision,
} from './assertions.js';

export { fixtureClock } from './clock.js';
export type { FixtureClock, FixtureClockOptions } from './clock.js';

export {
  assertNoContractDrift,
  contractDrift,
  describeContractDrift,
  ContractDriftError,
} from './drift.js';
export type {
  ContractDriftOptions,
  ContractDriftReport,
  DecisionCase,
  DecisionChange,
  MatrixDiff,
} from './drift.js';

export { AclAssertionError } from './errors.js';
