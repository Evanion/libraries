/**
 * A cross-cutting deny authored by a team that does not own the permission.
 *
 * A compliance or fraud service publishes deny rules; the owning service fetches
 * them and applies them in its own process, before it constructs its policy.
 * Nothing merges at an edge, nothing but the owner is authoritative, and the
 * service that enforces the veto is the service that applies it.
 *
 *     authored matrix -> applyDenyOverlay -> createPolicy -> access
 */

import {
  MissingVetoSchemaError,
  UnvetoablePermissionError,
  UnknownPermissionError,
} from './errors.js';
import { assertRulesFit } from './schema.js';
import { assertRules } from './validate.js';
import type { Matrix, MatrixSchema, Permission, Rule } from './types.js';

/**
 * Deny rules contributed per permission key.
 *
 * A contribution is a `readonly Rule[]`, and that is the whole soundness
 * argument. `Rule` is `{ id?, when? }`: `fields` lives on
 * `Permission`, and an allow rule is a member of a different array. So a
 * contribution cannot express an allow, a dependency or a field rule. There is
 * no prohibition to enforce because the shape states none of them.
 */
export type DenyOverlay = Readonly<Record<string, readonly Rule[]>>;

/** What the target opens to an overlay. */
export interface DenyOverlayOptions {
  /**
   * The permission keys another team may append a deny to.
   *
   * The target's whole statement of its extension points. Listing a key is what
   * obliges the matrix to declare that key's object kind in `schema.objects`.
   */
  readonly vetoable: readonly string[];
}

function permissionIndex(matrix: Matrix): ReadonlyMap<string, Permission> {
  const index = new Map<string, Permission>();
  for (const permission of matrix.permissions) {
    index.set(permission.key, permission);
  }
  return index;
}

/**
 * Appends each overlay key's deny rules to that permission and returns a new
 * matrix. Pure `Matrix -> Matrix`, so it composes by ordinary function
 * composition and the input is left untouched.
 *
 * It can only subtract. `sideOutcome` in `evaluate.ts` is monotone in its rule
 * array — appending deny rules moves the deny side along `fails ->
 * unevaluable -> unusable-clock -> matched` and never back — and `decideResolved`
 * reaches `allowed: true` only where the deny side is `fails`. So a decision the
 * overlaid matrix allows was allowed by the authored one, for every subject,
 * object and instant.
 *
 * Three refusals, all at apply time, each naming the key:
 *
 * - a key the target does not define (`UnknownPermissionError`);
 * - a key the target does not list as vetoable (`UnvetoablePermissionError`);
 * - a condition that does not fit the target's schema for that key's object kind
 *   (`UnknownFieldError`, `FieldTypeMismatchError`).
 *
 * The same structural gate every matrix passes runs over the contribution too,
 * so a malformed rule is an `InvalidRuleError` here rather than at the owner's
 * next deploy.
 *
 * The obligation behind the third refusal is scoped: the target declares a
 * schema for the object kinds of its vetoable keys and owes nothing for the
 * rest, so a service that opens no extension point owes no schema at all.
 *
 * The intended second caller is the authoring party. A compliance team runs this
 * against the owner's published contract in its own CI and finds its own mistake
 * before the owner's deploy does. Nothing here reads private state or needs the
 * full authored matrix: a published subset carrying the vetoable keys and their
 * schema entries is enough.
 *
 * `version` is carried through unchanged. A veto changes what the document
 * decides, so the party that publishes the result composes the version that says
 * so; this function knows no name for the overlay and invents none.
 */
export function applyDenyOverlay(
  matrix: Matrix,
  overlay: DenyOverlay,
  options: DenyOverlayOptions,
): Matrix {
  const index = permissionIndex(matrix);
  const vetoable = new Set(options.vetoable);

  // The obligation attaches to opening the extension point, not to a
  // contribution arriving at it: a vetoable key whose kind is undeclared would
  // accept an unchecked overlay on the day one is written. Holding the schema
  // this loop proved is also what lets the fit check below take it non-optional.
  let schema: MatrixSchema | undefined;
  for (const key of vetoable) {
    const permission = index.get(key);
    if (permission === undefined) throw new UnknownPermissionError(key);
    const objects = matrix.schema?.objects;
    if (!objects || !Object.hasOwn(objects, permission.object)) {
      throw new MissingVetoSchemaError(key, permission.object);
    }
    schema = matrix.schema;
  }

  const contributions = new Map<string, readonly Rule[]>();
  for (const [key, rules] of Object.entries(overlay)) {
    const permission = index.get(key);
    if (permission === undefined) throw new UnknownPermissionError(key);
    // An unlisted key is refused here, so `schema` is defined by the time any
    // contribution is checked: reaching this line at all means `vetoable` had an
    // entry, and every entry proved the schema above.
    if (!vetoable.has(key) || schema === undefined) {
      throw new UnvetoablePermissionError(key);
    }
    assertRules(key, 'overlay', rules);
    assertRulesFit(schema, permission, 'overlay', rules);
    contributions.set(key, rules);
  }

  return {
    ...matrix,
    permissions: matrix.permissions.map((permission) => {
      const added = contributions.get(permission.key);
      if (added === undefined || added.length === 0) return permission;
      return {
        ...permission,
        denyRules: [...(permission.denyRules ?? []), ...added],
      };
    }),
  };
}
