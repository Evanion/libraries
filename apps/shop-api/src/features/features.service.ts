import type { BoundFeatures, Features } from '@evanion/feature';
import { Inject, Injectable } from '@nestjs/common';
import { SubjectService } from '../acl/subject.service.js';
import { SHOP_FEATURES } from './feature.constants.js';
import type { ShopFlags } from './shop.features.js';

/**
 * The shop's flags, bound to the request in flight.
 *
 * A plain singleton that reads the subject off `SubjectService`, for the reason
 * `SubjectService` states about its own scope: `Scope.REQUEST` propagates
 * upward through the injection graph and rebuilds every dependant per request.
 */
// #region features-service
@Injectable()
export class FeaturesService {
  constructor(
    @Inject(SHOP_FEATURES)
    private readonly features: Features<ShopFlags>,
    private readonly subjects: SubjectService,
  ) {}

  /**
   * The store bound to the request in flight.
   *
   * `for` settles the instant at this call. A service reading several flags
   * holds the handle it got and reads them all from it, so they cannot straddle
   * a window boundary. The subject is read off `SubjectService`, which is the
   * AsyncLocalStorage the middleware opened, and a call outside one binds an
   * empty context: no rollout places an unnamed subject.
   */
  current(): BoundFeatures<ShopFlags> {
    const subject = this.subjects.current();
    return this.features.for({
      targetingKey: subject?.id,
      roles: subject?.roles,
    });
  }
}
// #endregion features-service
