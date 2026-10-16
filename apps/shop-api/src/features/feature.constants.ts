/**
 * Injection token for the `Features` store built from this app's definitions.
 *
 * Namespaced and a string, for the reasons `ACL_ACCESS` states: the provider is
 * registered in a `global: true` module, where a bare string collides silently
 * with any other package that picks it, and a `Symbol()` is identity-based, so
 * two copies of this app's code would mint two tokens.
 */
// #region feature-token
export const SHOP_FEATURES = '@evanion/shop-api:SHOP_FEATURES';
// #endregion feature-token
