import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createFeatures,
  parseFeatureConfig,
  serializeConfig,
} from '../index.js';
import { createFeatureContext, FeatureProvider, useFeature } from './index.js';
import type {
  DecisionSet,
  DivergenceObserver,
  DivergenceReport,
} from '../index.js';

/**
 * The input classes the provider answers at its edges.
 *
 * `hydrate.spec.tsx` holds one case per outcome of § 3 and one per check of
 * § 4. This file holds the boundaries of each: a set that carries a version
 * against a store that carries none and the reverse, a set naming no decision
 * at all, a set naming a decision this store cannot place, a set keyed on a
 * prototype member, a set whose instant names no date, and the bound provider,
 * which the shared one's cases never mount.
 *
 * The sufficiency check reaches each of the four assignment sources here, and
 * a context carrying an unusable value at the bucketing field. It reaches both
 * store gaps -- a key this store does not declare and a key it declares with
 * no variants, under a bucket and under a pin -- and each kind of field a
 * pinning rule reads: a date window the clock fills, an attribute, and a
 * rollout bucket the rule's `when` never names. A pin naming a rule this store
 * does not hold reaches it too. A runtime that defines no
 * `process` and one whose `process` carries no `env` mount a provider too, a
 * re-render that writes a new observer prop counts what the checks send, and a
 * re-render that installs one over a context the provider already resolved
 * counts what that observer receives.
 *
 * Several cases hand the provider a set written out here rather than one
 * `snapshot` produced. A set reaches a client as JSON and nothing re-validates
 * it, so a server one version ahead ships a decision for a feature this store
 * does not declare, a serializer ships a map missing a key, and a host with a
 * broken clock ships an instant no `Date` reads. The cast on each one is what
 * the wire does for free.
 *
 * Every instant a case depends on is written into the fixture. Two cases read
 * the host's clock: one asserts a comparison against a 2029 boundary, which
 * holds on any host whose clock sits between 2026 and 2029, and the other
 * against a window that opened in 2020.
 */

/** A split with two variants, which a document states in full. */
const SPLIT = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
] as const;

/** The schema `parseFeatureConfig` builds the split's store at. */
type Split = { cta: { variant: 'control' | 'blue' } };

/** A split and a flag, so a partial set can drop one of the two. */
const PAIR = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
  },
  { key: 'banner', enabled: true },
] as const;

/** The schema `parseFeatureConfig` builds the pair's store at. */
type Pair = { cta: { variant: 'control' | 'blue' }; banner: never };

/**
 * A split that buckets on a field of its own, whose control is the second
 * element of the array.
 *
 * Two constants a check could carry instead of reading the inputs are
 * `'targetingKey'` for the field and the first array element for the control.
 * Neither one is true here.
 */
const CUSTOM = [
  {
    key: 'cta',
    enabled: true,
    variantBy: 'accountId',
    variants: [
      { name: 'blue', weight: 50, order: 1 },
      { name: 'green', weight: 50, order: 0 },
    ],
  },
] as const;

/** A window no clock between 2026 and 2029 is inside. */
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
 * A split a rule pins, so the variant comes off the rule and not off a bucket.
 *
 * The rule reads `group` and the bucketing field stays `targetingKey`, which
 * is what a server holds and a client does not.
 */
const PINNED = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
    rules: [
      {
        id: 'staff',
        when: [{ field: 'group', op: 'eq', value: 'staff' }],
        variant: 'blue',
      },
    ],
  },
] as const;

/**
 * The pinned split as a document one version behind states it: the same rule
 * under the same id, and no variants at all.
 *
 * `ruleId` answers `'staff'` for both, so a set the newer document shipped
 * names a rule this store holds. `decide` still assigns no variant here, so no
 * context reaches the pin.
 */
const PINNED_FLAG = [
  {
    key: 'cta',
    enabled: true,
    rules: [
      { id: 'staff', when: [{ field: 'group', op: 'eq', value: 'staff' }] },
    ],
  },
] as const;

