import { describe, expect, it } from 'vitest';
import {
  buildShopFeatures,
  SHOP_DEFINITIONS,
  SHOP_FEATURES_VERSION,
} from './shop.features.js';

describe('the shop definitions', () => {
  it('build a store carrying the document version', () => {
    const features = buildShopFeatures();

    expect(features.version).toBe(SHOP_FEATURES_VERSION);
  });

  it('turn new-checkout on for an operator', () => {
    const features = buildShopFeatures();

    const decided = features.isEnabled('new-checkout', {
      targetingKey: 'staff:ada',
      roles: ['operator'],
    });

    expect(decided).toBe(true);
  });

  it('place a customer by the ramp', () => {
    const features = buildShopFeatures();
    const customer = (targetingKey: string) =>
      features.isEnabled('new-checkout', { targetingKey, roles: ['customer'] });

    expect(customer('cust-0042')).toBe(true);
    expect(customer('cust-0001')).toBe(false);
  });

  it('turn express-pickup on with its parent and off with it', () => {
    const on = buildShopFeatures();
    const off = buildShopFeatures(
      SHOP_DEFINITIONS.map((definition) =>
        definition.key === 'new-checkout'
          ? { ...definition, enabled: false }
          : definition,
      ),
    );
    const shopper = { targetingKey: 'cust-0042', roles: ['customer'] };

    expect(on.isEnabled('express-pickup', shopper)).toBe(true);
    expect(off.isEnabled('express-pickup', shopper)).toBe(false);
  });
});
