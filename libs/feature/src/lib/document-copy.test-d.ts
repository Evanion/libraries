import { describe, expectTypeOf, it } from 'vitest';

import type { FeatureConfig } from './config.js';
import { configCopier, documentCopy } from './document-copy.js';
import * as entry from '../index.js';

const defs = [
  { key: 'checkout', enabled: true },
  { key: 'express', enabled: true, dependsOn: ['checkout'] },
] as const;

describe('documentCopy', () => {
  it('hands back the type it was handed and widens none of it', () => {
    expectTypeOf(documentCopy(defs)).toEqualTypeOf<typeof defs>();
  });

  it('reads a document and answers a document', () => {
    const document: FeatureConfig = {
      version: 41,
      features: [{ key: 'checkout', enabled: true }],
    };

    expectTypeOf(documentCopy(document)).toEqualTypeOf<FeatureConfig>();
  });

  it('answers a string for a string and no any a caller could index', () => {
    // The one type variable carries no constraint, so a literal written at the
    // call widens to its primitive. A value whose own type is the literal, the
    // `as const` above, keeps it.
    expectTypeOf(documentCopy('v1')).toEqualTypeOf<string>();
    expectTypeOf(documentCopy('v1')).not.toBeAny();
    expectTypeOf(documentCopy(defs[0].key)).toEqualTypeOf<'checkout'>();
  });

  it('answers the narrowed key a document states', () => {
    const narrowed: FeatureConfig<'checkout'> = {
      features: [{ key: 'checkout', enabled: true }],
    };

    expectTypeOf(documentCopy(narrowed)).toEqualTypeOf<
      FeatureConfig<'checkout'>
    >();
  });

  it('reads a value the refusal is a runtime one for', () => {
    // A `Date` is legal for the parameter and wrong for the domain: the
    // parameter is one type variable, so the walk is what refuses it and the
    // call compiles.
    expectTypeOf(documentCopy(new Date(0))).toEqualTypeOf<Date>();
    expectTypeOf(documentCopy(Symbol('blue'))).toEqualTypeOf<symbol>();
  });

  it('reads undefined and null, which it answers in kind', () => {
    expectTypeOf(documentCopy(undefined)).toEqualTypeOf<undefined>();
    expectTypeOf(documentCopy(null)).toEqualTypeOf<null>();
  });

  it('takes one parameter, so no caller passes a walk of its own', () => {
    expectTypeOf(documentCopy).parameters.toEqualTypeOf<[unknown]>();
  });

  it('is published at no entry point, so no allowance entry holds it', () => {
    expectTypeOf(entry).not.toHaveProperty('documentCopy');
    expectTypeOf(entry).not.toHaveProperty('configCopier');
  });
});

describe('configCopier', () => {
  it('answers a copier that hands back the type it was handed', () => {
    const copier = configCopier();

    expectTypeOf(copier(defs)).toEqualTypeOf<typeof defs>();
  });

  it('answers a copier a caller reads a document through', () => {
    const document: FeatureConfig = {
      version: 41,
      features: [{ key: 'checkout', enabled: true }],
    };

    expectTypeOf(configCopier()(document)).toEqualTypeOf<FeatureConfig>();
  });

  it('answers a copier that is no any, which would type every call', () => {
    expectTypeOf(configCopier()).not.toBeAny();
    expectTypeOf(configCopier()('v1')).not.toBeAny();
  });

  it('takes no argument, so no caller states which copier it wants', () => {
    expectTypeOf(configCopier).parameters.toEqualTypeOf<[]>();
  });

  it('answers the type documentCopy itself has', () => {
    expectTypeOf(configCopier()).toEqualTypeOf(documentCopy);
  });
});
