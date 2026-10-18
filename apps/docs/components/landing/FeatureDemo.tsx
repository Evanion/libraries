'use client';

import { useId, useMemo, useState } from 'react';
import {
  buildFeatures,
  buildLane,
  crowd,
  describeVisitor,
  openingState,
  pageOf,
  pages,
  source,
  tally,
  visitorIds,
  type RolloutState,
} from './rollout';

/** The control last moved, and how many times, so a repeat move pulses again. */
interface Moved {
  control: 'category' | 'percent';
  count: number;
}

/**
 * A feature-flag document, and the two moments it is decided.
 *
 * One flag, two controls, two lanes. The page picker belongs to the first lane:
 * a build renders many pages and knows the category of each, so a family page
 * is answered before deploy and a strategy page has to wait for its visitors.
 * The slider belongs to the second: a rollout is decided when a visitor
 * arrives, and 24 of them are decided one by one. The slider never touches the
 * first lane. The picker changes the first lane and switches the second on or
 * dims it.
 *
 * Move the slider and visitors fill in in a fixed order, so one who has the new
 * gallery at 20% still has it at 60%.
 *
 * Nothing is simulated. The store is rebuilt from the package on every change,
 * `plan()` fills the first lane and `resolve()` the dots. The line of code a
 * control writes is lit and the lane it moved pulses once, the way
 * `AccessDemo` lights the rule that decided; under `prefers-reduced-motion` the
 * lane does not pulse and the line stays lit.
 */
export default function FeatureDemo() {
  const [state, setState] = useState<RolloutState>(openingState);
  const [moved, setMoved] = useState<Moved | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const group = useId();
  const rangeId = useId();

  const page = pageOf(state.page);
  const store = useMemo(() => buildFeatures(state.percent), [state.percent]);
  const build = useMemo(() => buildLane(store, page), [store, page]);
  const visitors = useMemo(() => crowd(store, page), [store, page]);
  const seen = tally(visitors);
  const focused = visitors.find((visitor) => visitor.id === active);

  function move(control: Moved['control'], next: RolloutState) {
    setState(next);
    setMoved({ control, count: (moved?.count ?? 0) + 1 });
  }

  return (
    <div className="landing-feature">
      <div className="landing-feature__document">
        <p className="landing-feature__label">The document</p>
        <pre className="landing-feature__source">
          <code>
            {source.map((line, index) => (
              <span
                key={index}
                className="landing-feature__line"
                data-lit={
                  line.writtenBy && line.writtenBy === moved?.control
                    ? ''
                    : undefined
                }
              >
                {line.segments.map((segment, at) =>
                  'text' in segment ? (
                    <span key={at}>{segment.text}</span>
                  ) : (
                    <span key={at} className="landing-feature__value">
                      {segment.value === 'category'
                        ? page.category
                        : state.percent}
                    </span>
                  ),
                )}
              </span>
            ))}
          </code>
        </pre>
      </div>

      <section
        className="landing-feature__lane"
        aria-label="Decided before deploy"
        data-pulse={moved?.control === 'category' ? '' : undefined}
      >
        {moved?.control === 'category' ? (
          <span
            key={moved.count}
            className="landing-feature__pulse"
            aria-hidden="true"
          />
        ) : null}
        <p className="landing-feature__label">Decided before deploy</p>
        <div className="landing-feature__lane-body">
          <div
            className="landing-feature__picker"
            role="radiogroup"
            aria-label="Page being built"
          >
            {pages.map((option) => (
              <label key={option.id} className="landing-feature__option">
                <input
                  className="baize-visually-hidden"
                  type="radio"
                  name={`${group}-page`}
                  value={option.id}
                  checked={state.page === option.id}
                  onChange={() =>
                    move('category', { ...state, page: option.id })
                  }
                />
                <span className="landing-feature__face">{option.label}</span>
              </label>
            ))}
          </div>
          <div className="landing-feature__mock">
            <p className="landing-feature__mock-title">{page.label}</p>
            <p className="landing-feature__mock-gallery">
              {build.waits ? 'New gallery for some visitors' : 'Old gallery'}
            </p>
          </div>
          <p className="landing-feature__fact">
            {build.waits
              ? 'The new gallery waits for the visitor.'
              : 'No visitor of this page can get the new gallery, so the page ships the old one.'}
          </p>
        </div>
      </section>

      <section
        className="landing-feature__lane"
        aria-label="Decided when a visitor arrives"
        data-pulse={moved?.control === 'percent' ? '' : undefined}
        data-dimmed={build.settledOff ? '' : undefined}
      >
        {moved?.control === 'percent' ? (
          <span
            key={moved.count}
            className="landing-feature__pulse"
            aria-hidden="true"
          />
        ) : null}
        <p className="landing-feature__label">Decided when a visitor arrives</p>
        <label className="landing-feature__control" htmlFor={rangeId}>
          <span>New gallery for</span>
          <input
            id={rangeId}
            type="range"
            min={0}
            max={100}
            step={5}
            value={state.percent}
            onChange={(event) =>
              move('percent', { ...state, percent: Number(event.target.value) })
            }
          />
          <output htmlFor={rangeId}>{state.percent}% of visitors</output>
        </label>
        <p className="landing-feature__gloss">
          Visitors are told apart by their id.
        </p>
        <p className="landing-feature__legend">
          {build.settledOff
            ? 'Decided before deploy: nobody on this page.'
            : 'Each dot is a visitor, told apart by their id. Filled means they see the new gallery. The same visitor always gets the same answer.'}
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
                  data-lit={visitor.gallery.enabled ? '' : undefined}
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
            : build.settledOff
              ? 'Nobody on this page gets the new gallery.'
              : `${seen} of ${visitorIds.length} visitors see the new gallery.`}
        </p>
        <output className="baize-visually-hidden" aria-live="polite">
          {`${seen} of ${visitorIds.length} visitors see the new gallery.`}
        </output>
      </section>
    </div>
  );
}
