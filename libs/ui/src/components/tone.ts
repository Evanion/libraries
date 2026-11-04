/**
 * A data tone. The core styles `neutral`, `positive`, `negative` and
 * `warning`; a theme adds any other name by defining `--tone-<name>` and
 * `--tone-<name>-surface` and mapping `[data-tone='<name>']` onto `--tone` and
 * `--tone-surface`. See the README's Theming section.
 */
export type Tone =
  | 'neutral'
  | 'positive'
  | 'negative'
  | 'warning'
  // Keeps the four names in autocomplete while admitting a theme's own.
  | (string & {});

/** Joins class names, dropping the empty ones. */
export const classNames = (...names: (string | false | null | undefined)[]) =>
  names.filter(Boolean).join(' ');
