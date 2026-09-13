/**
 * One call from a package's README, with its argument opened up.
 *
 * A probe is the tested example made typeable: the code is fixed, one argument
 * is an `<input>`, and the function behind it is the package's own export
 * reached through the specifier a consumer writes. Nothing is transpiled and
 * nothing is evaluated -- the only thing that varies is the string handed to
 * `call`.
 *
 * `region` names the README block the page quotes above the probe.
 * `claims.ts` reads the block's own argument out of it at build time and holds
 * the probe to every value that block claims, so the probe opens on the tested
 * example rather than on a copy of it.
 *
 * This module is in the client bundle of every page carrying a probe, so it
 * imports nothing.
 */
export interface Probe {
  /** What the editable argument is, as the field's label. */
  label: string;
  /** One line saying what changing it shows. */
  hint: string;
  /** The call, run on every keystroke. */
  call: (input: string) => unknown;
  /** The call as the README writes it, character for character. */
  source: (input: string) => string;
  /** The README block the page quotes above the probe. */
  region: { file: string; name: string };
}

/**
 * The longest input a probe passes on.
 *
 * A probe calls the library on every keystroke, so a pasted megabyte is the
 * reader's own tab janking between characters. Every documented argument here
 * is an identifier or a short phrase, so nothing legible is lost.
 */
export const INPUT_LIMIT = 200;

/**
 * A string as a JavaScript literal, quoted the way prettier quotes it.
 *
 * Single quotes, and double quotes for a string that holds more single quotes
 * than double ones. The README is prettier-formatted, so this is what makes a
 * probe's rendered call the same text as the claim it was seeded from.
 */
export function quote(value: string): string {
  const singles = (value.match(/'/g) ?? []).length;
  const doubles = (value.match(/"/g) ?? []).length;
  const mark = singles > doubles ? '"' : "'";

  const escaped = [...value]
    .map((char) => {
      if (char === '\\' || char === mark) return `\\${char}`;
      if (char === '\n') return '\\n';
      if (char === '\r') return '\\r';
      if (char === '\t') return '\\t';
      return char;
    })
    .join('');

  return `${mark}${escaped}${mark}`;
}

/** Whether a key can be written without quotes in an object literal. */
const isBareKey = (key: string) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);

/**
 * A value as the README would write it: one line, prettier's spacing.
 *
 * A printer rather than `JSON.stringify` because a claim is JavaScript source,
 * not JSON -- single quotes, unquoted keys, `undefined`. The probe's output
 * line and the region's claimed value are then the same string, which is the
 * equality `tested-region.test.ts` asserts.
 */
export function format(value: unknown): string {
  if (typeof value === 'string') return quote(value);
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof RegExp) return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : `[${value.map(format).join(', ')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '{}';

  const written = entries.map(
    ([key, held]) => `${isBareKey(key) ? key : quote(key)}: ${format(held)}`,
  );

  return `{ ${written.join(', ')} }`;
}
