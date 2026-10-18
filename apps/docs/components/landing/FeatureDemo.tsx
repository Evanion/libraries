'use client';

import { CROWD_SIZE } from '../product/primitives/crowd';
import { useId, useMemo, useState } from 'react';
import { CodeView } from '../product/primitives/CodeView';
import { VisitorCrowd } from '../product/primitives/VisitorCrowd';
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
  type RolloutState,
} from './rollout';

/** The control last moved, and how many times, so a repeat move pulses again. */
interface Moved {
  control: 'category' | 'percent';
  count: number;
}

/** A tiny gallery as a visitor sees it, drawn in CSS: one big picture, or a grid. */
function Thumb({ kind, label }: { kind: 'old' | 'new'; label: string }) {
  return (
    <figure className="landing-feature__view">
      <span
        className="landing-feature__thumb"
        data-kind={kind}
        aria-hidden="true"
      >
        <i />
        <i />
        <i />
        <i />
      </span>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/**
 * A feature-flag document, and the two moments it is decided.
 *
 * One flag, two controls, two lanes. The page picker belongs to the first lane:
 * a build renders many pages and knows the category of each, so a family page
 * is answered before deploy and a strategy page has to wait for its visitors.
 * The slider belongs to the second: a rollout is decided when a visitor
 * arrives, and each of them is decided one by one. The slider never touches the
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
        <p className="landing-feature__label">Your flags</p>
        <CodeView
          className="landing-feature__source"
          label="Your flags"
          lines={source.map((line, index) => ({
            key: String(index),
            lit: Boolean(line.writtenBy && line.writtenBy === moved?.control),
            content: line.segments.map((segment, at) =>
              'text' in segment ? (
                <span key={at}>{segment.text}</span>
              ) : (
                <span key={at} className="landing-feature__value">
                  {segment.value === 'category' ? page.category : state.percent}
                </span>
              ),
            ),
          }))}
        />
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
        <p className="landing-feature__lane-note">
          Set once for every visitor when the site builds.
        </p>
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
            <p className="landing-feature__mock-note">
              {page.category === 'strategy'
                ? `${page.label} is a strategy game, so the rollout can reach its visitors.`
                : `${page.label} is a family game. The rollout only targets strategy games.`}
            </p>
            <div className="landing-feature__views">
              <Thumb kind="old" label="Old gallery" />
              {build.waits ? <Thumb kind="new" label="New gallery" /> : null}
            </div>
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
        <p className="landing-feature__lane-note">
          Set for each visitor when they arrive.
        </p>
        <div className="landing-feature__row">
          <label className="landing-feature__control" htmlFor={rangeId}>
            <span>
              {build.settledOff ? 'No effect on this page' : 'New gallery for'}
            </span>
            <input
              id={rangeId}
              type="range"
              min={0}
              max={100}
              step={5}
              value={state.percent}
              disabled={build.settledOff}
              onChange={(event) =>
                move('percent', {
                  ...state,
                  percent: Number(event.target.value),
                })
              }
            />
            <output htmlFor={rangeId}>
              {build.settledOff ? '' : `${state.percent}% of visitors`}
            </output>
          </label>
          <p className="landing-feature__count">
            {build.settledOff
              ? 'Decided before deploy: nobody on this page.'
              : `${seen} of ${CROWD_SIZE} visitors see the new gallery.`}
          </p>
        </div>
        <p className="landing-feature__lesson">
          Raising the share only adds visitors; nobody who has the new gallery
          loses it.
        </p>
        <VisitorCrowd
          members={visitors.map((visitor) => ({
            id: visitor.id,
            lit: visitor.gallery.enabled,
            label: describeVisitor(visitor),
          }))}
          legend={
            build.settledOff
              ? ''
              : 'Each dot is a visitor, told apart by their id. Filled means they see the new gallery. The same visitor always gets the same answer.'
          }
          count=""
          dimmed={build.settledOff}
          onFocusMember={setActive}
        />
        <p className="landing-feature__readout">
          {focused
            ? describeVisitor(focused)
            : 'Tap or hover a dot to see that visitor.'}
        </p>
        <output className="baize-visually-hidden" aria-live="polite">
          {`${seen} of ${CROWD_SIZE} visitors see the new gallery.`}
        </output>
      </section>
    </div>
  );
}
