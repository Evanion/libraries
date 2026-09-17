/**
 * Injection token for the `Access` built from this app's own matrix.
 *
 * Namespaced, for the reason `CORRELATION_CONFIG_TOKEN` states about its own:
 * the provider is registered in a `global: true` module, where a bare
 * `'ACL_ACCESS'` collides silently with any other package that picks the same
 * string. A string and not a `Symbol()`, because a symbol is identity-based, so
 * two copies of this app's code would mint two tokens and Nest would fail to
 * resolve one of them.
 */
// #region acl-token
export const ACL_ACCESS = '@evanion/shop-api:ACL_ACCESS';
// #endregion acl-token

/**
 * Header carrying the demo subject, as JSON: `{"id":…,"roles":[…],"shop":…}`.
 *
 * `SubjectMiddleware` reads it and `InventoryClient` writes it on the loopback
 * hop. Real authentication is out of scope for this demo, so a caller states
 * who it is and the server believes it; see `ShopSubject` for the rest of that
 * caveat.
 */
export const SHOP_SUBJECT_HEADER = 'X-Shop-Subject';

/**
 * Metadata key the `@Requires` decorator writes and `AclGuard` reads.
 *
 * Namespaced for the same collision reason as `ACL_ACCESS`: `SetMetadata`
 * writes onto the handler, where every decorator in the process shares one
 * key space.
 */
export const REQUIRES_PERMISSION = '@evanion/shop-api:REQUIRES_PERMISSION';
