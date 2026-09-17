import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ShopSubject } from './shop-subject.model.js';

/**
 * The subject of the request in flight, held in AsyncLocalStorage.
 *
 * A plain singleton, following `CorrelationService`. `Scope.REQUEST` would
 * propagate upward through the injection graph: every provider depending on
 * this one becomes request-scoped too, is rebuilt per request, and never
 * receives `onModuleInit`. `GamesService` and `InventoryClient` both depend on
 * it, and `InventoryClient` holds `HttpService`, which is the provider
 * `orders.e2e.spec.ts` asserts stays a singleton.
 */
// #region subject-service
@Injectable()
export class SubjectService {
  private readonly storage = new AsyncLocalStorage<ShopSubject>();

  /**
   * Runs `callback` with `subject` as the actor. Everything it awaits,
   * schedules or calls reads that subject, and overlapping requests stay
   * isolated.
   *
   * `SubjectMiddleware` does this per request. Call it directly for work no
   * request drives, such as a queue consumer or a seeding script.
   */
  run<T>(subject: ShopSubject, callback: () => T): T {
    return this.storage.run(subject, callback);
  }

  /**
   * The subject of the surrounding context, or `undefined` outside one.
   *
   * It invents no subject. A caller that needs one refuses when this answers
   * `undefined`, because a decision made against a subject nobody stated is a
   * decision made against nothing.
   */
  current(): ShopSubject | undefined {
    return this.storage.getStore();
  }
}
// #endregion subject-service
