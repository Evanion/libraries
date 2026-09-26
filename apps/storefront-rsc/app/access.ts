import { cache } from 'react';
import {
  parseMatrix,
  type Access,
  type Authorized,
  type Matrix,
} from '@evanion/acl';

import { fetchJson, type Game, type TelemetryEvent } from './shop-api';
import { currentSubject, type ShopSubject } from './subject';

/**
 * The object kind behind each key this app decides over.
 *
 * Two kinds, because two are what the page renders. shop-api's matrix also
 * carries `order`, and a key this map does not name is a compile error at the
 * call site, which is the point: a widget cannot quietly ask about a kind this
 * app holds no rows of.
 */
export interface ShopObjects {
  game: Game;
  telemetry: TelemetryEvent;
}

/** The evaluator, bound to the subject this app resolves and the rows it holds. */
export type ShopAccess = Access<ShopSubject, ShopObjects>;

/**
 * The body `GET /api/policy` answers with. shop-api's `PolicyDocument`, as this
 * app's own type for the reason the response types in `shop-api.ts` are.
 */
export interface PolicyDocument {
  /** What a holder compares against the version it already has, with `!==`. */
  version: string | number | undefined;
  /** The contract itself, adopted below with `parseMatrix`. */
  matrix: Matrix;
}

/**
 * The last document this process adopted, and the evaluator over it.
 *
 * `parseMatrix` validates the document, deep-clones it and deep-freezes the
 * clone, so a render that parses is a render whose first widget waits on that
 * work. Holding the result across requests takes it off every render after the
 * first.
 *
 * Sharing one evaluator between requests and between visitors is safe because
 * an `Access` holds a document and no actor: `can`, `capabilities` and
 * `authorize` each take the subject as an argument and settle the clock per
 * call, so nothing about one page view is retained in here. The version is the
 * key, so a document shop-api republishes under a new version replaces this one
 * on the next page view rather than being evaluated under the old rules.
 */
// #region version-keyed-memo
let adopted:
  { version: string | number | undefined; access: ShopAccess } | undefined;

/**
 * The evaluator over `document`, parsed only when the version moved.
 *
 * `parseMatrix` and not `hydratePolicy`: a key the document does not carry,
 * such as the internal `inventory.read`, refuses with `unknown-action` where
 * `hydratePolicy` would throw mid-render.
 *
 * The cast states this app's subject and row types. `parseMatrix` reads the
 * document at runtime, so it returns an `Access` over plain records, and
 * TypeScript cannot check that against `ShopAccess`. The document's `schema`,
 * which `parseMatrix` checks every condition against, is what keeps shop-api's
 * rows and these types in step.
 */
function adopt(document: PolicyDocument): ShopAccess {
  if (adopted && adopted.version === document.version) return adopted.access;
  const access = parseMatrix(document.matrix) as unknown as ShopAccess;
  adopted = { version: document.version, access };
  return access;
}
// #endregion version-keyed-memo

/**
 * shop-api's access matrix, fetched once for the page view and adopted locally.
 *
 * `cache` is what makes it once. Three widgets render independently, none of
 * them knows about the others, and each one asks for the evaluator it needs; one
 * `GET /api/policy` answers all three. Two concurrent page views each get their
 * own fetch, which a module-level promise would not give them.
 *
 * Every decision after this point is local. The matrix is a document and the
 * engine evaluates it in this process, so no `can` call reaches the network,
 * however deep in the tree it sits.
 *
 * An unreachable shop-api throws here and the render fails, the same way every
 * widget's own fetch already fails. An evaluator that quietly refused everything
 * would render a page telling the visitor what they may not do when the truth is
 * that the catalogue service is down.
 */
// #region per-request-cache
export const currentAccess = cache(async (): Promise<ShopAccess> =>
  adopt(await fetchJson<PolicyDocument>('/policy')),
);

/**
 * The matrix bound to this page view's subject and one clock instant.
 *
 * Bound once so every widget decides against the same actor at the same
 * instant. Two widgets settling their own `now` a few milliseconds apart would
 * be able to disagree about a rule with a time window in it.
 *
 * This is the handle the widgets call, and it is the app's whole enforcement
 * story on the render side. shop-api decides again on its own copy of the same
 * document for every request this app sends it, so a widget that decided wrong
 * is a rendering bug and not an access-control one.
 */
export const authorized = cache(async (): Promise<Authorized<ShopObjects>> => {
  const [access, subject] = await Promise.all([
    currentAccess(),
    currentSubject(),
  ]);
  return access.authorize(subject);
});
// #endregion per-request-cache
