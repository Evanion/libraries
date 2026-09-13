import { availability } from './availability.js';
import { categorical, categoricalOnLight } from './categorical.js';
import { slug as kebab } from './class-names.js';
import { boxArt } from './box-art.js';
import { elevation, measure, motion, radius, space } from './geometry.js';
import { ground } from './ground.js';
import { mechanism } from './mechanism.js';
import { leading, text, tracking, type } from './type.js';
import { complexity } from './complexity.js';

/**
 * The TypeScript token modules rendered as the custom-property block the
 * stylesheet consumes.
 *
 * This function is the only producer of `src/tokens.generated.css`.
 * `tools/generate-tokens.ts` writes the file and
 * `tokens-generated.test.ts` renders it again and compares byte for byte, so the
 * committed artefact and the token modules cannot drift in either direction.
 */

/**
 * A hex value is lowercased; everything else passes through.
 *
 * Case carries no meaning in CSS and a stylesheet is read more often than a
 * token module, so the generated half picks one spelling. The token modules keep
 * the uppercase hexes the design document quotes.
 */
function cssValue(value: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value.toLowerCase() : value;
}

function group(
  prefix: string,
  values: Readonly<Record<string, string>>,
): [string, string][] {
  return Object.entries(values).map(([name, value]) => [
    `--baize-${prefix}${kebab(name)}`,
    cssValue(value),
  ]);
}

/**
 * Every custom property, in the order the generated stylesheet declares them.
 *
 * The ground has no infix: `--baize-felt` is the surface itself and belongs to no
 * subsystem. The two informational colour systems are namespaced, because the
 * docs app consumes the foundation and references neither.
 */
export const customProperties: readonly (readonly [string, string])[] = [
  ...group('', ground),
  ...group('font-', type),
  ...group('text-', text),
  ...group('tracking-', tracking),
  ...group('leading-', leading),
  ...group('radius-', radius),
  ...group('space-', space),
  [`--baize-measure`, measure],
  ...group('elevation-', elevation),
  ...group('motion-', motion),
  ...group('categorical-', categorical),
  ...group('categorical-on-light-', categoricalOnLight),
  ...group('mechanism-', mechanism),
  ...group('availability-', availability),
  ...group('complexity-', complexity),
  ...Object.entries(boxArt).flatMap(([palette, stops]) =>
    Object.entries(stops).map(
      ([stop, value]) =>
        [`--baize-box-art-${kebab(palette)}-${stop}`, cssValue(value)] as const,
    ),
  ),
];

/** The contents of `src/tokens.generated.css`, trailing newline included. */
export function renderTokensCss(): string {
  const declarations = customProperties
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');

  return [
    '/* Generated from src/tokens/ by tools/generate-tokens.ts. Do not edit.',
    ' *',
    ' * Run `npx nx run baize-ui:generate-tokens` after changing a token module.',
    ' * tokens-generated.test.ts fails until this file matches.',
    ' */',
    ':root {',
    declarations,
    '}',
    '',
  ].join('\n');
}
