import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ACL_ACCESS } from './acl.constants.js';
import { AclGuard } from './acl.guard.js';
import { PolicyController } from './policy.controller.js';
import { buildShopAccess } from './shop.policy.js';
import { SubjectService } from './subject.service.js';

/**
 * Provides the built matrix, the request subject and the guard to the whole
 * application.
 *
 * @example
 * ```ts
 * @Module({ imports: [AclModule.forRoot()] })
 * export class AppModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(SubjectMiddleware).forRoutes('*');
 *   }
 * }
 * ```
 */
// #region acl-module
@Module({})
export class AclModule {
  /**
   * Builds the matrix once and returns the module, registered `global: true`.
   *
   * Global for the reason `CorrelationModule.forRoot()` states about its own
   * registration: `AclGuard`, `GamesService`, `InventoryClient` and
   * `SubjectMiddleware` all resolve `ACL_ACCESS` or `SubjectService` from the
   * root injector, and without it every one of those modules would import this
   * one.
   *
   * `AclGuard` is bound under `APP_GUARD`, so it runs on every route in the
   * application and the `@Requires` metadata decides which routes it actually
   * gates. A route carrying no metadata is waved through by the guard itself.
   *
   * Call it once. A second `forRoot()` registers a second `ACL_ACCESS`
   * provider under the same token and the last import wins.
   */
  static forRoot(): DynamicModule {
    const accessProvider: Provider = {
      provide: ACL_ACCESS,
      // hydratePolicy runs here and nowhere else, so the process holds one
      // frozen document and a construction failure stops the boot.
      useValue: buildShopAccess(),
    };

    return {
      global: true,
      module: AclModule,
      controllers: [PolicyController],
      providers: [
        accessProvider,
        SubjectService,
        { provide: APP_GUARD, useClass: AclGuard },
      ],
      exports: [accessProvider, SubjectService],
    };
  }
}
// #endregion acl-module
