import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  createFeatures,
  parseFeatureConfig,
  serializeConfig,
} from '@evanion/feature';
import type { DecisionSet, DivergenceReport } from '@evanion/feature';
import { FeatureProvider, useFeature, useVariant } from './index.js';

/**
 * The handoff the README's landing example performs: a server resolves one
 * subject's decisions, the set crosses into a client module as a prop, and a
 * component reads one variant off the provider.
 *
 * A prop crossing that boundary is serialised, so the set the client holds is
 * a plain object parsed from text and not the object the server resolved. The
 * specs beside this one hand the provider the object a render produced, which
 * tests the provider and not the trip, and the trip is the move every
 * framework page in the documentation set is about to teach.
 */

/** The store the README's example builds, keyed and weighted the same way. */
const SHELF = [
  {
    key: 'shelf-sort',
    enabled: true,
    variants: [
      { name: 'newest', weight: 50 },
      { name: 'popular', weight: 50 },
    ],
  },
] as const;

/**
 * A feature whose window opens in 2030, so one answer belongs to the instant a
 * set states and the other to the clock the provider reads.
 */
const SALE = [
  {
    key: 'sale',
    enabled: true,
    rules: [
      {
        id: 'window',
        when: [{ field: 'now', op: 'after', value: '2030-01-01T00:00:00Z' }],
      },
    ],
  },
] as const;

/**
 * The schema the README writes by hand for the set it sends.
 *
 * The example annotates the parsed value with it, because `JSON.parse` answers
 * `any` and the annotation is the only thing that states what came back.
 */
type Shelves = { 'shelf-sort': { variant: 'newest' | 'popular' } };

const shelves = createFeatures(SHELF);

/** One set, as a client module receives it. */
function overTheWire<T>(set: T): T {
  return JSON.parse(JSON.stringify(set)) as T;
}

function Shelf() {
  const { variant } = useVariant('shelf-sort');

  return (
    <span data-testid="shelf">
      {variant === 'popular' ? 'Most played first' : 'Newest first'}
    </span>
  );
}

function Sale() {
  return <span data-testid="sale">{String(useFeature('sale').enabled)}</span>;
}

/** The markup a tree under `decisions` renders, the way a server produces it. */
function shelfMarkup(decisions: DecisionSet<Shelves>): string {
  return renderToStaticMarkup(
    <FeatureProvider features={shelves} decisions={decisions}>
      <Shelf />
    </FeatureProvider>,
  );
}

describe('FeatureProvider', () => {
  it('publishes a set that crossed JSON the way it publishes the one a render held', () => {
    const live = shelves.snapshot({ targetingKey: 'sam' });

    expect(shelfMarkup(overTheWire(live))).toBe(shelfMarkup(live));
  });

  it('assigns the two shoppers opposite shelves whatever instant the set states', () => {
    const sent = (shopper: string, now: string) =>
      shelfMarkup(
        overTheWire(
          shelves.snapshot({ targetingKey: shopper, now: new Date(now) }),
        ),
      );

    expect(sent('sam', '2026-01-01T00:00:00Z')).toContain('Most played first');
    expect(sent('sam', '2031-06-30T12:00:00Z')).toContain('Most played first');
    expect(sent('mika', '2026-01-01T00:00:00Z')).toContain('Newest first');
    expect(sent('mika', '2031-06-30T12:00:00Z')).toContain('Newest first');
  });

  it('reports no divergence for a versioned set that crossed JSON', () => {
    const served = serializeConfig(createFeatures(SHELF), { version: 'v7' });
    const parsed = parseFeatureConfig<Shelves>(served);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const client = parsed.features;
    const live = client.snapshot({ targetingKey: 'sam' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={client}
        decisions={overTheWire(live)}
        context={{ targetingKey: 'sam' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Shelf />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('shelf')).toHaveTextContent('Most played first');
    expect(reports).toEqual([]);
  });

  it('resolves locally at the instant a set stated after it crossed JSON', () => {
    // The stated instant is inside the SALE window and the clock below is
    // outside it, so a provider reading its own clock resolves off locally and
    // reports the difference. An unpinned clock would decide the case by the
    // year it runs in, the way the sibling case at hydrate.spec.tsx does.
    onTestFinished(() => {
      vi.useRealTimers();
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-04T05:06:07.008Z'));
    const store = createFeatures(SALE);
    const shipped = store.snapshot({ now: new Date('2031-01-01T00:00:00Z') });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={overTheWire(shipped)}
        context={{}}
        onDivergence={(report) => reports.push(report)}
      >
        <Sale />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('sale')).toHaveTextContent('true');
    expect(
      reports.filter((report) => report.kind === 'decision-differs'),
    ).toEqual([]);
  });

  it('names the bucketing field for a set that crossed JSON into a context without it', () => {
    const live = shelves.snapshot({ targetingKey: 'sam' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={shelves}
        decisions={overTheWire(live)}
        context={{}}
        onDivergence={(report) => reports.push(report)}
      >
        <Shelf />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('shelf')).toHaveTextContent('Most played first');
    expect(
      reports.filter((report) => report.kind === 'missing-field'),
    ).toMatchObject([{ key: 'shelf-sort', field: 'targetingKey' }]);
  });
});
