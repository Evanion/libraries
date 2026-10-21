'use client';

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { flushSync } from 'react-dom';

/**
 * Touch controls for the listings' move gesture.
 *
 * A fine pointer gets the two arrows in each line's gutter. A finger gets one
 * grip per line instead, because two 44px targets side by side leave the code
 * a third of a phone's width: the reader drags the grip, or taps it to select
 * the item and moves it with the bar under the listing. The bar is the
 * single-pointer way to make every move a drag makes. CSS picks which set
 * shows; this module only holds the touch half.
 */

export type Step = -1 | 1;

interface Block {
  top: number;
  bottom: number;
}

/** Pointer travel under which a press on the grip is a tap, not a drag. */
const SLOP = 6;

/**
 * The step a drag at `y` asks for: up once it passes the middle of the block
 * above, down once it passes the middle of the block below, else none. After a
 * swap the block it passed sits on the other side with its middle behind the
 * pointer, so the item does not swap back until the pointer returns.
 */
export function dragStep(y: number, above?: Block, below?: Block): Step | 0 {
  if (above && y < (above.top + above.bottom) / 2) return -1;
  if (below && y > (below.top + below.bottom) / 2) return 1;
  return 0;
}

/** The value a listing line carries in `data-path`. */
export function pathKey(path: readonly number[]): string {
  return path.join('.');
}

function sibling(path: readonly number[], step: Step): number[] {
  return [...path.slice(0, -1), (path.at(-1) ?? 0) + step];
}

/** The rows an item's block covers, opening and closing lines and all. */
function blockOf(
  source: HTMLElement,
  path: readonly number[],
): Block | undefined {
  const key = pathKey(path);
  let block: Block | undefined;
  for (const line of source.querySelectorAll<HTMLElement>('[data-path]')) {
    const at = line.dataset.path ?? '';
    if (at !== key && !at.startsWith(`${key}.`)) continue;
    const rect = line.getBoundingClientRect();
    block = block
      ? {
          top: Math.min(block.top, rect.top),
          bottom: Math.max(block.bottom, rect.bottom),
        }
      : { top: rect.top, bottom: rect.bottom };
  }
  return block;
}

interface Drag {
  pointer: number;
  startY: number;
  path: number[];
  live: boolean;
}

/**
 * Selection and drag state for one listing.
 *
 * `source` is the listing's `<pre>`, which also takes `sourceProps`; every
 * line that belongs to an item carries `data-path` with that item's
 * `pathKey`. `move` reorders the demo's data and returns whether anything
 * moved.
 */
export function useReorder(
  source: RefObject<HTMLElement | null>,
  move: (path: number[], step: Step) => boolean,
) {
  const drag = useRef<Drag | null>(null);
  const [selected, setSelected] = useState<number[] | null>(null);
  const [dragging, setDragging] = useState<number[] | null>(null);

  function onPointerMove(event: ReactPointerEvent) {
    const current = drag.current;
    const listing = source.current;
    if (!current || !listing || event.pointerId !== current.pointer) return;

    if (!current.live) {
      if (Math.abs(event.clientY - current.startY) < SLOP) return;
      current.live = true;
      // Held by the listing, which stays put while the grip's line moves.
      listing.setPointerCapture?.(event.pointerId);
      setSelected(null);
      setDragging(current.path);
    }

    const step = dragStep(
      event.clientY,
      blockOf(listing, sibling(current.path, -1)),
      blockOf(listing, sibling(current.path, 1)),
    );
    if (step === 0) return;

    // Laid out before the next pointer event measures the blocks again.
    flushSync(() => {
      if (!move(current.path, step)) return;
      current.path = sibling(current.path, step);
      setDragging(current.path);
    });
  }

  function onPointerEnd(event: ReactPointerEvent) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    setDragging(null);
  }

  return {
    sourceProps: {
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
    selected,
    /** The item a reader is moving: the one dragged, else the one selected. */
    active: dragging ?? selected,
    grip(path: number[]) {
      const key = pathKey(path);
      return {
        selected: selected !== null && pathKey(selected) === key,
        onPointerDown(event: ReactPointerEvent) {
          if (event.button !== 0) return;
          drag.current = {
            pointer: event.pointerId,
            startY: event.clientY,
            path,
            live: false,
          };
        },
        // A tap. A drag ends with the pointer held by the listing, so its
        // click lands there and never here.
        onSelect() {
          setSelected((current) =>
            current && pathKey(current) === key ? null : path,
          );
        },
      };
    },
    step(step: Step) {
      if (!selected || !move(selected, step)) return;
      setSelected(sibling(selected, step));
    },
    done() {
      setSelected(null);
    },
  };
}

interface GripProps {
  label: string;
  selected: boolean;
  onPointerDown: (event: ReactPointerEvent) => void;
  onSelect: () => void;
}

/** One line's touch control: drag it, or tap it to select the item. */
export function Grip({ label, selected, onPointerDown, onSelect }: GripProps) {
  return (
    <button
      type="button"
      className="landing-items__grip"
      aria-label={label}
      aria-pressed={selected}
      onPointerDown={onPointerDown}
      onClick={onSelect}
    >
      <svg viewBox="0 0 8 14" width="8" height="14" aria-hidden="true">
        {[1, 7].map((x) =>
          [1, 7, 13].map((y) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="1.2" />
          )),
        )}
      </svg>
    </button>
  );
}

interface MoveBarProps {
  name: string;
  labels: [string, string];
  glyphs: [string, string];
  spent: [boolean, boolean];
  onStep: (step: Step) => void;
  onDone: () => void;
}

/**
 * The selected item's move controls, under the listing.
 *
 * `aria-disabled` with an inert handler at either end, for the reason
 * `DataDemo` gives its arrows: the button a reader just pressed holds focus.
 */
export function MoveBar({
  name,
  labels,
  glyphs,
  spent,
  onStep,
  onDone,
}: MoveBarProps) {
  const steps: Step[] = [-1, 1];
  return (
    <div
      className="landing-items__movebar"
      role="group"
      aria-label={`Move ${name}`}
    >
      <span className="landing-items__moving">{name}</span>
      {steps.map((step, at) => (
        <button
          key={step}
          type="button"
          className="landing-items__step"
          aria-label={labels[at]}
          aria-disabled={spent[at] || undefined}
          onClick={spent[at] ? undefined : () => onStep(step)}
        >
          {glyphs[at]}
        </button>
      ))}
      <button type="button" className="landing-items__step" onClick={onDone}>
        Done
      </button>
    </div>
  );
}
