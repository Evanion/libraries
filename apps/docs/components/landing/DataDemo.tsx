'use client';

import { useId, useState } from 'react';
import { Widgets } from './desk';
import { moved, openingNodes, rows, within, type Node } from './tree';

type Items = Parameters<typeof Widgets>[0]['items'];

/**
 * The text as JSON tokens, each in the colour its kind takes.
 *
 * A tokenizer for JSON and nothing else: strings, numbers, the three literals,
 * punctuation. A string followed by a colon is a key. The site's code blocks
 * are highlighted by Shiki at build time; these lines are reassembled in the
 * browser every time a reader moves an item, so they are highlighted here, in
 * the design's own colours -- keys in the reading colour, strings in the
 * package hue, the rest stepped back.
 */
function Highlight({ text }: { text: string }) {
  const tokens = text.split(
    /("(?:[^"\\]|\\.)*"\s*:?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b)/,
  );

  return tokens.map((token, index) => {
    if (index % 2 === 0) return token;
    const kind = token.startsWith('"')
      ? token.trimEnd().endsWith(':')
        ? 'key'
        : 'string'
      : 'literal';
    return (
      <span key={index} className={`landing-items__token--${kind}`}>
        {token}
      </span>
    );
  });
}

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
 * A page a workshop would ship, and the data that composed it.
 *
 * The page comes first and takes the full width, because the claim is that this
 * is a page and not a diagram of one. Under it are the items it was built from,
 * short enough to read without scrolling, with a pair of controls in the gutter
 * of every line that starts an item.
 *
 * Moving is the whole gesture and it is the right one: a layout is an order and
 * a nesting, and neither is a thing anyone retypes. Move `desk` above `week`
 * and two boards and three figures change places as blocks -- that is what a
 * nested item list buys and what a flat list of components cannot describe.
 * Move `stands` past `parts` and the wide side of the desk swaps, because
 * `meta.span` belongs to the item and travels with it.
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

  function move(path: number[], delta: number, name: string) {
    setNodes(moved(nodes, path, delta));
    setNotice(`${name} moved ${delta < 0 ? 'up' : 'down'}.`);
  }

  return (
    <div className="landing-desk">
      <div className="landing-desk__app">
        <div className="landing-desk__chrome">
          <span className="landing-desk__shop">Sundby Cykel</span>
          <span className="landing-desk__week">Week 38</span>
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
        <pre className="landing-items__source" aria-labelledby={labelId}>
          <code>
            {rows(nodes).map((row) => (
              <span
                key={row.key}
                className="landing-items__line"
                data-aimed={aimed && within(aimed, row.path) ? '' : undefined}
              >
                <span className="landing-items__gutter">
                  {row.item ? (
                    <>
                      <Handle
                        label={`Move ${row.item.name} up`}
                        glyph="↑"
                        spent={row.item.first}
                        onMove={() => move(row.item!.path, -1, row.item!.name)}
                        onAim={(on) => setAimed(on ? row.item!.path : null)}
                      />
                      <Handle
                        label={`Move ${row.item.name} down`}
                        glyph="↓"
                        spent={row.item.last}
                        onMove={() => move(row.item!.path, 1, row.item!.name)}
                        onAim={(on) => setAimed(on ? row.item!.path : null)}
                      />
                    </>
                  ) : null}
                </span>
                <span className="landing-items__code">
                  <Highlight text={row.text} />
                </span>
              </span>
            ))}
          </code>
        </pre>
      </div>

      <output className="landing-sr-only" aria-live="polite">
        {notice}
      </output>
    </div>
  );
}
