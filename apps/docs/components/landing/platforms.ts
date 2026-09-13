import type { Platform } from '@evanion/baize-ui/tokens';

/**
 * The stack names `app/navigation.ts` uses, as the platform tokens the chip
 * paints them in.
 *
 * `framework` on a navigation entry is the words a reader sees -- `React`,
 * `NestJS`, `universal` -- joined with ` + ` where a package has a
 * framework-free core and a framework adapter. The chip needs the token, so
 * this is the one place the words meet the scale. A word with no entry here
 * is a build failure rather than a chip in no colour: `platforms.test.ts`
 * resolves every entry in the navigation.
 */
const platforms: Readonly<Record<string, Platform>> = {
  React: 'react',
  Astro: 'astro',
  NestJS: 'nestjs',
  universal: 'universal',
};

/** The platforms a `framework` string names, in the order it names them. */
export function platformsOf(
  framework: string,
): { label: string; platform: Platform }[] {
  return framework.split(' + ').map((label) => {
    const platform = platforms[label];
    if (!platform) {
      throw new Error(
        `"${label}" is not a platform the chip can paint; add it to ` +
          `components/landing/platforms.ts or use one of ` +
          `${Object.keys(platforms).join(', ')}.`,
      );
    }
    return { label, platform };
  });
}
