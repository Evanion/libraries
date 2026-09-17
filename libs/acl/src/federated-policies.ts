import { settleNow } from './conditions.js';
import { OriginCollisionError } from './errors.js';
import type { Access, Subject } from './hydrate-policy.js';
import type { Decision, Instant } from './types.js';

/**
 * A set of policies held side by side, one per origin.
 *
 * Three members, and no `matrix`, `version` or `schema`: each of those three is
 * a fact about one document, and a set of N documents has N of them. A caller
 * that wants the document reaches the member through `get`, which hands back
 * the `Access` that was passed in, with everything on it.
 *
 * `canMany`, `canFields`, `readsObject` and `authorize` are absent for the same
 * reason in reverse. Each one answers about a single permission or a single
 * object kind, so the caller that asks already knows which origin holds it, and
 * `get(origin)` is the call that reaches it. Forwarding them would rebuild the
 * facade over an evaluator that already carries them.
 */
export interface FederatedAccess {
  /**
   * The decision the origin holding `${key}.${action}` reaches, forwarded with
   * the arguments untouched.
   *
   * A key no member holds answers
   * `{ key, allowed: false, reason: 'unknown-action' }` and reaches no member,
   * which is what an absent origin answers for every key it would have held.
   */
  can(
    subject: Subject,
    key: string,
    action: string,
    object?: Record<string, unknown>,
    now?: Instant,
  ): Decision;
  /**
   * Every member's capabilities in one record, over one settled instant.
   *
   * The instant is settled here and handed to every member, so a view over N
   * origins reads one clock and a `before`/`after` boundary falls on the same
   * side for all of them.
   */
  capabilities(subject: Subject, now?: Instant): Record<string, Decision>;
  /** The `Access` the caller passed under this origin. */
  get(origin: string): Access | undefined;
}

/**
 * Composes one `Access` per origin into a set that routes by permission key.
 *
 * Construction refuses a key two origins claim, with `OriginCollisionError`
 * naming the key and both origins. The routing table and the check are one
 * pass: the map from canonical key to member is what the collision is found in
 * and what `can` dispatches on.
 *
 * Nothing is merged and nothing is evaluated here. Each member keeps its own
 * document, its own version, its own schema, and its own answer to an unknown
 * key, so a set may mix `parseMatrix` members with an open-mode one and each
 * behaves as its provenance calls for.
 *
 * A deny overlay applies to a document, so it applies per origin before the
 * members are built. This function takes no overlay and no `vetoable` list.
 */
export function federatedPolicies(
  policies: Readonly<Record<string, Access>>,
): FederatedAccess {
  const members = new Map(Object.entries(policies));
  const claimedBy = new Map<string, string>();
  const holder = new Map<string, Access>();

  for (const [origin, access] of members) {
    for (const permission of access.matrix.permissions) {
      const held = claimedBy.get(permission.key);
      if (held !== undefined) {
        throw new OriginCollisionError(permission.key, held, origin);
      }
      claimedBy.set(permission.key, origin);
      holder.set(permission.key, access);
    }
  }

  return {
    can(subject, key, action, object, now) {
      const canonical = `${key}.${action}`;
      const access = holder.get(canonical);
      if (access === undefined) {
        return { key: canonical, allowed: false, reason: 'unknown-action' };
      }
      return access.can(subject, key, action, object, now);
    },
    capabilities(subject, now) {
      const settled = settleNow(now);
      const view: Record<string, Decision> = {};
      for (const access of members.values()) {
        Object.assign(view, access.capabilities(subject, settled));
      }
      return view;
    },
    get(origin) {
      return members.get(origin);
    },
  };
}
