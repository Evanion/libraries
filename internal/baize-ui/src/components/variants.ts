/**
 * The variant machinery the components compose their class names with.
 *
 * `cva` is a pure string-composing function over `clsx`: it imports no React, it
 * holds nothing between calls, and it is the same call in a server render as in a
 * client one, so it sits inside the statelessness rule the way a template literal
 * does.
 *
 * Each component declares its modifier classes as literals rather than resolving
 * them through `modifier()`, which is the one thing this costs: the
 * `--name-value` convention is spelled out in the recipe as well as in
 * `tokens/class-names.ts`, where `apps/storefront` still reads it. The classes
 * become greppable from the stylesheet in exchange, and
 * `apps/storefront/src/components/baize-contract.astro.test.ts` compares the two
 * implementations class by class, so a recipe that drifted from the convention
 * fails there.
 *
 * The lookup classes stay functions. `hueClass`, `stateClass`, `paletteClass` and
 * `ladderClass` bind a token to whatever element carries it -- a chip, a title, a
 * tag -- so they belong to no single component's variant map, and a recipe would
 * have to repeat every member of the enum to say what the slug already says.
 * They reach a recipe as its `class` argument, which `cva` appends last.
 */
import type { VariantProps } from 'class-variance-authority';

/**
 * One variant of a recipe, as a prop declares it.
 *
 * `VariantProps` widens every variant with `null`, because `null` is how a caller
 * switches one off at a call site. A prop that is already optional has no use for
 * it, and `<Button variant={null}>` is not something this library accepts, so the
 * union is narrowed back.
 */
export type Variant<
  Recipe extends (...args: never[]) => string,
  Name extends keyof VariantProps<Recipe>,
> = NonNullable<VariantProps<Recipe>[Name]>;
