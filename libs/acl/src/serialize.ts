/**
 * The document a service hands its consumers, so the rules have one author.
 *
 * A consumer that cannot ask the owner writes the owner's rules itself, and that
 * copy diverges on the first change nobody propagates. Serializing the owner's
 * own document removes the second definition and leaves the second evaluation
 * standing: every layer still decides for itself, on a document one team owns.
 *
 *     authored matrix -> applyDenyOverlay -> hydratePolicy -> serialize(reduced)
 */

import { UnknownPermissionError, UnpublishedVetoableError } from './errors.js';
import type { Access } from './hydrate-policy.js';
import type { Matrix, MatrixSchema, ObjectKey, Permission } from './types.js';

/** Which of the two documents an `Access` holds is wanted. */
export type SerializeMode = 'full' | 'reduced';

/**
 * What a reduced serialization needs beyond the document itself.
 *
 * `Keys` is the permission-key union the `Access` being serialized carries, so
 * a document authored with the builder checks its own list and an adopted one,
 * whose keys are `string`, takes any key it likes.
 */
export interface SerializeOptions<Keys extends string = string> {
  /**
   * The keys this target opens to a deny overlay, as `applyDenyOverlay` took
   * them.
   *
   * An `Access` carries no such list: `vetoable` is an argument to
   * `applyDenyOverlay` and the matrix it returns records nothing about which
   * keys were opened. The publishing path holds the list already, having just
   * passed it to the overlay.
   *
   * The keys are checked against the document being published, because this
   * call holds the `Access` and the `Access` carries the union. A misspelt key
   * is an `UnknownPermissionError` at runtime, and where the union is known the
   * compiler reaches it first.
   *
   * `applyDenyOverlay` takes the same list and cannot check it. It takes a
   * `Matrix`, which is the serializable document and carries no union, and the
   * party writing an overlay is another team holding that document as JSON with
   * none of the producer's types. A check there would have nothing to stand on.
   */
  readonly vetoable?: readonly Keys[];
}

/** Whether this permission ships in a contract. Absent is `internal`. */
function isPublic(permission: Permission): boolean {
  return permission.visibility === 'public';
}

/** One published permission, with the marking dropped from the copy. */
function published(permission: Permission): Permission {
  const copy = { ...permission };
  delete copy.visibility;
  return copy;
}

/**
 * The declared shapes a contract carries: the kinds its published permissions
 * name, whole, and no others.
 *
 * Keeping a surviving kind's entry whole is the conservative choice. A kept
 * permission's rules may read any path on its object, and an entry pruned to the
 * fields those rules mention breaks the first time a consumer validates an
 * instance against it before calling `canFields`.
 *
 * `subject` ships whole for a stronger reason: it describes the consumer's own
 * actor, every published permission's `subject.*` conditions are checked against
 * it, and pruning it fails `assertRulesFit` at the consumer for rules that did
 * ship.
 */
function projectSchema(
  schema: MatrixSchema,
  kinds: ReadonlySet<ObjectKey>,
): MatrixSchema | undefined {
  const { subject, objects } = schema;
  const kept =
    objects === undefined
      ? []
      : Object.entries(objects).filter(([kind]) => kinds.has(kind));

  // An empty member is omitted rather than emitted, so the contract is
  // byte-identical to the document a foreign producer emits for the same rules.
  const projected: MatrixSchema = {
    ...(subject === undefined ? {} : { subject }),
    ...(kept.length === 0 ? {} : { objects: Object.fromEntries(kept) }),
  };
  return Object.keys(projected).length === 0 ? undefined : projected;
}

export function serialize<Sub, R, Keys extends string = string>(
  access: Access<Sub, R, Keys>,
  mode: 'full',
): Matrix;
export function serialize<Sub, R, Keys extends string = string>(
  access: Access<Sub, R, Keys>,
  mode: 'reduced',
  options?: SerializeOptions<Keys>,
): Matrix;

/**
 * The document an `Access` holds, in full or reduced to its public permissions.
 *
 * `full` hands back `access.matrix` as it stands, marking included, so a `full`
 * round trip through `parseMatrix` comes back the same document. Stripping the
 * marking there would return every permission unmarked, which reads as
 * `internal`, so a round trip would silently un-publish the whole matrix.
 *
 * `reduced` is the contract. It keeps a permission whose `visibility` is
 * `public`, drops the marking from the copy, and keeps everything else on that
 * permission byte for byte. Editing a kept permission is what this refuses to
 * do: `sideOutcome` in `evaluate.ts` is monotone in its rule array, so dropping
 * a deny rule turns a refusal into an allow, and dropping an allow rule or a
 * field config changes the answer in the other direction. Either way the
 * contract stops agreeing with the owner, which is the one property it has.
 * Removing a permission whole changes nothing for the rest, because
 * `decideResolved` reads one permission and the settled context.
 *
 * A contract is terminal. Its permissions arrive unmarked at the consumer, so
 * its own reduced serialization is empty, and re-publishing another team's rules
 * is the failure this exists to remove.
 *
 * `options.vetoable` names the keys open to a deny overlay, and a listed key
 * this would drop is an `UnpublishedVetoableError`. The party that authors an
 * overlay checks its contribution by running `applyDenyOverlay` against this
 * document, and an absent key takes its object kind's schema entry with it, so
 * that check would refuse every contribution it was written to accept.
 *
 * `access.matrix` is a deep-frozen `structuredClone`, so this copies out of a
 * value nothing can have mutated since construction.
 */
export function serialize<Sub, R, Keys extends string = string>(
  access: Access<Sub, R, Keys>,
  mode: SerializeMode,
  options: SerializeOptions<Keys> = {},
): Matrix {
  const matrix = access.matrix;
  if (mode === 'full') return matrix;

  const permissions = matrix.permissions.filter(isPublic);
  const keys = new Set(permissions.map((permission) => permission.key));
  const defined = new Set(matrix.permissions.map((p) => p.key));

  for (const key of options.vetoable ?? []) {
    // A key the document does not define is the overlay's own error and carries
    // the overlay's own message, so the two refusals stay distinguishable.
    if (!defined.has(key)) throw new UnknownPermissionError(key);
    if (!keys.has(key)) throw new UnpublishedVetoableError(key);
  }

  const kinds = new Set(permissions.map((permission) => permission.object));
  const { version, maxStale, schema } = matrix;
  const projected =
    schema === undefined ? undefined : projectSchema(schema, kinds);

  return {
    ...(version === undefined ? {} : { version }),
    ...(maxStale === undefined ? {} : { maxStale }),
    ...(projected === undefined ? {} : { schema: projected }),
    permissions: permissions.map(published),
  };
}
