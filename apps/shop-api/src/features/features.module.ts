import { DynamicModule, Module, Provider } from '@nestjs/common';
import { SHOP_FEATURES } from './feature.constants.js';
import { FeaturesController } from './features.controller.js';
import { FeaturesService } from './features.service.js';
import { buildShopFeatures } from './shop.features.js';

/**
 * Provides the built store and the per-request service to the whole
 * application.
 *
 * @example
 * ```ts
 * @Module({ imports: [FeaturesModule.forRoot()] })
 * export class AppModule {}
 * ```
 */
// #region features-module
@Module({})
export class FeaturesModule {
  /**
   * Builds the store once and returns the module, registered `global: true`.
   *
   * Global for the reason `AclModule.forRoot()` states about its own
   * registration: `GamesService` resolves `FeaturesService` from the root
   * injector, and without it every module reading a flag would import this one.
   * `FeaturesService` reads `SubjectService`, which `AclModule` exports, so
   * `AclModule.forRoot()` must be imported too.
   *
   * Call it once. A second `forRoot()` registers a second `SHOP_FEATURES`
   * provider under the same token and the last import wins.
   */
  static forRoot(): DynamicModule {
    const featuresProvider: Provider = {
      provide: SHOP_FEATURES,
      // createFeatures runs here and nowhere else, so the process holds one
      // validated store and a defect in the definitions stops the boot.
      useValue: buildShopFeatures(),
    };

    return {
      global: true,
      module: FeaturesModule,
      controllers: [FeaturesController],
      providers: [featuresProvider, FeaturesService],
      exports: [featuresProvider, FeaturesService],
    };
  }
}
// #endregion features-module