/**
 * A split pinned by a rule that reads three fields of three kinds: a date
 * window, an attribute, and a rollout bucket on a field of its own.
 *
 * The clock fills `now` for a context carrying none, so the window is readable
 * wherever the rule is. `group` and `deviceId` are not, and `deviceId` reaches
 * the rule's field list only through its `rollout` and never through `when`.
 * The rollout is at 100%, so a context carrying all three matches.
 */
const PIN_WINDOW = [
  {
    key: 'cta',
    enabled: true,
    variants: [
      { name: 'control', weight: 50 },
      { name: 'blue', weight: 50 },
    ],
    rules: [
      {
        id: 'staff-window',
        when: [
          { field: 'now', op: 'after', value: '2020-01-01T00:00:00Z' },
          { field: 'group', op: 'eq', value: 'staff' },
        ],
        rollout: { percent: 100, by: 'deviceId' },
        variant: 'blue',
      },
    ],
  },
] as const;

/** The schema `parseFeatureConfig` builds the custom split's store at. */
type Custom = { cta: { variant: 'blue' | 'green' } };

/** A window every clock after 2020 is inside. */
const OPEN = [
  {
    key: 'sale',
    enabled: true,
    rules: [
      {
        id: 'window',
        when: [{ field: 'now', op: 'after', value: '2020-01-01T00:00:00Z' }],
      },
    ],
  },
] as const;

/** The schema `parseFeatureConfig` builds the open window's store at. */
type OpenSale = { sale: never };

