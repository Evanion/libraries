import { URN } from '@evanion/urn';

/**
 * Entity identity for a stubbed order, e.g. `urn:order:8f2c1a`.
 *
 * The storefront only ever reads one: the API mints it at checkout and the
 * receipt shows it. The subclass exists so the receipt can assert the string it
 * got back is an order urn rather than printing whatever the response held.
 */
export class OrderURN extends URN {
  static override readonly nid = 'order';
}
