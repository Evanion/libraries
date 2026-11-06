import { describe, expect, it } from 'vitest';

import { AclConfigError, ActionNotAllowedError } from './errors.js';
import { pickAllowedFields } from './fields.js';
import { parseMatrix } from './parse-matrix.js';
import { Gen, rng } from './security/generator.js';
import {
  ACTIONS,
  context,
  junk,
  KEYS,
  matrix,
} from './security/matrix-generator.js';
import type { Access } from './hydrate-policy.js';
import type { Decision, FieldDecision, Matrix } from './types.js';

/**
 * The standing guarantee, as a property: for any matrix and any context,
 * `parseMatrix` either rejects the matrix with an `AclConfigError` or returns an
 * access object whose every entry point answers with a decision. Nothing else.
 *
 * The matrices are generated to be wrong: every position holds a value of the
 * wrong type some of the time, plus nulls, prototype keys, deep nesting and
 * cycles. A seeded generator, so a counterexample is a seed rather than a rerun.
 */

function isNode(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDecision(value: unknown): value is Decision {
  if (typeof value !== 'object' || value === null) return false;
  const decision = value as Decision;
  return (
    typeof decision.key === 'string' &&
    typeof decision.allowed === 'boolean' &&
    typeof decision.reason === 'string'
  );
}

function isFieldDecision(value: unknown): value is FieldDecision {
  if (typeof value !== 'object' || value === null) return false;
  const decision = value as FieldDecision;
  return (
    typeof decision.allowed === 'boolean' &&
    isDecision(decision.action) &&
    typeof decision.fields === 'object' &&
    typeof decision.reasons === 'object'
  );
}

/** Every entry point, against one generated context. Returns what each answered. */
function exercise(access: Access, gen: Gen): void {
  const { subject, object, now } = context(gen);
  const key = gen.pick(KEYS);
  const action = gen.pick(ACTIONS);
  const clock = now as never;

  expect(isDecision(access.can(subject, key, action, object, clock))).toBe(
    true,
  );
  for (const decision of access.canMany(
    subject,
    key,
    action,
    [object, {}],
    clock,
  )) {
    expect(isDecision(decision)).toBe(true);
  }
  const proposed = junk(gen) as Record<string, unknown>;
  const fieldDecision = access.canFields(
    subject,
    key,
    action,
    object,
    gen.pick(['read', 'write'] as const),
    gen.bool() ? proposed : undefined,
    clock,
  );
  expect(isFieldDecision(fieldDecision)).toBe(true);

  // The write path narrows a proposal against that decision. Its one throw is
  // ActionNotAllowedError, which reports the decision rather than a shape.
  try {
    const writable = pickAllowedFields(
      fieldDecision,
      isNode(proposed) ? proposed : {},
    );
    expect(typeof writable).toBe('object');
    for (const field of Object.keys(writable)) {
      expect(fieldDecision.fields[field]).toBe('allowed');
    }
  } catch (error) {
    expect(error).toBeInstanceOf(ActionNotAllowedError);
  }

  for (const decision of Object.values(access.capabilities(subject, clock))) {
    expect(isDecision(decision)).toBe(true);
  }

  const bound = access.authorize(subject, { now: clock });
  expect(isDecision(bound.can(key, action, object))).toBe(true);
  expect(
    isDecision(
      bound.canMany(key, action, [object])[0] ?? bound.can(key, action),
    ),
  ).toBe(true);
  expect(Object.keys(bound.capabilities()).length).toBeGreaterThanOrEqual(0);
}

describe('totality', () => {
  it('construction rejects with an AclConfigError, or evaluation decides', () => {
    let built = 0;
    let rejected = 0;

    for (let seed = 1; seed <= 2000; seed++) {
      const gen = new Gen(rng(seed));
      const candidate = matrix(gen);

      let access: Access;
      try {
        access = parseMatrix(candidate);
      } catch (error) {
        // The only acceptable refusal: a typed construction error.
        expect(error, `seed ${seed}: ${String(error)}`).toBeInstanceOf(
          AclConfigError,
        );
        rejected++;
        continue;
      }

      built++;
      for (let round = 0; round < 3; round++) {
        try {
          exercise(access, gen);
        } catch (error) {
          throw new Error(`seed ${seed} round ${round}: ${String(error)}`, {
            cause: error,
          });
        }
      }
    }

    // Both halves of the property are reached, so neither is vacuous.
    expect(built).toBeGreaterThan(50);
    expect(rejected).toBeGreaterThan(50);
  });

  it('an accepted matrix never decides on a key it was not written for', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const gen = new Gen(rng(seed));
      let access: Access;
      try {
        access = parseMatrix(matrix(gen));
      } catch {
        continue;
      }
      for (const permission of access.matrix.permissions) {
        expect(permission.key).toBe(
          `${permission.object}.${permission.action}`,
        );
      }
    }
  });

  it('a matrix round-tripped through JSON decides identically', () => {
    let crossed = 0;

    for (let seed = 1; seed <= 1000; seed++) {
      const gen = new Gen(rng(seed));
      let access: Access;
      try {
        access = parseMatrix(matrix(gen));
      } catch {
        continue;
      }

      const payload = JSON.parse(JSON.stringify(access.matrix)) as Matrix;
      // The document is what crosses: version and schema included, nothing
      // assembled around it.
      expect(payload).toEqual(access.matrix);
      const hydrated = parseMatrix(payload);
      expect(hydrated.version).toEqual(access.version);
      expect(hydrated.schema).toEqual(access.schema);
      crossed++;

      for (let round = 0; round < 3; round++) {
        const { subject, object, now } = context(gen);
        const key = gen.pick(KEYS);
        const action = gen.pick(ACTIONS);
        const clock = now as never;
        expect(hydrated.can(subject, key, action, object, clock)).toEqual(
          access.can(subject, key, action, object, clock),
        );
        expect(hydrated.capabilities(subject, clock)).toEqual(
          access.capabilities(subject, clock),
        );
      }
    }

    expect(crossed).toBeGreaterThan(50);
  });
});
