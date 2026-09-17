import type { ReactNode } from 'react';

/**
 * The difficulty ladder, in rarity order, and what each rung means here.
 *
 * Five rather than the three setup tiers, because a tier is a band of the acl
 * section and this is a property of one page: `federation` sits above
 * `advanced`, and a platform guide sits beside a tier rather than inside one.
 * The name is what a screen reader is given; the bar is what everyone else
 * reads, so the name is never rendered.
 */
const RUNGS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as const;

export interface PageSheetProps {
  /** How hard this page is, 1 to 5. Rendered as the bar and nothing else. */
  difficulty?: 1 | 2 | 3 | 4 | 5;
  /** Minutes to read it, and minutes to work through it with an editor open. */
  read: number;
  hands?: number;
  /** Pages a reader wants behind them, as `[label, href]`. */
  requires?: readonly (readonly [string, string])[];
  /** What this page puts within reach, as `[label, href]`. */
  unlocks?: readonly (readonly [string, string])[];
  children?: ReactNode;
}

function Difficulty({ level }: { level: number }) {
  return (
    <div className="page-sheet__stat">
      <span className="page-sheet__stat-label">Difficulty</span>
      <span
        className="page-sheet__bar"
        data-rung={level}
        role="img"
        aria-label={`Difficulty: ${RUNGS[level - 1]}, ${level} of ${RUNGS.length}`}
      >
        {RUNGS.map((rung, index) => (
          <span
            key={rung}
            className={
              index < level
                ? 'page-sheet__pip page-sheet__pip--filled'
                : 'page-sheet__pip'
            }
          />
        ))}
      </span>
    </div>
  );
}

/**
 * What a reader needs to know before the first heading, as the table's own
 * scorecard.
 *
 * Every field is one a reader would want without the framing: which tier this
 * is, how long it takes, what it assumes, and what it opens up. The card is not
 * decoration -- the coherence principle puts a measured cost on material that
 * is there for tone, so nothing here is on the card unless a reader would have
 * asked for it.
 *
 * `requires` is the structured prerequisites box the standard permits. A
 * teaching page may use what an earlier page taught, and this is where it says
 * which pages those are, rather than a line of prose sending the reader away
 * mid-thread. Two entries is the limit worth having: needing four means the
 * order is wrong.
 *
 * Difficulty is the bar alone, coloured by the rung it reaches. It is ordinal,
 * bounded and comparable between pages, which is the shape a bar reads well and
 * a number reads badly -- and the colour carries the same fact a second time,
 * which is what lets the word go. The word stays in the `aria-label`, because a
 * bar with no text is nothing to a screen reader.
 *
 * Time is words. Minutes are a quantity rather than a proportion, a bar over
 * them needs a maximum nothing supplies, and the reading beside it already
 * carries the fact -- which would leave the bar there for tone, at a cost.
 */
export default function PageSheet({
  difficulty,
  read,
  hands,
  requires,
  unlocks,
  children,
}: PageSheetProps) {
  return (
    <aside className="page-sheet" aria-label="About this page">
      {difficulty ? <Difficulty level={difficulty} /> : null}

      <p className="page-sheet__row">
        <span className="page-sheet__stat-label">Time</span>
        <span className="page-sheet__stat-reading">
          {hands
            ? `${read} min read, ${hands} min with an editor`
            : `${read} min read`}
        </span>
      </p>

      {requires?.length ? (
        <p className="page-sheet__row">
          <span className="page-sheet__stat-label">Requires</span>
          <span>
            {requires.map(([label, href], index) => (
              <span key={href}>
                {index > 0 ? ', ' : ''}
                <a href={href}>{label}</a>
              </span>
            ))}
          </span>
        </p>
      ) : null}

      {unlocks?.length ? (
        <p className="page-sheet__row">
          <span className="page-sheet__stat-label">Unlocks</span>
          <span>
            {unlocks.map(([label, href], index) => (
              <span key={href}>
                {index > 0 ? ', ' : ''}
                <a href={href}>{label}</a>
              </span>
            ))}
          </span>
        </p>
      ) : null}

      {children}
    </aside>
  );
}
