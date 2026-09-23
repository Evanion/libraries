import { describe, expect, it } from 'vitest';
import {
  DuplicateVariantError,
  FeatureConfigError,
  UnknownVariantError,
} from './errors.js';
import { validateVariants } from './variants.js';

describe('validateVariants', () => {
  it('accepts a feature declaring no variants', () => {
    expect(() => validateVariants({ key: 'k', enabled: true })).not.toThrow();
  });

  it('accepts a single variant, which is how a value flag is written', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'only', weight: 1, value: { label: 'Buy' } }],
      }),
    ).not.toThrow();
  });

  it('refuses two variants sharing a name', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 1 },
          { name: 'a', weight: 1 },
        ],
      }),
    ).toThrow(DuplicateVariantError);
  });

  it('refuses a rule pinning a variant the feature does not declare', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: 1 }],
        rules: [{ variant: 'b' }],
      }),
    ).toThrow(UnknownVariantError);
  });

  it('refuses a negative weight', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: -1 }],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a weight that is not finite', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: Number.NaN }],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a variant set whose weights are all zero', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 0 },
          { name: 'b', weight: 0 },
        ],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses an empty variant array', () => {
    expect(() =>
      validateVariants({ key: 'k', enabled: true, variants: [] }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses two variants sharing an order', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 1, order: 0 },
          { name: 'b', weight: 1, order: 0 },
        ],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses an order that is not a non-negative integer', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [{ name: 'a', weight: 1, order: 1.5 }],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('refuses a partial order declaration, which mixes two orderings', () => {
    expect(() =>
      validateVariants({
        key: 'k',
        enabled: true,
        variants: [
          { name: 'a', weight: 1, order: 0 },
          { name: 'b', weight: 1 },
        ],
      }),
    ).toThrow(FeatureConfigError);
  });

  it('names the feature and the variant in a duplicate-name message', () => {
    expect(() =>
      validateVariants({
        key: 'checkout',
        enabled: true,
        variants: [
          { name: 'blue', weight: 1 },
          { name: 'blue', weight: 1 },
        ],
      }),
    ).toThrow(/checkout.*blue|blue.*checkout/);
  });
});
