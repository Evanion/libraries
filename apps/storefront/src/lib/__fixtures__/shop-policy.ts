import { policy, type Matrix } from '@evanion/acl';

import type { PolicyDocument } from '../shop-api.js';

/**
 * A stand-in for the document `GET /api/policy` serves.
 *
 * Authored here rather than imported from `apps/shop-api`: the storefront is an
 * HTTP client of that service and imports none of its modules, so a test that
 * reached into it would be asserting against a coupling the app does not have.
 * What the two share is the wire shape, and this is that shape -- the
 * `order.create` rule as the service publishes it, over the subject fields the
 * service declares.
 */
interface ShopSubject {
  id: string;
  roles: string[];
  shop: string;
}

interface OrderDraft {
  shop: string;
}

export const SHOP_MATRIX_VERSION = 'shop-api@1';

/** The published matrix, at whichever revision a test needs. */
export function shopMatrix(version: string = SHOP_MATRIX_VERSION): Matrix {
  return policy<ShopSubject, { order: OrderDraft }>({
    version,
    schema: {
      subject: { fields: { id: 'string', roles: 'string[]', shop: 'string' } },
      objects: { order: { fields: { shop: 'string' } } },
    },
  }).for('order', (p) =>
    p.allow('create', p.contains('subject.roles', 'customer')),
  ).matrix;
}

/** The body of a `GET /policy` response. */
export function policyDocument(
  version: string = SHOP_MATRIX_VERSION,
): PolicyDocument {
  return { version, matrix: shopMatrix(version) };
}

/** A `GET /policy` response, as `fetch` would resolve it. */
export function policyResponse(version?: string): Response {
  return new Response(JSON.stringify(policyDocument(version)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
