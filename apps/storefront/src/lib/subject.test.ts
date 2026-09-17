import { describe, expect, it } from 'vitest';

import {
  ANONYMOUS_SUBJECT,
  CUSTOMER_SUBJECT,
  SUBJECT_COOKIE,
  parseSubject,
  readSubject,
} from './subject.js';

/**
 * The demo's identity, read out of a cookie a reader can edit.
 *
 * Every case here is the same property: an identity this app did not issue is
 * the anonymous one. The cookie feeds the `X-Shop-Subject` header the shop-api
 * believes, so a claim that survives this function is a claim that reaches the
 * authoritative layer.
 */

/** A cookie jar holding one raw value, shaped as `readSubject` reads it. */
function jar(raw: string | undefined) {
  return {
    get(name: string) {
      if (name !== SUBJECT_COOKIE || raw === undefined) return undefined;
      return {
        json: () => JSON.parse(raw) as unknown,
      };
    },
  };
}

describe('parseSubject', () => {
  it('takes a subject this app issues', () => {
    expect(parseSubject({ ...CUSTOMER_SUBJECT })).toEqual(CUSTOMER_SUBJECT);
  });

  it.each([
    ['a payload that is not an object', 'customer'],
    ['null', null],
    ['a missing id', { roles: ['customer'], shop: '' }],
    ['an empty id', { id: '', roles: ['customer'], shop: '' }],
    ['a missing shop', { id: 'x', roles: ['customer'] }],
    ['roles that are not an array', { id: 'x', roles: 'customer', shop: '' }],
    ['a role at the wrong type', { id: 'x', roles: [7], shop: '' }],
  ])('falls back to the anonymous subject on %s', (_case, payload) => {
    expect(parseSubject(payload)).toEqual(ANONYMOUS_SUBJECT);
  });

  it('discards a claim to a role this app never issues', () => {
    expect(
      parseSubject({ id: 'staff:ada', roles: ['manager'], shop: 'stockholm' }),
    ).toEqual(ANONYMOUS_SUBJECT);
  });
});

describe('readSubject', () => {
  it('reads the cookie', () => {
    expect(readSubject(jar(JSON.stringify(CUSTOMER_SUBJECT)))).toEqual(
      CUSTOMER_SUBJECT,
    );
  });

  it('is anonymous when there is no cookie', () => {
    expect(readSubject(jar(undefined))).toEqual(ANONYMOUS_SUBJECT);
  });

  it('is anonymous when the cookie is not JSON', () => {
    expect(readSubject(jar('{not json'))).toEqual(ANONYMOUS_SUBJECT);
  });
});
