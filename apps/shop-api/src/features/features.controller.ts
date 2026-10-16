import {
  serializeConfig,
  type Features,
  type FeatureConfig,
} from '@evanion/feature';
import { Controller, Get, Inject } from '@nestjs/common';
import { SHOP_FEATURES } from './feature.constants.js';
import type { ShopFlags } from './shop.features.js';

/** The body `GET /api/features` answers with. */
export interface FeaturesDocument {
  /** What a holder compares against the version it already has, with `!==`. */
  version: string | number | undefined;
  /** The definitions, which a holder installs with `parseFeatureConfig`. */
  config: FeatureConfig<keyof ShopFlags>;
}

/**
 * Publishes this service's feature definitions to the storefront and the back
 * office.
 *
 * Each holder installs the document and resolves locally, so no decision costs
 * a network call. The library ships no transport, and this endpoint is the
 * application's own, as `PolicyController` is for the matrix.
 */
// #region serve-the-document
@Controller('features')
export class FeaturesController {
  constructor(
    @Inject(SHOP_FEATURES)
    private readonly features: Features<ShopFlags>,
  ) {}

  @Get()
  read(): FeaturesDocument {
    const config = serializeConfig(this.features);
    return { version: config.version, config };
  }
}
// #endregion serve-the-document
