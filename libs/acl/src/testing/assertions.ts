import type { Decision, FieldDecision, FieldState, Reason } from '../types.js';

import { AclAssertionError } from './errors.js';

/**
 * One line naming everything a `Decision` carries.
 *
 * `allowed` is a boolean, so a failed `expect(decision.allowed).toBe(true)`
 * reports `true !== false` and names neither the key, the reason, the rule that
 * decided, nor the paths a refusal is waiting on. Those four are what tells a
 * reader whether the test or the document is wrong, and `unevaluable` in
 * particular is repaired by reading `missing`.
 */
export function explainDecision(decision: Decision): string {
  const head = `"${decision.key}" ${decision.allowed ? 'allowed' : 'refused'} with reason "${decision.reason}"`;
  const rule =
    decision.rule === undefined ? '' : `, from rule "${decision.rule}"`;
  const missing =
    decision.missing === undefined || decision.missing.length === 0
      ? ''
      : `, missing ${decision.missing.join(', ')}`;
  return `${head}${rule}${missing}`;
}

/** The caller's label for the decision under test, prefixed onto a message. */
function labelled(context: string | undefined, message: string): string {
  return context === undefined ? message : `${context}: ${message}`;
}

/**
 * Returns the decision when it allows, and throws naming why it did not.
 *
 * The decision is returned so a caller chains on it:
 * `assertAllowed(access.can(...)).rule`.
 */
export function assertAllowed(decision: Decision, context?: string): Decision {
  if (decision.allowed) return decision;
  throw new AclAssertionError(
    labelled(
      context,
      `expected "${decision.key}" to be allowed; ${explainDecision(decision)}`,
    ),
  );
}

/**
 * Returns the decision when it refuses, and throws naming what it answered.
 *
 * Naming `reason` asserts which refusal, and the three that a consumer's UI
 * treats differently are the point: `unevaluable` asks for a refetch of the
 * row, `stale-contract` for a refetch of the document, and `denied` for
 * neither.
 */
export function assertRefused(
  decision: Decision,
  reason?: Reason,
  context?: string,
): Decision {
  const wanted =
    reason === undefined
      ? `expected "${decision.key}" to be refused`
      : `expected "${decision.key}" to be refused with reason "${reason}"`;

  if (
    !decision.allowed &&
    (reason === undefined || decision.reason === reason)
  ) {
    return decision;
  }

  throw new AclAssertionError(
    labelled(context, `${wanted}; ${explainDecision(decision)}`),
  );
}

/**
 * One line naming the action decision a field decision hangs off, and every
 * field beside its state and its reason.
 *
 * `FieldDecision.allowed` is true only when the action is allowed and every
 * field is, so a false one has at least two places to look and the maps are
 * both of them.
 */
export function explainFieldDecision(decision: FieldDecision): string {
  const fields = Object.keys(decision.fields)
    .map(
      (field) =>
        `${field}: ${decision.fields[field]} (${decision.reasons[field]})`,
    )
    .join(', ');
  const body = fields === '' ? 'no fields' : fields;
  return `${explainDecision(decision.action)}; ${body}`;
}

/**
 * Returns the field decision when the named field is in `state`, and throws
 * naming the whole decision when it is not.
 *
 * A field the decision carries no entry for is a separate failure: the maps are
 * keyed by the names the document declares, so an absent name is a test naming
 * a field the permission never had.
 */
export function assertFieldState(
  decision: FieldDecision,
  field: string,
  state: FieldState,
  context?: string,
): FieldDecision {
  const actual = decision.fields[field];

  if (actual === undefined) {
    const known = Object.keys(decision.fields);
    const carries =
      known.length === 0
        ? 'it carries no fields'
        : `it carries ${known.join(', ')}`;
    throw new AclAssertionError(
      labelled(
        context,
        `"${decision.action.key}" has no field "${field}": ${carries}`,
      ),
    );
  }

  if (actual === state) return decision;

  throw new AclAssertionError(
    labelled(
      context,
      `expected field "${field}" of "${decision.action.key}" to be "${state}", and it is "${actual}" (${decision.reasons[field]}); ${explainFieldDecision(decision)}`,
    ),
  );
}
