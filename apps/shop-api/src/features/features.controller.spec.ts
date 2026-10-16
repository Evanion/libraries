import { parseFeatureConfig, type FeatureConfig } from '@evanion/feature';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { SHOP_FEATURES } from './feature.constants.js';
import { FeaturesController } from './features.controller.js';
import { buildShopFeatures, SHOP_FEATURES_VERSION } from './shop.features.js';

const controllerOver = async () => {
  const module = await Test.createTestingModule({
    controllers: [FeaturesController],
    providers: [{ provide: SHOP_FEATURES, useValue: buildShopFeatures() }],
  }).compile();
  return module.get(FeaturesController);
};

/** The document as it reaches another process: through JSON, and nothing else. */
const overTheWire = (controller: FeaturesController) =>
  JSON.parse(JSON.stringify(controller.read().config)) as FeatureConfig;

describe('FeaturesController', () => {
  it('states the version alongside the document', async () => {
    const controller = await controllerOver();

    const published = controller.read();

    expect(published.version).toBe(SHOP_FEATURES_VERSION);
    expect(published.config.version).toBe(SHOP_FEATURES_VERSION);
  });

  it('serves a document parseFeatureConfig accepts', async () => {
    const controller = await controllerOver();

    const parsed = parseFeatureConfig(overTheWire(controller));

    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.features.version).toBe(SHOP_FEATURES_VERSION);
  });

  it('decides what the server decides, from the served bytes alone', async () => {
    const controller = await controllerOver();
    const server = buildShopFeatures();
    const parsed = parseFeatureConfig(overTheWire(controller));
    if (!parsed.ok) throw new Error('the served document was refused');

    for (const targetingKey of ['cust-0001', 'cust-0042', 'cust-0101']) {
      const shopper = { targetingKey, roles: ['customer'] };

      expect(parsed.features.isEnabled('express-pickup', shopper)).toBe(
        server.isEnabled('express-pickup', shopper),
      );
    }
  });
});
