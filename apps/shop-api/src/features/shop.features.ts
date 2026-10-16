import {
  createFeatures,
  type SerializedDefinition,
  type Features,
} from '@evanion/feature';

/**
 * The feature keys the game shop declares, and the variants each one splits
 * across. Both flags are plain on/off, so each maps to `never`.
 *
 * A flag the schema does not name is a compile error at the call site, and the
 * three processes that read the served document share the keys through the
 * document and not through this type.
 */
export interface ShopFlags {
  'new-checkout': never;
  'express-pickup': never;
}

/**
 * What a document carrying these definitions is called.
 *
 * Opaque to every holder, which compares it with `!==`. Change it whenever a
 * definition below changes, so the storefront and the back office know to
 * reload.
 */
export const SHOP_FEATURES_VERSION = '2026-10-16.1';

/**
 * The shop's definitions.
 *
 * `new-checkout` is on for operators and for a quarter of the customers.
 * `express-pickup` carries no rule of its own and depends on `new-checkout`, so
 * it resolves on for exactly the same people and turns off with its parent.
 */
// #region shop-definitions
export const SHOP_DEFINITIONS: SerializedDefinition<keyof ShopFlags>[] = [
  {
    key: 'new-checkout',
    enabled: true,
    rules: [
      {
        id: 'staff',
        when: [{ field: 'roles', op: 'contains', value: 'operator' }],
      },
      { id: 'ramp', rollout: { percent: 25, by: 'targetingKey' } },
    ],
  },
  { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
];
// #endregion shop-definitions

/**
 * Builds the store `FeaturesModule.forRoot()` provides.
 *
 * `createFeatures` validates the definitions and the dependency graph, so a
 * cycle or an unknown dependency stops the boot. Pass `definitions` to build a
 * store over other rules, which is how a spec turns a flag off.
 */
export function buildShopFeatures(
  definitions: SerializedDefinition<keyof ShopFlags>[] = SHOP_DEFINITIONS,
): Features<ShopFlags> {
  return createFeatures<ShopFlags>({
    version: SHOP_FEATURES_VERSION,
    features: definitions,
  });
}
