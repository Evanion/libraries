import { defineBlocks } from '@evanion/astro-widget';
import Hero from './blocks/Hero.astro';
import Text from './blocks/Text.astro';
import Kort from './blocks/Kort.astro';

export const registry = defineBlocks({ hero: Hero, text: Text, kort: Kort });
