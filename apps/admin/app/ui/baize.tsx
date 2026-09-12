/**
 * Every Baize design token and every shared visual primitive, in one file.
 *
 * One file because `apps/storefront`, `apps/rsc-example` and `apps/docs` are to
 * consume the same tokens from a shared UI library, and three apps each
 * defining their own copy of the palette is what that library exists to
 * prevent. Until it exists, this file is the single definition: no palette
 * value, radius or type size is written anywhere else in the app, so the
 * extraction is a file move rather than a hunt.
 *
 * Nothing here uses `useState`, `useEffect`, `createContext` or `useContext`.
 * The shared library has to be importable from a React Server Component in
 * `apps/rsc-example`, and React's `react-server` export condition leaves all
 * four `undefined`. A primitive that needs client state would have to live
 * apart from these.
 *
 * App-specific layout -- the dashboard grid, the orders table's own structure --
 * is not here. The test is whether `apps/storefront` would want it.
 */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* Tokens                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The ground. Table baize: chromatic rather than a tinted near-black, because
 * the subject is a playing surface.
 */
export const ground = {
  ink: '#0C1714',
  felt: '#142521',
  rule: '#2A3F39',
  chalk: '#F2EDE3',
  lichen: '#8FA69E',
  moss: '#5E736C',
} as const;

/**
 * Categorical hues for game mechanisms, the channel players actually identify a
 * game by. Assigned by {@link mechanismHue}, never chosen per call site.
 *
 * Eight, because a ninth categorical hue stops being distinguishable at chip
 * size. All are light enough to clear 4.5:1 against both `ink` and `felt`,
 * which is what lets a mechanism tint a title rather than only a swatch beside
 * it.
 */
export const mechanismHues = [
  '#E8B84B',
  '#6FB7E8',
  '#D98BB9',
  '#8FD96F',
  '#E86F6F',
  '#B79BE8',
  '#5FD9C4',
  '#E8D96F',
] as const;

/**
 * Sequential ramp for complexity weight, 1 (light) to 5 (heavy).
 *
 * Sequential and not categorical because weight is ordinal: 4 is heavier than
 * 3, and a categorical hue would throw that ordering away. Lightness carries
 * the order, hue stays in one family.
 */
export const weightRamp = [
  '#CFE3D3',
  '#A8CCB4',
  '#7FB395',
  '#559A77',
  '#2E7F5B',
] as const;

/**
 * Availability states, as a shop states them. Pills rather than text, because
 * availability is state and reads off a row faster as a shape.
 */
export const availabilityHues = {
  'in stock': '#8FD96F',
  preorder: '#6FB7E8',
  'reprint pending': '#E8B84B',
  'out of print': '#8FA69E',
} as const;

/** One of the four availability states. */
export type Availability = keyof typeof availabilityHues;

/**
 * Radii by role, not one radius everywhere. A chip is nearly square, a button
 * is a touch softer, a panel is a card.
 */
export const radius = { chip: '3px', button: '6px', panel: '12px' } as const;

/** 4px-based spacing scale. App layout uses these, never a bare pixel value. */
export const space = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '24px',
  6: '32px',
  7: '48px',
  8: '64px',
} as const;

/**
 * Type scale on a 1.28 ratio, rounded to whole pixels.
 *
 * `figure` is the stat line's value size and the largest step any number is set
 * at; `display` is for game titles only.
 */
export const typeScale = {
  micro: '11px',
  small: '13px',
  body: '15px',
  lead: '17px',
  figure: '21px',
  heading: '27px',
  display: '35px',
  hero: '45px',
} as const;

/**
 * Two families, clearly distinct. Bricolage Grotesque for game titles, for its
 * width and optical-size axes; Public Sans for everything else, including every
 * number.
 */
export const fonts = {
  display: "'Bricolage Grotesque', 'Trebuchet MS', sans-serif",
  text: "'Public Sans', 'Helvetica Neue', Arial, sans-serif",
} as const;

/** Stylesheet links for the two families. Returned from a route's `links`. */
export const baizeFontLinks = [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous' as const,
  },
  {
    rel: 'stylesheet',
    href:
      'https://fonts.googleapis.com/css2' +
      '?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,300..800' +
      '&family=Public+Sans:wght@300..800' +
      '&display=swap',
  },
];

/**
 * The tokens as CSS custom properties, plus the rules that need a selector a
 * style attribute cannot express: the document ground, focus rings, reduced
 * motion, and button hover.
 *
 * A string rendered into one `<style>` element rather than a `.css` file beside
 * this one, so the whole token system is a single importable module and moving
 * it into the shared library moves one file.
 */
