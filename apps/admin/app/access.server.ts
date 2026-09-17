import { NO_ACCESS, adoptMatrix } from './access.js';
import type { AdminObjects, AdminSubject } from './access.js';
import { ShopApiUnavailable, getPolicy } from './shop-api.server.js';
import type { Access } from '@evanion/acl';

/**
 * The server half of the back office's access control: who the request runs as,
 * and where the contract comes from.
 *
 * `.server.ts`, so the fetch and the subject construction stay out of the
 * browser bundle. The vocabulary both runtimes share sits in `access.ts`.
 */

/**
 * Who the back office signs in as.
 *
 * Demo-grade, and the whole of the identity story here. Real authentication is
 * out of scope for this chain: nothing verifies a session, and shop-api believes
 * the subject this app states. A deployment replaces this function with one that
 * reads a verified session and leaves every other module unchanged, because the
 * subject reaches loaders and actions through `subjectContext` alone.
 *
 * `ADMIN_SUBJECT` overrides it with the same JSON shape, which is how the demo
 * shows a manager and an operator against one catalogue without an edit. A
 * payload that does not parse, or that misses a member, falls back to the
 * literal rather than to a repaired half of itself.
 */
export function demoSubject(): AdminSubject {
  const stated = process.env['ADMIN_SUBJECT'];
  if (stated) {
    const parsed = parseSubject(stated);
    if (parsed) return parsed;
  }
  return { id: 'staff:ines', roles: ['operator'], shop: 'stockholm' };
}

/** A stated subject, or undefined when the text states no usable one. */
function parseSubject(stated: string): AdminSubject | undefined {
  let value: unknown;
  try {
    value = JSON.parse(stated);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  const { id, roles, shop } = candidate;
  if (typeof id !== 'string' || typeof shop !== 'string') return undefined;
  if (!Array.isArray(roles) || !roles.every((r) => typeof r === 'string')) {
    return undefined;
  }
  return { id, roles, shop };
}

/**
 * The display name of the operator a subject stands for.
 *
 * The nav shows a person and the matrix reads an id, and the demo has no
 * directory to join the two through, so the id carries the name after its
 * namespace.
 */
export function operatorName(subject: AdminSubject): string {
  const [, local = subject.id] = subject.id.split(':');
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Fetches shop-api's contract and adopts it.
 *
 * The fetch is the only network call access control makes here, and it obtains
 * the document rather than an answer. Every decision after it is a function call
 * over the frozen copy, on the server and in the browser alike.
 *
 * A shop-api that cannot be reached yields {@link NO_ACCESS}, which refuses
 * every key. The back office then draws its chrome, shows the unavailable
 * notice the shelf read already produces, hides the controls and writes nothing.
 */
export async function readAccess(
  correlationId: string,
  subject: AdminSubject,
): Promise<Access<AdminSubject, AdminObjects>> {
  try {
    const document = await getPolicy(correlationId, subject);
    return adoptMatrix(document.matrix);
  } catch (error) {
    if (!(error instanceof ShopApiUnavailable)) throw error;
    return NO_ACCESS;
  }
}
