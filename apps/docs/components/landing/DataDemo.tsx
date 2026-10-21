'use client';

import { useId, useRef, useState } from 'react';
import { JsonHighlight } from '../JsonHighlight';
import { Widgets } from './counter';
import { Grip, MoveBar, pathKey, useReorder, type Step } from './reorder';
import { moved, openingNodes, rows, within, type Node } from './tree';

type Items = Parameters<typeof Widgets>[0]['items'];

interface HandleProps {
  label: string;
  glyph: string;
  spent: boolean;
  onMove: () => void;
  onAim: (aiming: boolean) => void;
}

/**
 * One of an item's two move controls.
 *
 * `aria-disabled` and an inert handler rather than `disabled`, because the item
 * a reader has just moved to the end of its list is the one holding focus: a
 * real `disabled` takes the focus ring off the page in the middle of the
 * gesture. Kept focusable, the control announces itself as dimmed and the
 * reader's next press is still theirs to make.
 */
function Handle({ label, glyph, spent, onMove, onAim }: HandleProps) {
  return (
    <button
      type="button"
      className="landing-items__handle"
      aria-label={label}
      aria-disabled={spent || undefined}
      onClick={spent ? undefined : onMove}
      onPointerEnter={() => onAim(true)}
      onPointerLeave={() => onAim(false)}
      onFocus={() => onAim(true)}
      onBlur={() => onAim(false)}
    >
      {glyph}
    </button>
  );
}

/**
 * A page the shop would ship, and the data that composed it.
 *
 * The page comes first and takes the full width, because the claim is that this
 * is a page and not a diagram of one. Under it are the items it was built from,
 * short enough to read without scrolling, with move controls in the gutter
 * of every line that starts an item.
 *
 * Moving is the whole gesture and it is the right one: a layout is an order and
 * a nesting, and neither is a thing anyone retypes. Move `counter` above
 * `week` and two boards and three figures change places as blocks -- that is
 * what a nested item list buys and what a flat list of components cannot
 * describe. Move `tables` past `reprints` and the wide side of the counter
 * swaps, because `meta.span` belongs to the item and travels with it.
 *
 * Nothing is simulated. `Widgets` is the published renderer, the items are the
 * items, and the page is rebuilt from them on every move. The server renders
 * the same opening items, so nothing shifts at hydration.
 */
export default function DataDemo() {
  const [nodes, setNodes] = useState<Node[]>(openingNodes);
  const [notice, setNotice] = useState('');
  const [aimed, setAimed] = useState<number[] | null>(null);
  const labelId = useId();

  const listed = rows(nodes);
  const nameAt = (path: readonly number[]) =>
    listed.find((row) => row.item && pathKey(row.item.path) === pathKey(path))
      ?.item;

  function move(path: number[], delta: Step): boolean {
    const next = moved(nodes, path, delta);
    if (next === nodes) return false;
    setNodes(next);
    setNotice(`${nameAt(path)?.name} moved ${delta < 0 ? 'up' : 'down'}.`);
    return true;
  }

  const source = useRef<HTMLPreElement>(null);
  const reorder = useReorder(source, move);
  const lit = reorder.active ?? aimed;
  const chosen = reorder.selected && nameAt(reorder.selected);

  return (
    <div className="landing-counter">
      <div className="landing-counter__app">
        <div className="landing-counter__chrome">
          <span className="landing-counter__shop">Baize</span>
          <span className="landing-counter__week">Week 38</span>
        </div>
        <Widgets items={nodes as unknown as Items} />
      </div>

      <div className="landing-items">
        {/* The listing is only worth reading if a reader touches it, and the
            controls are quiet by design, so the invitation is said in words
            rather than drawn louder. */}
        <p className="landing-items__label" id={labelId}>
          <span>items</span>
          <span className="landing-items__hint">
            Move one and the page is composed again
          </span>
        </p>
        <pre
          ref={source}
          className="landing-items__source"
          aria-labelledby={labelId}
          {...reorder.sourceProps}
        >
          <code>
            {listed.map((row) => (
              <span
                key={row.key}
                className="landing-items__line"
                data-path={row.path ? pathKey(row.path) : undefined}
                data-aimed={lit && within(lit, row.path) ? '' : undefined}
              >
                <span className="landing-items__gutter">
                  {row.item ? (
                    <>
                      <Grip
                        label={`Move ${row.item.name}`}
                        {...reorder.grip(row.item.path)}
                      />
                      <Handle
                        label={`Move ${row.item.name} up`}
                        glyph="↑"
                        spent={row.item.first}
                        onMove={() => move(row.item!.path, -1)}
                        onAim={(on) => setAimed(on ? row.item!.path : null)}
                      />
                      <Handle
                        label={`Move ${row.item.name} down`}
                        glyph="↓"
                        spent={row.item.last}
                        onMove={() => move(row.item!.path, 1)}
                        onAim={(on) => setAimed(on ? row.item!.path : null)}
                      />
                    </>
                  ) : null}
                </span>
                <span className="landing-items__code">
                  <JsonHighlight text={row.text} />
                </span>
              </span>
            ))}
          </code>
        </pre>
        {chosen ? (
          <MoveBar
            name={chosen.name}
            labels={[`Move ${chosen.name} up`, `Move ${chosen.name} down`]}
            glyphs={['↑', '↓']}
            spent={[chosen.first, chosen.last]}
            onStep={reorder.step}
            onDone={reorder.done}
          />
        ) : null}
      </div>

      <output className="baize-visually-hidden" aria-live="polite">
        {notice}
      </output>
    </div>
  );
}