export const baizeTokensCss = `
:root {
  --bz-ink: ${ground.ink};
  --bz-felt: ${ground.felt};
  --bz-rule: ${ground.rule};
  --bz-chalk: ${ground.chalk};
  --bz-lichen: ${ground.lichen};
  --bz-moss: ${ground.moss};

  --bz-radius-chip: ${radius.chip};
  --bz-radius-button: ${radius.button};
  --bz-radius-panel: ${radius.panel};

  --bz-space-1: ${space[1]};
  --bz-space-2: ${space[2]};
  --bz-space-3: ${space[3]};
  --bz-space-4: ${space[4]};
  --bz-space-5: ${space[5]};
  --bz-space-6: ${space[6]};
  --bz-space-7: ${space[7]};
  --bz-space-8: ${space[8]};

  --bz-type-micro: ${typeScale.micro};
  --bz-type-small: ${typeScale.small};
  --bz-type-body: ${typeScale.body};
  --bz-type-lead: ${typeScale.lead};
  --bz-type-figure: ${typeScale.figure};
  --bz-type-heading: ${typeScale.heading};
  --bz-type-display: ${typeScale.display};
  --bz-type-hero: ${typeScale.hero};

  --bz-font-display: ${fonts.display};
  --bz-font-text: ${fonts.text};

  color-scheme: dark;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  background: var(--bz-ink);
  color: var(--bz-chalk);
  font-family: var(--bz-font-text);
  font-size: var(--bz-type-body);
  line-height: 1.5;
  /* Every number in this app is read down a column -- stock levels, order
     totals, weights -- so the figures have to occupy equal width. */
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; }

:focus-visible {
  outline: 2px solid var(--bz-chalk);
  outline-offset: 2px;
}

.bz-invert:hover { background: var(--bz-lichen); }
.bz-quiet:hover { border-color: var(--bz-lichen); }

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
`;

/* -------------------------------------------------------------------------- */
/* Token lookups                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The categorical hue for a mechanism name.
 *
 * Hashed rather than held in a lookup table, because the mechanism vocabulary
 * is open -- the catalogue adds `legacy` or `dexterity` without the palette
 * being touched -- and the assignment still has to be stable across apps and
 * across renders. A table would need an entry per mechanism and a fallback that
 * collapses every unlisted one onto the same hue.
 */
export function mechanismHue(mechanism: string): string {
  let hash = 0;
  for (const char of mechanism.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) % 0xffffff;
  }
  // Non-null: the modulo is within range and the array is a non-empty literal,
  // which noUncheckedIndexedAccess cannot see.
  return mechanismHues[hash % mechanismHues.length] as string;
}

/**
 * Ramp colour for a weight.
 *
 * Weights are fractional (2.4, 3.9) and the ramp has five steps, so the value
 * is bucketed by its ceiling. Anything outside 1–5 is clamped rather than
 * rejected: the catalogue is the authority on the number, and a chart that
 * throws is worse than one that shows the end of the ramp.
 */
export function weightColor(weight: number): string {
  const step = Math.min(5, Math.max(1, Math.ceil(weight)));
  return weightRamp[step - 1] as string;
}

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

/** One figure in a stat line: the number, and what it counts. */
export interface StatFigure {
  label: string;
  value: string;
  /** Drawn in the hue of an availability state, for a figure that is a warning. */
  hue?: string;
}

export interface StatLineProps {
  figures: StatFigure[];
  /**
   * `hero` is the page-leading line; `row` is the same device at panel scale.
   * Both set the same column rhythm, which is what makes figures in a panel
   * line up with the figures above it.
   */
  scale?: 'hero' | 'row';
  /** Accessible name, since a bare run of numbers says nothing on its own. */
  label: string;
}

/**
 * The stat line: figures in tabular numerals on one row, each under its own
 * label, aligned down a column.
 *
 * This is the structural device of the whole design, not a card variant. A
 * player identifies a game by players, time and weight, and a merchant
 * identifies a day by orders, units and shortages -- in both cases by a run of
 * numbers read across, so the numbers lead and the labels sit beneath them.
 *
 * A `<dl>` and not a div grid: each figure is a term and its value, which is
 * what a description list is. `column-reverse` puts the value above its label
 * while leaving `<dt>` before `<dd>` in the markup, where HTML requires it.
 */
