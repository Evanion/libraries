import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AclGuard } from './acl.guard.js';
import type { RequiredPermission } from './requires.decorator.js';
import { buildShopAccess, type ShopObjects } from './shop.policy.js';
import { ANONYMOUS_SUBJECT, type ShopSubject } from './shop-subject.model.js';
import type { SubjectService } from './subject.service.js';

const MANAGER: ShopSubject = {
  id: 'staff:bo',
  roles: ['manager'],
  shop: 'stockholm',
};

/** A Reflector answering with one required permission, or with none. */
const reflectorStub = (required?: RequiredPermission): Reflector =>
  ({ getAllAndOverride: () => required }) as unknown as Reflector;

/** The two members AclGuard reads off the execution context. */
const contextStub = (): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class Handler {},
  }) as unknown as ExecutionContext;

const guardFor = (required?: RequiredPermission, subject?: ShopSubject) =>
  new AclGuard(
    reflectorStub(required),
    { current: () => subject } as unknown as SubjectService,
    buildShopAccess(),
  );

describe('AclGuard', () => {
  it('waves through a route that names no permission', () => {
    const guard = guardFor(undefined, ANONYMOUS_SUBJECT);

    expect(guard.canActivate(contextStub())).toBe(true);
  });

  it('refuses a request no subject was resolved for', () => {
    const guard = guardFor({ key: 'telemetry', action: 'read' });

    expect(() => guard.canActivate(contextStub())).toThrow(
      UnauthorizedException,
    );
  });

  it('allows a role gate the subject satisfies', () => {
    const guard = guardFor({ key: 'telemetry', action: 'read' }, MANAGER);

    expect(guard.canActivate(contextStub())).toBe(true);
  });

  it('refuses a role gate the subject fails, before the handler runs', () => {
    const guard = guardFor(
      { key: 'telemetry', action: 'read' },
      ANONYMOUS_SUBJECT,
    );

    expect(() => guard.canActivate(contextStub())).toThrow(ForbiddenException);
  });

  /**
   * `game.declare` compares `object.shop` against `subject.shop`, and the guard
   * holds no row, so it cannot reach an answer. Passing it on is correct only
   * because GamesService decides it on the row it loads, which
   * games.service.spec.ts asserts.
   */
  it('passes on a permission it cannot decide without the row', () => {
    const guard = guardFor(
      { key: 'game', action: 'declare' },
      ANONYMOUS_SUBJECT,
    );

    expect(guard.canActivate(contextStub())).toBe(true);
  });

  /**
   * Every `@Requires` route whose permission reads the row has to decide again
   * in its service. This states the list the guard is allowed to pass on, so a
   * new object-dependent permission is a failure here until someone decides
   * where its row-level check lives.
   */
  it('names every permission the guard hands onward', () => {
    const access = buildShopAccess();
    const undecidable = access.matrix.permissions
      .filter((permission) =>
        access.readsObject(
          permission.object as keyof ShopObjects & string,
          permission.action,
        ),
      )
      .map((permission) => permission.key)
      .sort();

    expect(undecidable).toEqual(['game.declare', 'game.reprice']);
  });
});
