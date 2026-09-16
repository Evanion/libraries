/**
 * The Baize design system's components. The `@evanion/baize-ui` entry.
 *
 * Every component here takes props and returns elements. No hook, no state, no
 * context, no effect, no `await`, and no CSS import: an app imports
 * `@evanion/baize-ui/styles.css` once in its root and these render class names
 * only.
 *
 * A primitive that needs client state -- a disclosure, a tab set, a quantity
 * stepper, a theme toggle -- belongs to the app that needs it, written in the
 * app's own `'use client'` file and styled with these classes. There is no
 * `./client` entry and there is not going to be one.
 */
export { Button, ButtonLink } from './components/controls.js';
export type {
  ButtonLinkProps,
  ButtonProps,
  ButtonVariant,
} from './components/controls.js';
export {
  AvailabilityPill,
  Chip,
  MechanismTag,
  TagRow,
} from './components/tags.js';
export type {
  AvailabilityPillProps,
  ChipProps,
  MechanismTagProps,
  TagRowProps,
} from './components/tags.js';
export { Card, Panel, SectionHeader } from './components/surfaces.js';
export type {
  CardProps,
  PanelProps,
  SectionHeaderProps,
} from './components/surfaces.js';
export { Figure, Text, Title } from './components/typography.js';
export type {
  FigureProps,
  TextProps,
  TextTone,
  TitleProps,
  TitleSize,
} from './components/typography.js';
export { Stat, StatLine, ComplexityRamp } from './components/stat-line.js';
export type {
  StatLineProps,
  StatProps,
  ComplexityRampProps,
} from './components/stat-line.js';
export { CardGrid, CardGridCell } from './components/layout.js';
export type { CardGridCellProps, CardGridProps } from './components/layout.js';
export { BoxArtPlaceholder } from './components/box-art.js';
export type { BoxArtPlaceholderProps } from './components/box-art.js';

/**
 * The token types, re-exported because they are the props' vocabulary: a consumer
 * typing a `mechanism` prop needs `Mechanism`, and importing it from
 * `@evanion/baize-ui/tokens` to pass it to a component from
 * `@evanion/baize-ui` reads as two packages. The values stay on the `./tokens`
 * entry, which imports no React.
 */
export type {
  Availability,
  BoxArtPalette,
  ComplexityStop,
  Mechanism,
  Platform,
} from './tokens/index.js';