export function StatLine({ figures, scale = 'hero', label }: StatLineProps) {
  const valueSize =
    scale === 'hero' ? 'var(--bz-type-hero)' : 'var(--bz-type-figure)';

  return (
    <dl
      aria-label={label}
      style={{
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: '1fr',
        gap: space[5],
        margin: 0,
      }}
    >
      {figures.map((figure) => (
        <div
          key={figure.label}
          style={{ display: 'flex', flexDirection: 'column-reverse' }}
        >
          <dt
            style={{
              color: ground.moss,
              fontSize: scale === 'hero' ? typeScale.small : typeScale.micro,
              letterSpacing: '0.04em',
            }}
          >
            {figure.label}
          </dt>
          <dd
            style={{
              margin: 0,
              color: figure.hue ?? ground.chalk,
              fontSize: valueSize,
              fontWeight: 300,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            {figure.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A panel: felt ground, hairline, card radius. The only container primitive. */
export function Panel({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        background: ground.felt,
        border: `1px solid ${ground.rule}`,
        borderRadius: radius.panel,
        padding: space[5],
        ...style,
      }}
    >
      {children}
    </section>
  );
}

/**
 * A panel's own heading. Sentence case, no eyebrow above it, no rule under it --
 * the panel border already encloses the content.
 */
export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        margin: `0 0 ${space[4]}`,
        fontSize: typeScale.lead,
        fontWeight: 600,
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </h2>
  );
}

/** A game title, set in the display face and tinted by its lead mechanism. */
export function GameTitle({
  title,
  mechanism,
  size = 'display',
}: {
  title: string;
  mechanism?: string;
  size?: 'display' | 'lead';
}) {
  return (
    <span
      style={{
        fontFamily: fonts.display,
        fontSize: size === 'display' ? typeScale.display : typeScale.lead,
        fontWeight: 600,
        fontStretch: '88%',
        letterSpacing: '-0.02em',
        color: mechanism ? mechanismHue(mechanism) : ground.chalk,
      }}
    >
      {title}
    </span>
  );
}

/** A mechanism chip: the title's hue at chip weight. */
export function MechanismTag({ mechanism }: { mechanism: string }) {
  const hue = mechanismHue(mechanism);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: `1px ${space[2]}`,
        borderRadius: radius.chip,
        border: `1px solid ${hue}59`,
        color: hue,
        fontSize: typeScale.micro,
        letterSpacing: '0.02em',
      }}
    >
      {mechanism}
    </span>
  );
}

/**
 * An availability state, as a pill.
 *
 * The dot carries the state for anyone who cannot separate the hues, together
 * with the word itself -- the pill is never the only channel.
 */
export function AvailabilityPill({ state }: { state: Availability }) {
  const hue = availabilityHues[state];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space[2],
        padding: `1px ${space[2]}`,
        borderRadius: radius.chip,
        background: `${hue}1F`,
        color: hue,
        fontSize: typeScale.micro,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: hue,
        }}
      />
      {state}
    </span>
  );
}

/**
 * Weight on its sequential ramp: five segments, filled to the value, with the
 * number beside them in tabular figures.
 *
 * Segments and not a continuous bar, because the published scale is 1–5 and a
 * continuous bar invites reading a precision the scale does not have.
 */
export function WeightMeter({ weight }: { weight: number }) {
  const filled = Math.min(5, Math.max(1, Math.ceil(weight)));
  const hue = weightColor(weight);

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: space[2] }}
    >
      <span
        role="img"
        aria-label={`weight ${weight} of 5`}
        style={{ display: 'inline-flex', gap: '2px' }}
      >
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            style={{
              width: '4px',
              height: '14px',
              borderRadius: '1px',
              background: step <= filled ? hue : ground.rule,
            }}
          />
        ))}
      </span>
      <span style={{ color: ground.lichen, fontSize: typeScale.small }}>
        {weight.toFixed(1)}
      </span>
    </span>
  );
}

/**
 * A button or link styled as one.
 *
 * `primary` inverts ink and parchment rather than using a brand fill: Baize has
 * no house colour, because the catalogue supplies every saturated pixel.
 */
export function Action({
  children,
  variant = 'quiet',
  ...rest
}: {
  children: ReactNode;
  variant?: 'primary' | 'quiet';
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const primary = variant === 'primary';
  return (
    <button
      {...rest}
      className={primary ? 'bz-invert' : 'bz-quiet'}
      style={{
        padding: `${space[2]} ${space[4]}`,
        borderRadius: radius.button,
        border: `1px solid ${primary ? ground.chalk : ground.rule}`,
        background: primary ? ground.chalk : 'transparent',
        color: primary ? ground.ink : ground.chalk,
        font: 'inherit',
        fontSize: typeScale.small,
        fontWeight: primary ? 600 : 400,
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

/** A hairline. The only divider; there is no second weight of rule. */
export function Hairline() {
  return (
    <hr
      style={{ border: 0, borderTop: `1px solid ${ground.rule}`, margin: 0 }}
    />
  );
}

/** Secondary prose: a caption, a note, a count beside a heading. */
export function Quiet({
  children,
  tone = 'lichen',
}: {
  children: ReactNode;
  tone?: 'lichen' | 'moss';
}) {
  return (
    <span
      style={{
        color: tone === 'lichen' ? ground.lichen : ground.moss,
        fontSize: typeScale.small,
      }}
    >
      {children}
    </span>
  );
}

/**
 * A correlation id, or any other opaque identifier.
 *
 * Not set in a monospace face: a monospace small-label treatment is the generic
 * tell, and `font-variant-numeric: tabular-nums` on Public Sans already gives
 * an id equal-width digits, which is the only property that matters for
 * comparing two of them down a column.
 */
export function Identifier({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        color: ground.lichen,
        fontSize: typeScale.small,
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </span>
  );
}
