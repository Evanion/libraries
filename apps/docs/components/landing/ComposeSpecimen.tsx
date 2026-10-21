'use client';

import { useRef, useState, type PropsWithChildren } from 'react';
import { ComposeProvider } from '@evanion/compose';
import { Grip, MoveBar, useReorder, type Step } from './reorder';

/**
 * One layer of the shop's provider stack, as a labelled box.
 *
 * The box is what the provider would wrap in a real app, drawn so the nesting
 * is visible. Each one is a plain component taking `children`, which is the
 * only thing `ComposeProvider` asks of a provider.
 */
function layer(name: string, note: string) {
  function Layer({ children }: PropsWithChildren) {
    return (
      <div className="landing-compose__layer">
        <span className="landing-compose__name">
          {name}
          <span className="landing-compose__note">{note}</span>
        </span>
        {children}
      </div>
    );
  }

  Layer.displayName = name;

  return { name, note, Layer };
}

const LAYERS = [
  layer('CartProvider', 'what is in the basket'),
  layer('ThemeProvider', 'dark or light'),
  layer('CurrencyProvider', 'kr, £, $'),
] as const;

interface HandleProps {
  label: string;
  glyph: string;
  spent: boolean;
  onMove: () => void;
}

/**
 * One of an entry's two move controls.
 *
 * `aria-disabled` with an inert handler rather than `disabled`, for the reason
 * `DataDemo` gives: the entry a reader has just moved to the end of the array
 * is the one holding focus, and a real `disabled` takes the focus ring off the
 * page mid-gesture.
 */
function Handle({ label, glyph, spent, onMove }: HandleProps) {
  return (
    <button
      type="button"
      className="landing-items__handle"
      aria-label={label}
      aria-disabled={spent || undefined}
      onClick={spent ? undefined : onMove}
    >
      {glyph}
    </button>
  );
}

/**
 * The provider tree `ComposeProvider` builds, over the array that built it.
 *
 * The tree is first and the array is under it, because the claim the page
 * makes is about the tree: the first entry of the array is the outermost box,
 * and moving an entry moves its box. A reader who presses a control watches
 * the boxes reorder, which is the sentence above the figure happening.
 *
 * The editable thing is an ordering, so the gesture is a move control rather
 * than an editor. Three providers is a closed set with nothing to parse, so
 * there is no error path and nothing a reader can crash -- the same reasoning
 * that put clickable literals in `AccessDemo` instead of a JSON field.
 *
 * `ComposeProvider` here is the published component, not a mock. The boxes on
 * screen are the elements it returned, so a release that stopped nesting them
 * in array order would change what this renders.
 */
export default function ComposeSpecimen() {
  const [order, setOrder] = useState<readonly number[]>([0, 1, 2]);

  function move(at: number, by: number): boolean {
    if (at + by < 0 || at + by >= order.length) return false;
    setOrder((current) => {
      const next = [...current];
      const [entry] = next.splice(at, 1);
      next.splice(at + by, 0, entry as number);
      return next;
    });
    return true;
  }

  const source = useRef<HTMLPreElement>(null);
  const reorder = useReorder(source, ([at], step: Step) => move(at ?? 0, step));
  const stack = order
    .map((index) => LAYERS[index])
    .filter((entry) => entry !== undefined);
  const chosen = reorder.selected?.[0];
  const chosenName = chosen === undefined ? undefined : stack[chosen]?.name;

  return (
    <div className="landing-specimen landing-compose">
      <div className="landing-compose__tree">
        <ComposeProvider providers={stack.map((entry) => entry.Layer)}>
          <p className="landing-compose__page">Brass: Birmingham</p>
        </ComposeProvider>
      </div>

      <div className="landing-items">
        <p className="landing-items__label">
          <span>providers</span>
          <span className="landing-items__hint">
            Move an entry and the box it draws moves with it.
          </span>
        </p>

        <pre
          ref={source}
          className="landing-items__source"
          {...reorder.sourceProps}
        >
          <code>
            <span className="landing-compose__line">{'providers={['}</span>
            {stack.map((entry, at) => (
              <span
                key={entry.name}
                className="landing-items__line landing-compose__line"
                data-path={at}
                data-aimed={reorder.active?.[0] === at ? '' : undefined}
              >
                <span className="landing-items__gutter">
                  <Grip label={`Move ${entry.name}`} {...reorder.grip([at])} />
                  <Handle
                    label={`Move ${entry.name} outward`}
                    glyph="▲"
                    spent={at === 0}
                    onMove={() => move(at, -1)}
                  />
                  <Handle
                    label={`Move ${entry.name} inward`}
                    glyph="▼"
                    spent={at === stack.length - 1}
                    onMove={() => move(at, 1)}
                  />
                </span>
                <span className="landing-items__code">
                  {'  '}
                  <span className="landing-items__token--key">
                    {entry.name}
                  </span>
                  ,
                </span>
              </span>
            ))}
            <span className="landing-compose__line">{']}'}</span>
          </code>
        </pre>
        {chosen !== undefined && chosenName ? (
          <MoveBar
            name={chosenName}
            labels={[`Move ${chosenName} outward`, `Move ${chosenName} inward`]}
            glyphs={['▲', '▼']}
            spent={[chosen === 0, chosen === stack.length - 1]}
            onStep={reorder.step}
            onDone={reorder.done}
          />
        ) : null}
      </div>
    </div>
  );
}
