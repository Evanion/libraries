'use client';

import { useId, useMemo, useState } from 'react';
import {
  buildFeatures,
  buildLane,
  crowd,
  describeVisitor,
  openingState,
  source,
  tally,
  visitorIds,
  type BuildFlag,
  type RolloutState,
} from './rollout';

/** What the build lane says about a flag. */
function buildWords(flag: BuildFlag): string {
  if (flag.status === 'on') return 'baked in, on';
  if (flag.status === 'off') return 'settled off at build';
  return `decided per visitor · needs ${flag.needs.join(', ')}`;
}

/**
 * A feature-flag document, and the two moments it is decided.
 *
 * The document is three flags in the shop's own terms, and two of its values are
 * controls: the switch on `new-checkout` and the percent of its rollout. Under
 * it are the two places the document is read. The build knows the game page and
 * no visitor, so it settles what it can and leaves the rest. The request knows
 * the visitor, and 24 of them are decided one by one.
 *
 * Move the slider and visitors light up in a fixed order: a visitor who is in at
 * 20% is in at 60%, so a rollout only ever grows. Turn the switch off and the
 * build settles `new-checkout` and `express-pickup` itself, and every visitor's
 * pickup reads `dependency-off`.
 *
 * Nothing is simulated. The store is rebuilt from the package on every change,
 * `plan()` fills the build lane and `resolve()` fills the dots, so what the
 * reader edits is the real document. A dot is a focusable element whose label
 * is the visitor's decision, and the line under the lanes reads whichever dot is
 * hovered or focused.
 */
export default function FeatureDemo() {
  const [state, setState] = useState<RolloutState>(openingState);
  const [active, setActive] = useState<string | null>(null);
  const switchId = useId();
  const rangeId = useId();

  const store = useMemo(() => buildFeatures(state), [state]);
  const build = useMemo(() => buildLane(store), [store]);
  const visitors = useMemo(() => crowd(store), [store]);
  const counts = tally(visitors);
  const focused = visitors.find((visitor) => visitor.id === active);

  return (
    <div className="landing-feature">
      <div className="landing-feature__document">
        <p className="landing-feature__label">features</p>
        <div className="landing-feature__controls">
          <label className="landing-feature__control" htmlFor={switchId}>
            <input
              id={switchId}
              type="checkbox"
              checked={state.checkoutOn}
              onChange={(event) =>
                setState({ ...state, checkoutOn: event.target.checked })
              }
            />
            <span>new-checkout enabled</span>
          </label>
          <label className="landing-feature__control" htmlFor={rangeId}>
            <span>rollout percent</span>
            <input
              id={rangeId}
              type="range"
              min={0}
              max={100}
              step={5}
              value={state.percent}
              onChange={(event) =>
                setState({ ...state, percent: Number(event.target.value) })
              }
            />
            <output htmlFor={rangeId}>{state.percent}%</output>
          </label>
        </div>
        <pre className="landing-feature__source">
          <code>
            {source.map((line, index) => (
              <span key={index} className="landing-feature__line">
                {line.map((segment, at) =>
                  'text' in segment ? (
                    <span key={at}>{segment.text}</span>
                  ) : (
                    <span key={at} className="landing-feature__value">
                      {segment.value === 'enabled'
                        ? String(state.checkoutOn)
                        : state.percent}
                    </span>
                  ),
                )}
              </span>
            ))}
          </code>
        </pre>
      </div>

      <section className="landing-feature__lane" aria-label="At build">
        <p className="landing-feature__label">At build: the game page</p>
        <ul className="landing-feature__flags">
          {build.map((flag) => (
            <li
              key={flag.key}
              className="landing-feature__flag"
              data-status={flag.status}
            >
              <span className="landing-feature__key">{flag.key}</span>
              <span className="landing-feature__status">
                {buildWords(flag)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-feature__lane" aria-label="On each request">
        <p className="landing-feature__label">
          On each request: {visitorIds.length} visitors
        </p>
        <ul className="landing-feature__crowd">
          {visitors.map((visitor) => {
            const label = describeVisitor(visitor);
            return (
              <li key={visitor.id}>
                <span
                  className="landing-feature__dot"
                  role="img"
                  tabIndex={0}
                  aria-label={label}
                  title={label}
                  data-lit={visitor.checkout.enabled ? '' : undefined}
                  data-pickup={visitor.pickup.enabled ? '' : undefined}
                  onPointerEnter={() => setActive(visitor.id)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(visitor.id)}
                  onBlur={() => setActive(null)}
                />
              </li>
            );
          })}
        </ul>
        <p className="landing-feature__readout">
          {focused
            ? describeVisitor(focused)
            : `${counts.checkout} of ${visitorIds.length} have the new checkout, ${counts.pickup} of them with express pickup.`}
        </p>
        <output className="baize-visually-hidden" aria-live="polite">
          {`${counts.checkout} of ${visitorIds.length} visitors have the new checkout and ${counts.pickup} have express pickup.`}
        </output>
      </section>
    </div>
  );
}
