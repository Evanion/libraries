/**
 * The construction surface the adversarial suite builds its attacks on.
 *
 * Every matrix in the suite is assembled here and nowhere else, so the shape a
 * matrix takes is one function rather than a literal repeated in every test. A
 * test states the attack; this module states the format.
 */

import { readFileSync } from 'node:fs';

import {
  hydratePolicy,
  type Access,
  type AccessOptions,
} from '../hydrate-policy.js';
import { parseMatrix } from '../parse-matrix.js';
import type { Condition, Matrix, Permission, Rule } from '../types.js';

// #region helpers
/** A permission body, minus the three fields the key is built from. */
export type PermissionBody = Omit<Permission, 'key' | 'object' | 'action'>;

/**
 * One permission, keyed from its object and action.
 *
 * The key is derived rather than written, so a test that means to attack the
 * key/object/action agreement has to say so with `raw`.
 */
export function permission(
  object: string,
  action: string,
  body: PermissionBody = {},
): Permission {
  return { key: `${object}.${action}`, object, action, ...body };
}

/**
 * A permission whose shape is exactly what the attack needs, valid or not. The
 * one way malformed configuration enters the suite.
 */
export function raw(node: Record<string, unknown>): Permission {
  return node as unknown as Permission;
}

/** The envelope members a document carries around its permissions. */
export type Envelope = Omit<Matrix, 'permissions'>;

/** The document the entry points take. */
export function matrix(
  permissions: readonly Permission[],
  envelope: Envelope = {},
): Matrix {
  return { ...envelope, permissions };
}

/**
 * A document whose envelope is exactly what the attack needs, valid or not.
 * The one way a malformed envelope enters the suite.
 */
export function rawMatrix(node: Record<string, unknown>): Matrix {
  return node as unknown as Matrix;
}

/**
 * An access object over a matrix somebody else wrote: the `parseMatrix` path,
 * which answers a refusal for a permission key the matrix does not declare.
 */
export function foreign(
  permissions: readonly Permission[],
  options?: AccessOptions,
  envelope?: Envelope,
): Access {
  return parseMatrix(matrix(permissions, envelope), options);
}

/**
 * An access object over a matrix your own code wrote: the `hydratePolicy` path,
 * which throws on a permission key the matrix does not declare.
 */
export function local(
  permissions: readonly Permission[],
  options?: AccessOptions,
  envelope?: Envelope,
): Access {
  return hydratePolicy(matrix(permissions, envelope), options);
}

/** The unconditional rule: an empty `when`, the rule `p.always` writes. */
export const always: Rule = { when: [] };

/** A rule over an AND-ed set of conditions. */
export function when(...conditions: readonly Condition[]): Rule {
  return { when: conditions };
}
// #endregion helpers

/**
 * A subject bag that counts how many times the engine reads each attribute.
 *
 * A read count is an operation count the engine cannot hide, so a cost claim is
 * an equality over it rather than a stopwatch.
 */
export function countingSubject(attributes: Record<string, unknown>): {
  subject: Record<string, unknown>;
  reads: () => number;
  reset: () => void;
} {
  let count = 0;
  const subject: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(attributes)) {
    Object.defineProperty(subject, name, {
      enumerable: true,
      configurable: true,
      get() {
        count++;
        return value;
      },
    });
  }
  return {
    subject,
    reads: () => count,
    reset: () => {
      count = 0;
    },
  };
}

/**
 * A JSON payload's own keys, including the ones an object literal cannot carry.
 * `JSON.parse` is how a foreign write arrives carrying an own `__proto__` key.
 */
export function fromJson(text: string): Record<string, unknown> {
  return JSON.parse(text) as Record<string, unknown>;
}

const documents = new Map<string, string>();

/**
 * A markdown file at a package's root, read once.
 *
 * The tier 3 entries have no mechanism to assert, so they assert the contract
 * text instead: the section has to exist for the register entry to be honest.
 * The acl contract sits in `SECURITY.md` beside the register, and each README
 * summarises it and links there.
 */
export function packageDocument(
  pkg: 'acl' | 'react-acl',
  file: 'README.md' | 'SECURITY.md',
): string {
  const key = `${pkg}/${file}`;
  const cached = documents.get(key);
  if (cached !== undefined) return cached;
  const path = new URL(`../../../${key}`, import.meta.url);
  const text = readFileSync(path, 'utf8');
  documents.set(key, text);
  return text;
}
