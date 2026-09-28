'use client';

import { useId, useState } from 'react';
import { JsonHighlight } from '../JsonHighlight';
import type { Render } from './renders';
import './astro-demo.css';

/** A value as the README region would print it, indented. */
function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * The document the preview frame holds.
 *
 * A frame, because the HTML is a fragment of a storefront page and not of this
 * one: an `<h1>` from the shop would otherwise become a second heading in the
 * docs page's outline and pick up the docs site's type. The stylesheet draws
 * the fragment as plain browser output on a white page, which is what Astro
 * handed over. Nothing in it is styled by the widgets, because the example
 * widgets carry no styles.
 */
function frame(html: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
body{margin:0;padding:12px 16px;font:14px/1.4 system-ui,sans-serif;color:#1c1c1c;background:#fff}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:8px 0 4px}p{margin:0 0 6px}
section{border:1px dashed #b5b5b5;padding:6px 8px;margin:6px 0}article{padding:2px 0}
</style></head><body>${html}</body></html>`;
}

/**
 * The picker over the payloads `/astro-widget/validation` renders.
 *
 * Every pane shows a value the build produced. `renders.json` holds, for each
 * README region, the items, `known` and `required` the region passes to
 * `validateItems`, what it returned, the HTML `Widgets.astro` rendered for the
 * same items through Astro's container API, and what the renderer printed
 * while it did. The component holds which payload is picked and nothing else.
 *
 * Picking is the whole gesture. A reader cannot type a payload of their own,
 * because this site is a static export and a browser has no Astro compiler, so
 * the only HTML there is to show is the HTML the build wrote.
 */
export function PayloadPicker({ payloads }: { payloads: Render[] }) {
  const [picked, setPicked] = useState(0);
  const id = useId();
  const payload = payloads[picked] ?? payloads[0];

  if (payload === undefined) return null;

  return (
    <div className="astro-demo">
      <fieldset className="astro-demo__picker">
        <legend className="astro-demo__legend">List</legend>
        {payloads.map((each, index) => (
          <label key={each.region} className="astro-demo__option">
            <input
              type="radio"
              name={`${id}-payload`}
              value={each.region}
              checked={index === picked}
              onChange={() => setPicked(index)}
            />
            <span>{each.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="astro-demo__panes">
        <section className="astro-demo__pane">
          <h4 className="astro-demo__head">
            <code>items</code>
          </h4>
          <pre className="astro-demo__code">
            <code>
              <JsonHighlight text={json(payload.items)} />
            </code>
          </pre>
          <h4 className="astro-demo__head">
            <code>known</code>
          </h4>
          {payload.registry ? (
            <p className="astro-demo__hint">
              The registry from <code>examples/src/registry.ts</code>.{' '}
              <code>validateItems</code> reads its keys:
            </p>
          ) : null}
          <pre className="astro-demo__code">
            <code>
              <JsonHighlight text={json(payload.known)} />
            </code>
          </pre>
          <h4 className="astro-demo__head">
            <code>required</code>
          </h4>
          <pre className="astro-demo__code">
            <code>
              {payload.required === null ? (
                'not passed'
              ) : (
                <JsonHighlight text={json(payload.required)} />
              )}
            </code>
          </pre>
        </section>

        <section className="astro-demo__pane">
          <h4 className="astro-demo__head">
            <code>
              {payload.required === null
                ? 'validateItems(items, known)'
                : 'validateItems(items, known, required)'}
            </code>
          </h4>
          {payload.problems.length === 0 ? (
            <p className="astro-demo__clean">
              <code>[]</code>, no problems. A build gate lets this through.
            </p>
          ) : (
            <table className="astro-demo__table">
              <thead>
                <tr>
                  <th scope="col">index</th>
                  <th scope="col">id</th>
                  <th scope="col">type</th>
                  <th scope="col">message</th>
                </tr>
              </thead>
              <tbody>
                {payload.problems.map((problem, index) => (
                  <tr key={index}>
                    <td>{problem.index}</td>
                    <td>{problem.id}</td>
                    <td>{problem.type}</td>
                    <td>{problem.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="astro-demo__pane astro-demo__pane--wide">
          <h4 className="astro-demo__head">
            <code>{'<Widgets items={items} registry={registry} />'}</code>
          </h4>
          <p className="astro-demo__hint">
            {payload.registry ? (
              'The same registry.'
            ) : (
              <>
                A registry holding the widget under{' '}
                <code>examples/src/widgets</code> for each name in{' '}
                <code>known</code>.
              </>
            )}
          </p>
          {payload.html === '' ? (
            <p className="astro-demo__clean">Astro rendered nothing.</p>
          ) : (
            <>
              <iframe
                className="astro-demo__frame"
                title={`What Widgets.astro rendered for: ${payload.label}`}
                srcDoc={frame(payload.html)}
                sandbox=""
              />
              <pre className="astro-demo__code">
                <code>{payload.html}</code>
              </pre>
            </>
          )}
          <h4 className="astro-demo__head">
            <code>console.warn</code> under <code>astro dev</code>
          </h4>
          {payload.warnings.length === 0 ? (
            <p className="astro-demo__clean">Nothing.</p>
          ) : (
            <ul className="astro-demo__warnings">
              {payload.warnings.map((warning) => (
                <li key={warning}>
                  <code>{warning}</code>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <output className="astro-demo__sr-only" aria-live="polite">
        {`${payload.label}. validateItems returned ${
          payload.problems.length === 0
            ? 'no problems'
            : payload.problems
                .map(
                  (problem) => `${problem.message} at index ${problem.index}`,
                )
                .join(', ')
        }. Widgets.astro rendered ${
          payload.html === '' ? 'nothing' : payload.html
        }.`}
      </output>
    </div>
  );
}
