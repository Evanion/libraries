import { defineWidgets } from '@evanion/astro-widget';
import NoteCard from './NoteCard.astro';

/**
 * The registry for the nested region inside a group block.
 *
 * Separate from the content registry, and deliberately without `group` in it, so
 * a group cannot contain another group. Keeping it in its own module is also what
 * avoids an import cycle: the content registry holds `ContentGroup`, and
 * `ContentGroup` needs a registry for its children.
 */
export const groupRegistry = defineWidgets({ card: NoteCard });

/** Fields `validateItems` must find on each nested type. */
export const groupRequired = { card: ['heading', 'body'] };
