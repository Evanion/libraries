import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { SHOP_SUBJECT_HEADER } from './acl.constants.js';
import { ANONYMOUS_SUBJECT, type ShopSubject } from './shop-subject.model.js';
import { SubjectMiddleware } from './subject.middleware.js';
import { SubjectService } from './subject.service.js';

const HEADER = SHOP_SUBJECT_HEADER.toLowerCase();

/** The subject the middleware opens a context with for these headers. */
const resolve = (
  headers: Record<string, string | string[]>,
): ShopSubject | undefined => {
  const subjects = new SubjectService();
  const middleware = new SubjectMiddleware(subjects);
  let seen: ShopSubject | undefined;
  middleware.use(
    { headers } as unknown as IncomingMessage,
    {} as ServerResponse,
    () => {
      seen = subjects.current();
    },
  );
  return seen;
};

describe('SubjectMiddleware', () => {
  it('reads the subject the header states', () => {
    const subject: ShopSubject = {
      id: 'staff:ada',
      roles: ['operator'],
      shop: 'stockholm',
    };

    expect(resolve({ [HEADER]: JSON.stringify(subject) })).toEqual(subject);
  });

  it('runs a request with no header as the anonymous customer', () => {
    expect(resolve({})).toEqual(ANONYMOUS_SUBJECT);
  });

  it('discards a payload that is not JSON', () => {
    expect(resolve({ [HEADER]: 'staff:ada' })).toEqual(ANONYMOUS_SUBJECT);
  });

  it('discards a payload missing a member a subject needs', () => {
    expect(
      resolve({ [HEADER]: JSON.stringify({ id: 'staff:ada', roles: [] }) }),
    ).toEqual(ANONYMOUS_SUBJECT);
  });

  it('discards a payload whose roles are not strings', () => {
    const payload = { id: 'staff:ada', roles: [{}], shop: 'stockholm' };

    expect(resolve({ [HEADER]: JSON.stringify(payload) })).toEqual(
      ANONYMOUS_SUBJECT,
    );
  });

  /**
   * Node joins repeated headers with a comma, and two JSON payloads joined that
   * way do not parse. A request naming two actors therefore names none.
   */
  it('discards a duplicated header', () => {
    const subject = { id: 'staff:ada', roles: ['operator'], shop: 'stockholm' };
    const twice = [JSON.stringify(subject), JSON.stringify(subject)];

    expect(resolve({ [HEADER]: twice })).toEqual(ANONYMOUS_SUBJECT);
  });

  it('leaves no subject outside a request', () => {
    const subjects = new SubjectService();

    expect(subjects.current()).toBeUndefined();
  });
});