function storeAt(version: string) {
  const parsed = parseFeatureConfig<Split>(
    serializeConfig(createFeatures(SPLIT), { version }),
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.features;
}

function openAt(version: string) {
  const parsed = parseFeatureConfig<OpenSale>(
    serializeConfig(createFeatures(OPEN), { version }),
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.features;
}

function customAt(version: string) {
  const parsed = parseFeatureConfig<Custom>(
    serializeConfig(createFeatures(CUSTOM), { version }),
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.features;
}

function pairAt(version: string) {
  const parsed = parseFeatureConfig<Pair>(
    serializeConfig(createFeatures(PAIR), { version }),
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.features;
}

function Cta() {
  return <span data-testid="cta">{useFeature('cta').variant}</span>;
}

function Banner() {
  return (
    <span data-testid="banner">{String(useFeature('banner').enabled)}</span>
  );
}

function Sale() {
  return <span data-testid="sale">{String(useFeature('sale').enabled)}</span>;
}

/** The set a store at `version` ships, with `cta` assigned the other variant. */
function shippedBlue(version: string) {
  const shipped = storeAt(version).snapshot({ targetingKey: 'u-9' });
  return {
    ...shipped,
    decisions: { cta: { ...shipped.decisions.cta, variant: 'blue' as const } },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('FeatureProvider', () => {
  it('renders the shipped answer where its own store resolves another one', () => {
    // Both documents declare one split and differ in their version alone, so
    // the two stores assign `u-9` the same variant and a provider that quietly
    // resolved locally would render what the server sent. The override is what
    // separates the two answers.
    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('renders the shipped answer under re-resolve when the two versions agree', () => {
    render(
      <FeatureProvider
        features={storeAt('v1')}
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
        onVersionMismatch="re-resolve"
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('reports a set carrying a version against a store carrying none', () => {
    const store = createFeatures(SPLIT);
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={{ ...shipped, version: 'v1' }}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(reports).toMatchObject([
      {
        kind: 'unversioned',
        shipped: { version: 'v1' },
        local: { version: undefined },
      },
    ]);
  });

  it('reports a store carrying a version against a set carrying none', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const unversioned: DecisionSet<Split> = {
      now: shipped.now,
      origin: shipped.origin,
      decisions: shipped.decisions,
    };
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={unversioned}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(reports).toMatchObject([
      {
        kind: 'unversioned',
        shipped: { version: undefined },
        local: { version: 'v1' },
      },
    ]);
  });

  it('renders the shipped set under re-resolve when only the store is versioned', () => {
    const shipped = shippedBlue('v1');
    const unversioned: DecisionSet<Split> = {
      now: shipped.now,
      origin: shipped.origin,
      decisions: shipped.decisions,
    };

    render(
      <FeatureProvider
        features={storeAt('v1')}
        decisions={unversioned}
        context={{ targetingKey: 'u-9' }}
        onVersionMismatch="re-resolve"
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('names the field a shipped assignment bucketed on and the control it would get', () => {
    const store = createFeatures(CUSTOM);
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={store.snapshot({ accountId: 'a-1' })}
        context={{}}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(
      reports.filter((report) => report.kind === 'missing-field'),
    ).toMatchObject([
      {
        key: 'cta',
        field: 'accountId',
        shipped: { source: 'weighted' },
        local: { variant: 'green', source: 'fallback' },
      },
    ]);
  });

  it('names a sticky assignment the client context cannot reproduce', () => {
    const store = storeAt('v1');
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={store.snapshot({
          targetingKey: 'u-9',
          stickyVariants: { cta: 'blue' },
        })}
        context={{}}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(
      reports.filter((report) => report.kind === 'missing-field'),
    ).toMatchObject([
      {
        key: 'cta',
        field: 'targetingKey',
        shipped: { variant: 'blue', source: 'sticky' },
        local: { variant: 'control', source: 'fallback' },
      },
    ]);
  });

  it('names the field for a context carrying no usable value at it', () => {
    const store = createFeatures(CUSTOM);
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={store.snapshot({ accountId: 'a-1' })}
        // `EvaluationContext` admits any value at a bucketing field, and a
        // client reads one off a session that holds no account. The engine
        // buckets a string and a number and falls back for every other type.
        context={{ accountId: null }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    const missing = reports.find((report) => report.kind === 'missing-field');

    expect(missing).toMatchObject({
      key: 'cta',
      field: 'accountId',
      shipped: { source: 'weighted' },
      local: { variant: 'green', source: 'fallback' },
    });
    // The field is there. What it holds is what no engine buckets.
    expect(missing?.message).toContain(
      'carries no value at "accountId" that buckets a subject',
    );
  });

  it('names the rule field a pin needs under NODE_ENV production', () => {
    // The pin is the one case a context change fixes that the development
    // diff cannot report, because the diff does not run here.
    vi.stubEnv('NODE_ENV', 'production');
    const store = createFeatures(PINNED);
    const shipped = store.snapshot({ targetingKey: 'u-9', group: 'staff' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={shipped}
        // The bucketing field the pin ignored, and not the field the pinning
        // rule read. The rule cannot match here, so this client resolves the
        // other variant.
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    const missing = reports.find((report) => report.kind === 'missing-field');

    expect(shipped.decisions.cta.assignment).toMatchObject({
      source: 'pinned',
      by: 'targetingKey',
      rule: 'staff',
    });
    expect(missing).toMatchObject({
      key: 'cta',
      field: 'group',
      shipped: { variant: 'blue', source: 'pinned' },
      local: { source: 'weighted' },
    });
    expect(missing?.message).toContain('off rule "staff"');
    expect(missing?.message).toContain('carries no "group"');
  });

  it("names a pinning rule's rollout field and never its date window", () => {
    const store = createFeatures(PIN_WINDOW);
    // A build-origin set, so the provider settles the context at its own clock
    // and the stated instant never reaches it. The context the checks read
    // carries no `now` at all, which is the input class the `now` filter
    // answers.
    const shipped = store.snapshot(
      { targetingKey: 'u-9', group: 'staff', deviceId: 'd-1' },
      { origin: 'build' },
    );
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={shipped}
        // The rule's attribute field and not its rollout field, so the one
        // thing this provider cannot read is the bucket the rollout needs.
        context={{ group: 'staff' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    const missing = reports.find((report) => report.kind === 'missing-field');

    expect(shipped.origin).toBe('build');
    expect(shipped.decisions.cta.assignment).toMatchObject({
      source: 'pinned',
      rule: 'staff-window',
    });
    expect(missing).toMatchObject({ key: 'cta', field: 'deviceId' });
    // Every entry point fills `now` from the clock, so a rule reading a date
    // window is readable here and the report asks for nothing it can fill.
    expect(missing?.message).toContain('carries no "deviceId"');
    expect(missing?.message).not.toContain('now');
    expect(missing?.message).toContain('Pass deviceId to');
  });

  it('names every field a pinning rule reads that the context carries nothing at', () => {
    const store = createFeatures(PIN_WINDOW);
    const shipped = store.snapshot(
      { targetingKey: 'u-9', group: 'staff', deviceId: 'd-1' },
      { origin: 'build' },
    );
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={shipped}
        // Neither of the rule's two readable fields. A report naming one of
        // them sends the developer back for a second round on the other.
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    const missing = reports.find((report) => report.kind === 'missing-field');

    expect(missing?.field).toBe('deviceId');
    expect(missing?.message).toContain('carries no "deviceId", "group"');
    expect(missing?.message).toContain('Pass deviceId, group to');
  });

  it('names no field for an assignment a rule pinned', () => {
    const store = createFeatures(PINNED);
    const shipped = store.snapshot({ targetingKey: 'u-9', group: 'staff' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={shipped}
        // The rule's own field, and not the bucketing field the pin ignored.
        context={{ group: 'staff' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(shipped.decisions.cta.assignment?.source).toBe('pinned');
    expect(shipped.decisions.cta.assignment?.by).toBe('targetingKey');
    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
    expect(reports.filter((report) => report.kind === 'missing-field')).toEqual(
      [],
    );
  });

  it('names the store gap for a pinned assignment on a key it declares with no variants', () => {
    // Production, because § 4 gives the sufficiency check the pin on the
    // grounds that it is the only check that runs here.
    vi.stubEnv('NODE_ENV', 'production');
    const shipped = createFeatures(PINNED).snapshot({
      targetingKey: 'u-9',
      group: 'staff',
    });
    // A store one document behind, holding the pinning rule under the same id
    // and no variants to pin.
    const store = createFeatures(PINNED_FLAG);
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={shipped as unknown as DecisionSet<{ cta: never }>}
        // The rule's own field, so the rule is readable here and the pin check
        // finds nothing to ask for. The gap is the store's.
        context={{ group: 'staff' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    const missing = reports.find((report) => report.kind === 'missing-field');

    expect(shipped.decisions.cta.assignment).toMatchObject({
      source: 'pinned',
      rule: 'staff',
    });
    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
    expect(missing).toMatchObject({
      key: 'cta',
      shipped: { variant: 'blue', source: 'pinned' },
    });
    expect(missing?.field).toBeUndefined();
    expect(missing?.message).toContain('with no variants');
  });

  it('names no field for a pinned assignment naming a rule this store lacks', () => {
    // A store whose document states the split and no rules at all, against a
    // set a server one version ahead pinned. The wire carries whatever a
    // producer sent, and no rule here states what that one matched on, so the
    // check asks for nothing and the version comparison names the two stores.
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const pinned = {
      ...shipped,
      decisions: {
        cta: {
          ...shipped.decisions.cta,
          variant: 'blue' as const,
          assignment: {
            source: 'pinned',
            by: 'targetingKey',
            rule: 'staff',
          },
        },
      },
    } as unknown as DecisionSet<Split>;
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={pinned}
        context={{}}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
    expect(reports.filter((report) => report.kind === 'missing-field')).toEqual(
      [],
    );
  });

  it('names no field for a sticky assignment the client context reproduces', () => {
    const store = storeAt('v1');
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={store.snapshot({
          targetingKey: 'u-9',
          stickyVariants: { cta: 'blue' },
        })}
        // Both sides read the sticky map off the same cookie while
        // `targetingKey` is a server-side id the client does not carry. The
        // engine reads the map before it reads the bucketing field, so this
        // context assigns `blue` with source `'sticky'` too.
        context={{ stickyVariants: { cta: 'blue' } }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
    expect(reports.filter((report) => report.kind === 'missing-field')).toEqual(
      [],
    );
  });

  it('names the store gap for a shipped assignment on a feature it lacks', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    // A server one version ahead ships a decision for a feature this document
    // does not declare. The wire carries it and the cast is what JSON does.
    const ahead = {
      ...shipped,
      decisions: {
        ...shipped.decisions,
        promo: {
          key: 'promo',
          enabled: true,
          reason: 'default-on',
          variant: 'wide',
          assignment: { source: 'weighted', by: 'targetingKey', bucket: 0.5 },
        },
      },
    } as unknown as DecisionSet<Split>;
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={ahead}
        // The context carries the field the server bucketed on, so the only
        // thing this provider cannot reproduce is a feature it never declared.
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    const promo = reports.find((report) => report.key === 'promo');

    expect(promo).toMatchObject({
      kind: 'missing-field',
      shipped: { variant: 'wide', source: 'weighted' },
    });
    // No context reproduces the assignment, so the report names no local
    // variant and asks for no field.
    expect(promo?.field).toBeUndefined();
    expect(promo?.local).toBeUndefined();
    expect(promo?.message).toContain('declares no feature "promo"');
    expect(promo?.message).not.toContain('carries no');
  });

  it('names the store gap for a shipped assignment on a key it declares with no variants', () => {
    const store = pairAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    // A server one version ahead declares `banner` with variants and ships an
    // assignment for it. This store holds the key and no variants, so its own
    // engine assigns no variant for it whatever the context carries.
    const ahead = {
      ...shipped,
      decisions: {
        ...shipped.decisions,
        banner: {
          ...shipped.decisions.banner,
          variant: 'wide',
          assignment: { source: 'weighted', by: 'targetingKey', bucket: 0.5 },
        },
      },
    } as unknown as DecisionSet<Pair>;
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={ahead}
        // The context carries the field the server bucketed on, so the only
        // thing this provider cannot reproduce is a variant set it never
        // declared.
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Banner />
      </FeatureProvider>,
    );

    const banner = reports.find((report) => report.key === 'banner');

    expect(banner).toMatchObject({
      kind: 'missing-field',
      shipped: { variant: 'wide', source: 'weighted' },
    });
    expect(banner?.field).toBeUndefined();
    expect(banner?.local).toBeUndefined();
    expect(banner?.message).toContain('with no variants');
    expect(banner?.message).not.toContain('targetingKey');
  });

  it('names the field this provider buckets on where the two stores differ', () => {
    const shipped = storeAt('v1').snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        // A client store whose `variantBy` names another field than the
        // server's. The field a developer has to supply is this store's, and
        // the server's is the one no engine here reads.
        features={customAt('v1')}
        decisions={shipped as unknown as DecisionSet<Custom>}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    const missing = reports.find((report) => report.kind === 'missing-field');

    expect(missing?.field).toBe('accountId');
    expect(missing?.local).toEqual({ variant: 'green', source: 'fallback' });
    expect(missing?.message).toContain('by "targetingKey"');
    expect(missing?.message).toContain('carries no "accountId"');
  });

  it('publishes a shipped set that names no decision at all', () => {
    const store = createFeatures([]);
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={store.snapshot()}
        onDivergence={(report) => reports.push(report)}
      >
        <span data-testid="shell">rendered</span>
      </FeatureProvider>,
    );

    expect(screen.getByTestId('shell')).toHaveTextContent('rendered');
    expect(reports.map((report) => report.kind)).toEqual(['unversioned']);
  });

  it('names no divergence for a key only its own store holds', () => {
    const store = pairAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    // A serializer that ships the keys the page reads and no others.
    const partial = {
      ...shipped,
      decisions: { cta: shipped.decisions.cta },
    } as unknown as DecisionSet<Pair>;
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={partial}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(reports).toEqual([]);
  });

  it('throws for a key the shipped set does not name', () => {
    const store = pairAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const partial = {
      ...shipped,
      decisions: { cta: shipped.decisions.cta },
    } as unknown as DecisionSet<Pair>;

    expect(() =>
      render(
        <FeatureProvider
          features={store}
          decisions={partial}
          context={{ targetingKey: 'u-9' }}
        >
          <Banner />
        </FeatureProvider>,
      ),
    ).toThrow(/banner/);
  });

  it('reports a decision whose reason alone differs', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={{
          ...shipped,
          decisions: {
            cta: { ...shipped.decisions.cta, reason: 'rule-match' },
          },
        }}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(
      reports.filter((report) => report.kind === 'decision-differs'),
    ).toMatchObject([{ key: 'cta' }]);
  });

  it('names no divergence for a shipped key off the prototype chain', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    // `constructor` reads a function off `Object.prototype` under a bare
    // index, and the diff would compare a decision against it.
    const polluted = {
      ...shipped,
      decisions: {
        ...shipped.decisions,
        constructor: {
          key: 'constructor',
          enabled: true,
          reason: 'default-on',
        },
      },
    } as unknown as DecisionSet<Split>;
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={polluted}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(reports).toEqual([]);
  });

  it('renders the shipped set when the instant it states names no date', () => {
    const shipped = shippedBlue('v1');

    render(
      <FeatureProvider
        features={storeAt('v1')}
        decisions={{ ...shipped, now: 'the day before' }}
        context={{ targetingKey: 'u-9' }}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('resolves at its own clock under re-resolve when the stated instant names no date', () => {
    const shipped = openAt('v1').snapshot({});

    render(
      <FeatureProvider
        features={openAt('v2')}
        decisions={{ ...shipped, now: 'the day before' }}
        context={{}}
        onVersionMismatch="re-resolve"
      >
        <Sale />
      </FeatureProvider>,
    );

    // The window opened in 2020 and the provider publishes what it resolved
    // itself. An invalid `Date` for the default instant answers every
    // condition on `now` with `false`, so the window would read closed.
    expect(screen.getByTestId('sale')).toHaveTextContent('true');
  });

  it('runs no diff in a runtime that defines no process global', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];
    // A runtime that answers neither half of the read is as often a served
    // production page as a developer's machine, and the diff's second
    // resolution is the cost § 4 keeps out of production.
    vi.stubGlobal('process', undefined);

    try {
      render(
        <FeatureProvider
          features={store}
          decisions={{
            ...shipped,
            decisions: {
              cta: { ...shipped.decisions.cta, reason: 'rule-match' },
            },
          }}
          context={{ targetingKey: 'u-9' }}
          onDivergence={(report) => reports.push(report)}
        >
          <Cta />
        </FeatureProvider>,
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(reports).toEqual([]);
  });

  it('renders in a runtime that defines no process global', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];
    // The package ships as plain ESM, so a browser loading it through an
    // import map holds no `process` and a shim may hold one with no `env`.
    vi.stubGlobal('process', undefined);

    try {
      render(
        <FeatureProvider
          features={store}
          decisions={shipped}
          context={{ targetingKey: 'u-9' }}
          // The guard sits behind `observer !== undefined`, so a provider
          // mounted without an observer never reaches the read this case is
          // about.
          onDivergence={(report) => reports.push(report)}
        >
          <Cta />
        </FeatureProvider>,
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(reports).toEqual([]);
    expect(screen.getByTestId('cta')).toHaveTextContent(
      String(shipped.decisions.cta.variant),
    );
  });

  it('renders in a runtime whose process carries no env', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];
    vi.stubGlobal('process', {});

    try {
      render(
        <FeatureProvider
          features={store}
          decisions={shipped}
          context={{ targetingKey: 'u-9' }}
          onDivergence={(report) => reports.push(report)}
        >
          <Cta />
        </FeatureProvider>,
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(reports).toEqual([]);
    expect(screen.getByTestId('cta')).toHaveTextContent(
      String(shipped.decisions.cta.variant),
    );
  });

  it('emits no resolve event for an observed store with no observer installed', () => {
    const events: string[] = [];
    const store = createFeatures(SPLIT, {
      observe: (event) => {
        events.push(event.type);
      },
    });
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const produced = events.length;

    render(
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={{ targetingKey: 'u-9' }}
      >
        <Cta />
      </FeatureProvider>,
    );

    // Nothing reads a development resolution here, and the event it emits
    // names decisions this provider never publishes.
    expect(events).toHaveLength(produced);
  });

  it('renders through every check it runs with no observer installed', () => {
    const store = createFeatures(CUSTOM);
    const shipped = store.snapshot({ accountId: 'a-1' });

    render(
      <FeatureProvider
        features={store}
        decisions={{
          ...shipped,
          decisions: {
            cta: { ...shipped.decisions.cta, variant: 'blue' as const },
          },
        }}
        context={{}}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('keeps reporting after an observer throws', () => {
    const store = createFeatures(CUSTOM);
    const shipped = store.snapshot({ accountId: 'a-1' });
    const seen: DivergenceReport['kind'][] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={{
          ...shipped,
          decisions: {
            cta: { ...shipped.decisions.cta, variant: 'blue' as const },
          },
        }}
        context={{}}
        onDivergence={(report) => {
          seen.push(report.kind);
          throw new Error('observer');
        }}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(seen).toHaveLength(3);
    expect(new Set(seen)).toEqual(
      new Set(['unversioned', 'missing-field', 'decision-differs']),
    );
  });

  it('reads an explicit context instant over the one a render-origin set states', () => {
    const store = createFeatures(SALE);
    const shipped = store.snapshot({ now: new Date('2031-01-01T00:00:00Z') });
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={{ now: new Date('2029-01-01T00:00:00Z') }}
        onDivergence={(report) => reports.push(report)}
      >
        <Sale />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('sale')).toHaveTextContent('true');
    expect(
      reports.filter((report) => report.kind === 'decision-differs'),
    ).toMatchObject([
      { key: 'sale', shipped: { enabled: true }, local: { enabled: false } },
    ]);
  });

  it('names the missing context field under NODE_ENV production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const store = storeAt('v1');
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={store}
        decisions={store.snapshot({ targetingKey: 'u-9' })}
        context={{}}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(
      reports.filter((report) => report.kind === 'missing-field'),
    ).toMatchObject([{ key: 'cta', field: 'targetingKey' }]);
  });

  it('reports the two versions under NODE_ENV production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(reports.map((report) => report.kind)).toEqual(['config-version']);
  });

  it('renders what it resolves itself under re-resolve in NODE_ENV production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
        onVersionMismatch="re-resolve"
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('control');
  });

  it('runs no diff under re-resolve with an observer in NODE_ENV production', () => {
    // The one production input class that resolves locally and holds an
    // observer to report to. `'re-resolve'` resolves for what it publishes,
    // and the development diff reads the same resolution, so the production
    // gate is the only thing between the two.
    vi.stubEnv('NODE_ENV', 'production');
    const reports: DivergenceReport[] = [];

    render(
      <FeatureProvider
        features={storeAt('v2')}
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
        onVersionMismatch="re-resolve"
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>,
    );

    // The two sides differ on `cta`: the set ships `blue` and this store
    // resolves `control`, which is a `'decision-differs'` report in
    // development and nothing here.
    expect(screen.getByTestId('cta')).toHaveTextContent('control');
    expect(reports.map((report) => report.kind)).toEqual(['config-version']);
  });

  it('reports once across a re-render that writes a new observer', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const context = {};
    const reports: DivergenceReport[] = [];
    // An observer prop written inline, which a parent re-rendering on a
    // keystroke hands the provider as a new function every time.
    const tree = () => (
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={context}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </FeatureProvider>
    );

    const { rerender } = render(tree());
    const mounted = reports.length;
    rerender(tree());
    rerender(tree());

    expect(mounted).toBe(1);
    expect(reports).toHaveLength(mounted);
  });

  it('reports again when a re-render changes the context', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const reports: DivergenceReport[] = [];
    const observe = (report: DivergenceReport) => reports.push(report);
    const tree = (context: Record<string, unknown>) => (
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={context}
        onDivergence={observe}
      >
        <Cta />
      </FeatureProvider>
    );

    const { rerender } = render(tree({}));
    // A context identity the provider has not resolved yet, which is an input
    // the checks have to read again.
    rerender(tree({}));

    expect(reports).toHaveLength(2);
  });

  it('publishes the set a re-render hands it', () => {
    const store = storeAt('v1');
    const shipped = store.snapshot({ targetingKey: 'u-9' });
    const context = { targetingKey: 'u-9' };
    const { rerender } = render(
      <FeatureProvider features={store} decisions={shipped} context={context}>
        <Cta />
      </FeatureProvider>,
    );

    rerender(
      <FeatureProvider
        features={store}
        decisions={{
          ...shipped,
          decisions: {
            cta: { ...shipped.decisions.cta, variant: 'blue' as const },
          },
        }}
        context={context}
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('publishes what it resolves when a re-render changes the policy', () => {
    const store = storeAt('v2');
    const shipped = shippedBlue('v1');
    const context = { targetingKey: 'u-9' };
    const { rerender } = render(
      <FeatureProvider features={store} decisions={shipped} context={context}>
        <Cta />
      </FeatureProvider>,
    );

    rerender(
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={context}
        onVersionMismatch="re-resolve"
      >
        <Cta />
      </FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('control');
  });
  it('delivers to an observer installed after the mount', () => {
    const store = createFeatures(SPLIT);
    // A store built from a literal carries no version, so every pass of the
    // checks sends exactly one report.
    const shipped = {
      ...store.snapshot({ targetingKey: 'u-9' }),
      version: 'v1',
    };
    const seen: DivergenceReport[] = [];
    // One context identity across both renders, so the observer's arrival is
    // the only input the checks read that changed. A fresh literal each render
    // recomputes the pass for the context and reports whether the provider
    // reads the observer's presence or not.
    const context = { targetingKey: 'u-9' };
    // A gate an application opens once consent lands, or a reporter it
    // imports lazily.
    const tree = (onDivergence?: DivergenceObserver) => (
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={context}
        onDivergence={onDivergence}
      >
        <Cta />
      </FeatureProvider>
    );

    const { rerender } = render(tree());
    rerender(tree((report) => seen.push(report)));

    expect(seen.map((report) => report.kind)).toEqual(['unversioned']);
  });

  it('delivers to the observer the last render installed', () => {
    const store = createFeatures(SPLIT);
    const shipped = {
      ...store.snapshot({ targetingKey: 'u-9' }),
      version: 'v1',
    };
    const first: DivergenceReport[] = [];
    const second: DivergenceReport[] = [];
    // A fresh context identity each render, which is an input the checks read
    // again.
    const tree = (onDivergence: DivergenceObserver) => (
      <FeatureProvider
        features={store}
        decisions={shipped}
        context={{ targetingKey: 'u-9' }}
        onDivergence={onDivergence}
      >
        <Cta />
      </FeatureProvider>
    );

    const { rerender } = render(tree((report) => first.push(report)));
    rerender(tree((report) => second.push(report)));

    expect(first.map((report) => report.kind)).toEqual(['unversioned']);
    expect(second.map((report) => report.kind)).toEqual(['unversioned']);
  });
});

describe('createFeatureContext', () => {
  it('publishes the shipped set through the bound provider', () => {
    const bound = createFeatureContext(storeAt('v1'));

    render(
      <bound.FeatureProvider
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
      >
        <Cta />
      </bound.FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('reports the two versions through the bound provider', () => {
    const bound = createFeatureContext(storeAt('v1'));
    const reports: DivergenceReport[] = [];

    render(
      <bound.FeatureProvider
        decisions={shippedBlue('v2')}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </bound.FeatureProvider>,
    );

    expect(
      reports.filter((report) => report.kind === 'config-version'),
    ).toMatchObject([{ shipped: { version: 'v2' }, local: { version: 'v1' } }]);
  });

  it('compares the substituted store version and not the factory store one', () => {
    const bound = createFeatureContext(storeAt('v1'));
    const reports: DivergenceReport[] = [];

    render(
      <bound.FeatureProvider
        features={storeAt('v2')}
        decisions={storeAt('v2').snapshot({ targetingKey: 'u-9' })}
        context={{ targetingKey: 'u-9' }}
        onDivergence={(report) => reports.push(report)}
      >
        <Cta />
      </bound.FeatureProvider>,
    );

    expect(reports).toEqual([]);
  });

  it('renders the shipped set through the bound provider on a mismatch', () => {
    // The bound provider states no policy of its own, so this holds the
    // default both providers answer a mismatch with.
    const bound = createFeatureContext(storeAt('v2'));

    render(
      <bound.FeatureProvider
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
      >
        <Cta />
      </bound.FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('blue');
  });

  it('renders what the bound provider resolves itself under re-resolve', () => {
    const bound = createFeatureContext(storeAt('v2'));

    render(
      <bound.FeatureProvider
        decisions={shippedBlue('v1')}
        context={{ targetingKey: 'u-9' }}
        onVersionMismatch="re-resolve"
      >
        <Cta />
      </bound.FeatureProvider>,
    );

    expect(screen.getByTestId('cta')).toHaveTextContent('control');
  });
});
