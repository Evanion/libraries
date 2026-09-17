import type { Access } from '@evanion/acl';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACL_ACCESS, REQUIRES_PERMISSION } from './acl.constants.js';
import type { RequiredPermission } from './requires.decorator.js';
import type { ShopObjects } from './shop.policy.js';
import type { ShopSubject } from './shop-subject.model.js';
import { SubjectService } from './subject.service.js';

/**
 * Decides every `@Requires` route it can decide without the row.
 *
 * A guard runs before the handler, so it holds the subject and no object. A
 * permission whose rules read only `subject.*` is fully decided here and a
 * refusal never reaches the controller. A permission whose rules read an
 * `object.*` path is undecidable here, and `access.readsObject` says which of
 * the two this is, from the document rather than from the call.
 *
 * Passing an undecidable permission through is correct only because the service
 * decides it on the row it loads. `acl.guard.spec.ts` asserts the refusal side;
 * `games.service.spec.ts` asserts the row side.
 */
// #region acl-guard
@Injectable()
export class AclGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subjects: SubjectService,
    @Inject(ACL_ACCESS)
    private readonly access: Access<ShopSubject, ShopObjects>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      RequiredPermission | undefined
    >(REQUIRES_PERMISSION, [context.getHandler(), context.getClass()]);

    if (!required) return true;

    const subject = this.subjects.current();
    // SubjectMiddleware runs on every route and falls back to the anonymous
    // subject, so this is reached only where the middleware did not run, which
    // is a request nothing resolved an actor for.
    if (!subject) throw new UnauthorizedException();

    const decision = this.access.can(subject, required.key, required.action);
    if (decision.allowed) return true;

    // `unevaluable` means the rules read fields of a row this seat does not
    // hold. The service decides it after the read, so the request continues.
    if (this.access.readsObject(required.key, required.action)) return true;

    throw new ForbiddenException(decision.reason);
  }
}
// #endregion acl-guard
