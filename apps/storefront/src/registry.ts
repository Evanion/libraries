import { defineBlocks } from '@evanion/astro-widget';
import Hero from './blocks/Hero.astro';
import Text from './blocks/Text.astro';
import Kort from './blocks/Kort.astro';

/**
 * Maps the `type` of each entry in `data/sidan.json` to the component that
 * renders it.
 *
 * Every type the data may use has to appear here: `Widgets` skips an entry whose
 * type is absent rather than failing the build, so a missing key is a silently
 * blank page section. `sidan.json` deliberately holds one unknown type, which
 * is what `render.test.ts` asserts gets skipped.
 */
export const registry = defineBlocks({ hero: Hero, text: Text, kort: Kort });
