/**
 * The storefront's copy of the shop-api's access matrix, and the decisions this
 * app makes on it.
 *
 * The storefront renders on the server, so a decision reached here is a decision
 * reached in a trusted runtime and it governs what this app renders and what its
 * own POST handler does. It is still not the authoritative one for the
 * catalogue: the shop-api owns the data, holds the same document, and re-decides
 * every request it receives. Neither layer reads the other's verdict.
 *
 * `parseMatrix` and never `hydratePolicy`: the document arrived over the wire
 * from another process, so it is adopted in the closed mode, where a key the
 * document does not carry decides `unknown-action` rather than throwing
 * mid-render.
 */
import { parseMatrix, type Access, type Decision } from '@evanion/acl';

import type { ShopApi } from './shop-api.js';
import type { StorefrontSubject } from './subject.js';

/** The adopted document, with the revision it was adopted from. */
interface HeldPolicy {
  version: string | number | undefined;
  access: Access;
}

/**
 * How long a held document is served without asking the shop-api again.
 *
 * A ceiling on how long a rule change takes to reach this app's render gates.
 * The shop-api re-decides every request on its own copy, so a storefront running
 * a minute behind hides a control it should show or shows one that is then
 * refused, and grants nothing.
 */
// #region policy-cache
export const POLICY_REVALIDATE_MS = 60_000;

let held: HeldPolicy | undefined;
let checkedAt = 0;
let inFlight: Promise<Access | undefined> | undefined;

/**
 * The document this process decides on.
 *
 * Module scope and not per request: construction validates, deep-clones and
 * deep-freezes the document, every decision after that is a local function call
 * over the frozen copy, and the document is the same for every visitor. Holding
 * it here is what keeps a network call out of a decision -- a page render reads
 * an already-adopted `Access` and calls `can` on it.
 *
 * Two things replace what is held: a revision the shop-api reports that differs
 * from the held one, and the {@link POLICY_REVALIDATE_MS} window expiring, which
 * is what makes this app ask at all. A matching revision re-uses the adopted
 * object, so re-validating the same bytes on a poll is skipped.
 *
 * A failed or unreadable response leaves the held document in place and the
 * window open, so the next request asks again. The alternative refuses every
 * shopper for as long as the shop-api is unreachable, while the shop-api is the
 * layer that would refuse a real write anyway.
 *
 * No `fetchedAt` is reported to `parseMatrix`: that option obliges the document
 * to state `maxStale`, and the shop-api's does not.
 */
export async function policyAccess(api: ShopApi): Promise<Access | undefined> {
  if (held && Date.now() - checkedAt < POLICY_REVALIDATE_MS) return held.access;

  // One fetch for however many renders are in flight when the window expires.
  inFlight ??= refresh(api).finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}
// #endregion policy-cache

// #region policy-refresh
async function refresh(api: ShopApi): Promise<Access | undefined> {
  const document = await api.policy();
  if (!document.ok) return held?.access;

  const { version, matrix } = document.value;
  if (held && held.version === version) {
    checkedAt = Date.now();
    return held.access;
  }

  try {
    const access = parseMatrix(matrix);
    held = { version, access };
    checkedAt = Date.now();
    return access;
  } catch {
    // A document that fails validation is not a document. Nothing replaces what
    // is held, and the window stays open so the next request asks again.
    return held?.access;
  }
}
// #endregion policy-refresh

/** Drops the held document, so the next call fetches. For tests. */
export function resetPolicyCache(): void {
  held = undefined;
  checkedAt = 0;
  inFlight = undefined;
}

/**
 * One decision, or `undefined` when this app holds no document to decide on.
 *
 * `undefined` is a refusal and never a pass: an app that cannot evaluate has not
 * decided that the action is allowed. It is kept apart from a `Decision` so a
 * caller can say "the shop has not published its rules" rather than attribute a
 * refusal to a rule that was never read.
 *
 * @param subject Optional so a component rendered outside a request -- through
 * Astro's container API, which supplies no `locals` -- refuses rather than
 * throws.
 */
export function decide(
  access: Access | undefined,
  subject: StorefrontSubject | undefined,
  key: string,
  action: string,
  object?: Record<string, unknown>,
): Decision | undefined {
  if (!access || !subject) return undefined;
  return access.can(subject, key, action, object);
}

/**
 * Whether this visitor may place an order at all.
 *
 * The gate on every buying control the storefront renders and on every write its
 * cart accepts. A control shown to a visitor the matrix refuses is a control
 * whose only outcome is a refusal page.
 */
export function mayPlaceOrder(
  access: Access | undefined,
  subject: StorefrontSubject | undefined,
): boolean {
  return decide(access, subject, 'order', 'create')?.allowed === true;
}

/**
 * What a refused shopper is told, from the reason the engine gave.
 *
 * `unknown-action` covers both a document this app never received and one whose
 * published keys no longer carry `order.create`, which read the same way to a
 * shopper: this shop is not taking orders through this page right now.
 */
export function refusalText(decision: Decision | undefined): string {
  switch (decision?.reason) {
    case 'no-rule-matched':
    case 'denied':
      return 'Sign in as a customer to place an order.';
    case 'stale-contract':
    case 'unevaluable':
    case 'unusable-clock':
      return 'The shop cannot check that right now. Try again in a moment.';
    default:
      return 'The shop is not taking orders through this page right now.';
  }
}
