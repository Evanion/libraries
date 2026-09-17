import { parseMatrix } from '@evanion/acl';
import { createPolicyContext } from '@evanion/react-acl';
import type { Access, Decision, Matrix } from '@evanion/acl';

/**
 * What the back office decides with, on both sides of the render.
 *
 * Deliberately not a `.server` module. The React Router server evaluates the
 * matrix to enforce, the browser evaluates the same matrix to toggle, and both
 * halves name the same keys and the same object shapes, so the vocabulary lives
 * in one module that either runtime may import. The fetch that obtains the
 * document is the server's alone and lives in `access.server.ts`.
 *
 * Nothing here is a permission check on the shelf. `shelf-policy.server.ts` is
 * the merchant's availability override table and shares only the word "policy".
 */

/**
 * The actor every decision is made against.
 *
 * The three members shop-api's matrix schema declares for a subject. A decision
 * this app reaches is made on this app's own copy of the document, so the
 * subject has to carry what the rules read: `roles` for the role gates and
 * `shop` for the ownership comparison against `object.shop`.
 *
 * `parseMatrix<AdminSubject, AdminObjects, AdminPermission>` binds this to the
 * returns, so {@link adoptMatrix} states what it parsed with no cast, and a key
 * or a row field nothing here names is a compile error at the call site.
 */
export type AdminSubject = {
  /** Stable identity of the actor, e.g. `staff:ada`. */
  id: string;
  /** What the actor may do: `customer`, `operator`, `manager`. */
  roles: string[];
  /** Slug of the shop the actor works for, e.g. `stockholm`. */
  shop: string;
};

/**
 * A catalogue row as the matrix reads it.
 *
 * The field names and types restate what shop-api's published schema declares
 * for its `game` kind, in shop-api's own vocabulary: `availability` holds the
 * hyphenated API token, not the wording the back office prints. TypeScript
 * checks this app's call sites against it and `parseMatrix` checks the document
 * against the schema the document carries, so a drift between the two surfaces
 * at the call site and at adoption rather than as a silent refusal.
 */
export type AdminGame = {
  urn: string;
  title: string;
  mechanisms: string[];
  players: string;
  playtime: string;
  complexity: number;
  price: number;
  availability: string;
  shop: string;
};

/** An order at the moment it is placed, as the matrix reads it. */
export type AdminOrder = {
  shop: string;
};

/** One event of the observability sink, as the matrix reads it. */
export type AdminTelemetry = {
  id: number;
  timestamp: string;
  correlationId?: string;
  source: string;
  type: string;
};

/**
 * The object kind each key decides over.
 *
 * `createPolicyContext<AdminSubject, AdminObjects>` binds it, so `useCan('game',
 * 'declare', row)` checks the key and the row, and a key nothing here names is a
 * compile error where it is written.
 */
export type AdminObjects = {
  game: AdminGame;
  order: AdminOrder;
  telemetry: AdminTelemetry;
};

/**
 * The permission keys the back office asks about.
 *
 * Keys and actions are separate arguments to `can`, and `capabilities()` returns
 * one map keyed by the two joined. The library types the key half and leaves the
 * action a plain string, so this union is what stops a capability read naming a
 * permission the contract does not carry. It is a claim about what this app asks
 * for, and `parseMatrix` answers `unknown-action` at runtime for anything the
 * served document does not hold.
 */
export type AdminPermission =
  | 'game.read'
  | 'game.declare'
  | 'game.reprice'
  | 'order.create'
  | 'telemetry.read';

/**
 * Whether a capability map allows one permission.
 *
 * The map's type says every `AdminPermission` is present, because the type
 * argument to `parseMatrix` asserts what this app expects and validates
 * nothing. A served document that has dropped a permission answers `undefined`
 * here, so the read stays optional and an absent key reads as refused.
 */
export function allows(
  capabilities: Partial<Record<AdminPermission, Decision>>,
  permission: AdminPermission,
): boolean {
  return capabilities[permission]?.allowed === true;
}

/**
 * The evaluator a holder with no document decides on: it refuses everything.
 *
 * `parseMatrix` fails closed, so a permission absent from a document answers
 * `unknown-action` rather than throwing, and a document holding no permissions
 * answers that for every key. It is the fallback for a request that could not
 * reach shop-api and the default the bound provider carries, which is what makes
 * an unreachable policy service a back office that shows nothing and writes
 * nothing.
 */
export const NO_ACCESS = parseMatrix<
  AdminSubject,
  AdminObjects,
  AdminPermission
>({
  version: 'admin:none',
  permissions: [],
});

/**
 * The parsed document, reused across requests while its version holds.
 *
 * `parseMatrix` validates, deep-clones and deep-freezes, which is work per
 * request that nothing about a request changes: the document is one frozen
 * contract evaluated against many subjects, it carries no per-request state, and
 * every decision reads the subject the caller passes. Reusing one across
 * requests and across users is therefore the same evaluation as parsing a fresh
 * copy each time.
 *
 * The version is what keys it. shop-api stamps `SHOP_MATRIX_VERSION` on the
 * document and changes it when the rules change, which is the same `!==`
 * comparison the library's revalidation contract is written around. A document
 * that states no version is parsed every time, because nothing about it says
 * whether it is the one already held.
 */
// #region adopt-matrix
let adopted:
  | { version: string | number; access: Access<AdminSubject, AdminObjects> }
  | undefined;

/**
 * Adopts a matrix that arrived over the wire.
 *
 * `parseMatrix` and not `hydratePolicy`: the document is foreign input, and the
 * closed mode is what makes an unknown permission a refusal rather than a throw
 * inside a loader.
 */
export function adoptMatrix(
  matrix: Matrix,
): Access<AdminSubject, AdminObjects> {
  const { version } = matrix;
  if (version !== undefined && adopted?.version === version) {
    return adopted.access;
  }
  const access = parseMatrix<AdminSubject, AdminObjects, AdminPermission>(
    matrix,
  );
  if (version !== undefined) adopted = { version, access };
  return access;
}
// #endregion adopt-matrix

/**
 * The provider and hooks the component tree reads, bound to this app's subject
 * and object map.
 *
 * Bound to {@link NO_ACCESS} and handed the fetched document as a prop on every
 * mount. The factory needs a value to take its two type parameters from, and the
 * document this app decides on arrives per request, so the binding value is the
 * one that refuses everything: a tree mounted without a document shows nothing
 * rather than showing whatever the previous render held.
 *
 * Every decision these hooks reach toggles an element. The loaders and the
 * actions decide again on the server and are the only place a refusal stops a
 * write.
 */
export const { PolicyProvider, useCan, useCanMany, useCapabilities } =
  createPolicyContext<AdminSubject, AdminObjects>(NO_ACCESS);
