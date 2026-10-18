import './primitives.css';

/** One visitor in the crowd. `label` is what a screen reader and the readout say about them. */
export interface CrowdMember {
  id: string;
  lit: boolean;
  mark?: 'pinned' | 'moved';
  tone?: 'a' | 'b';
  label: string;
}

/** A grid of visitors, each a focusable dot. Presentation only: the caller decides who is lit. */
export function VisitorCrowd({
  members,
  legend,
  count,
  dimmed,
  onFocusMember,
}: {
  members: CrowdMember[];
  legend: string;
  count: string;
  dimmed?: boolean;
  onFocusMember?: (id: string | null) => void;
}) {
  return (
    <div className="visitor-crowd" data-dimmed={dimmed ? '' : undefined}>
      {legend && <p className="visitor-crowd__legend">{legend}</p>}
      {count && <p className="visitor-crowd__count">{count}</p>}
      <ul className="visitor-crowd__grid">
        {members.map((m) => (
          <li key={m.id}>
            <span
              className="visitor-crowd__dot"
              role="img"
              tabIndex={0}
              aria-label={m.label}
              title={m.label}
              data-lit={m.lit ? '' : undefined}
              data-tone={m.tone}
              data-mark={m.mark}
              onFocus={() => onFocusMember?.(m.id)}
              onBlur={() => onFocusMember?.(null)}
              onPointerEnter={() => onFocusMember?.(m.id)}
              onPointerLeave={() => onFocusMember?.(null)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
