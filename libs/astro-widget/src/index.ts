/**
 * `@evanion/astro-widget` -- the Astro renderer for a widget region.
 *
 * This entry is the item model, re-exported from `@evanion/widget` so that a
 * consumer who never names the core never installs it by hand. The same names
 * reach an `@evanion/react-widget` consumer from its own entry point, which is
 * what makes an item array authored for one runtime render through the other.
 *
 * `Widgets.astro` is not among them: an `.astro` module has to be compiled by
 * Astro's own vite plugin, which runs in the consumer's project and not in this
 * package's build, so package.json publishes it as source under
 * `@evanion/astro-widget/components/Widgets.astro`.
 *
 * Nothing framework-specific is exported. An Astro component's default export
 * is an `AstroComponentFactory` carrying no prop types, so there is no Astro
 * counterpart to the React adapter's compile-time prop inference, and
 * `validateItems` covers that ground at build time instead.
 */
export {
  defineWidgets,
  validateItems,
  ERROR_MESSAGES,
  VALIDATION_MESSAGES,
} from '@evanion/widget';
export type {
  AnyWidgetItem,
  KnownWidgetTypes,
  WidgetMeta,
  WidgetProblem,
  WidgetRegistry,
} from '@evanion/widget';
