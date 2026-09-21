/**
 * The contrast floor every export-kind hue is held to, against both grounds.
 *
 * A kind hue carries an export's name in a heading at `text.md`, 18px in a
 * regular weight, which is under the 24px the 3:1 large-text allowance needs.
 * So the floor is WCAG AA for normal text. `tokens.test.ts` computes the ratio
 * for every hue in both scales and fails naming the one that drops under it.
 */
export const EXPORT_KIND_CONTRAST_FLOOR = 4.5;

/**
 * The two grounds a kind hue is laid on, the same pair the categorical scale is
 * measured against and for the same reason: the library's own surface is felt,
 * and the docs site rebinds felt to paper for its light theme.
 */
export const EXPORT_KIND_DARK_GROUND = '#142521';
export const EXPORT_KIND_LIGHT_GROUND = '#E5E2D8';

/**
 * Six hues for what an export is, on a dark ground.
 *
 * A reference page lists an API by name and a reader scans it for one export.
 * The kind is the first thing that narrows the scan -- whether a name can be
 * called, thrown, or only written in a type position -- so the name carries it
 * as colour while the chip beside it says the same word in text. Colour is the
 * second channel on a fact the text already carries.
 *
 * Neither existing scale could take this. `categorical` is spent one hue per
 * package, with `docs-navigation.test.ts` failing on a repeat, and `mechanism`
 * is the shop's board-game vocabulary, which `categorical.ts` keeps apart from
 * everything else so that nothing has to describe a URN library as engine
 * building.
 *
 * Warm for what exists at runtime, cool for what the compiler erases. That is
 * the split deciding whether a name can be imported without `import type`, and
 * it falls out of the six members rather than being imposed on them.
 *
 * An error is its own kind and not a class, on 38 error classes against 4 plain
 * ones across the repository and on every documented package carrying an
 * `errors.mdx`. `interface` and `typeAlias` stay apart because the reference
 * renders them differently: an interface has properties and shows its fields,
 * an alias usually resolves to a union and shows its members.
 *
 * Every value is `L = 0.80` in OKLCH, which is `categorical`'s own mean across
 * its nine, with chroma capped at 0.13, the top of `categorical`'s range. On
 * felt that puts the scale between `lichen` at 6.17:1 and `chalk` at 13.67:1,
 * so an entry reads name, then summary, in that order. An earlier pass at
 * `L = 0.73` landed at `lichen`'s own brightness and the name read at the
 * weight of its subtitle.
 */
export const exportKind = {
  error: '#FF9BBA',
  class: '#F49CDB',
  function: '#FFA56F',
  constant: '#A7CD6E',
  interface: '#2DD4E9',
  typeAlias: '#C1B0FF',
} as const;

/**
 * The same six hues on a light ground.
 *
 * Laid on paper the dark values reach between 1.38:1 and 1.52:1, so a light
 * theme needs its own. Each is its dark counterpart's hue angle and chroma in
 * OKLCH with the lightness walked down until the ratio against
 * `EXPORT_KIND_LIGHT_GROUND` clears the floor, which is `categoricalOnLight`'s
 * derivation and keeps a kind recognisable across both themes.
 *
 * Both halves ship together because the alternative has already happened once:
 * the availability scale was measured against felt alone, and a consumer that
 * rebinds felt to paper rendered a pill whose label nothing could read.
 */
export const exportKindOnLight = {
  error: '#A14666',
  class: '#984884',
  function: '#A04E10',
  constant: '#4E6E00',
  interface: '#016F7B',
  typeAlias: '#6C59A1',
} as const;

/**
 * The minimum separation, in OKLCH degrees, between any two hues a reader can
 * meet on one page: kind against kind, and kind against package, on both
 * grounds.
 *
 * Fifteen hues share the wheel at one lightness -- nine packages and six kinds
 * -- so 360/15 is 24 before the packages' own uneven spacing is counted, and
 * the reachable maximum for six more hues beside those nine is 20.05. The
 * binding pair is `function` against `amber`, which the two halves of the
 * package scale disagree about: `categorical.amber` sits at 80.0 degrees and
 * `categoricalOnLight.amber` at 70.8, so the gap `function` has to fit between
 * `coral` and `amber` is 48.9 wide on felt and 39.9 wide on paper. Centred in
 * the narrower one, `function` clears 19.8.
 *
 * The scale is placed at that measured maximum rather than at a round number
 * nothing could hit. `tokens.test.ts` holds every pair to this on both grounds.
 */
export const EXPORT_KIND_HUE_SEPARATION_FLOOR = 19;

/** What an export is, as the reference page classifies it. */
export type ExportKind = keyof typeof exportKind;
