import { Luhn } from '@evanion/luhn';

import { quote, type Probe } from './probe';

/**
 * `Luhn.generate` over a phrase the reader types.
 *
 * The check character changing as the phrase is retyped is the thing four
 * paragraphs of README explain: it depends on every code point before it, on
 * their order, and on nothing else. Filtering and case folding show in the same
 * output -- `phrase` comes back lowercased and stripped, `filtered` counts what
 * went -- so `FoO-ö` and `foo` landing on the same character is one keystroke
 * away rather than a claim to be taken on trust.
 */
export const generate: Probe = {
  label: 'phrase',
  hint: 'Retype the phrase, or hyphenate it, and watch the check character.',
  call: (phrase) => Luhn.generate(phrase),
  source: (phrase) => `Luhn.generate(${quote(phrase)})`,
  region: { file: 'libs/luhn/README.md', name: 'generate' },
};

export const probes = { generate };
