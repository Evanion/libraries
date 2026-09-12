import { URN } from '@evanion/urn';

/** Entity identity for a stubbed order, e.g. `urn:order:8f2c1a`. */
export class OrderURN extends URN {
  static override readonly nid = 'order';
}
