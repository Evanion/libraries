import { describe, it, expectTypeOf } from 'vitest';
import { memo } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';
import { createWidgets } from './index.js';
import type {
  WidgetItem,
  WidgetDataProps,
  WidgetItemComponent,
} from './index.js';

const News = ({ title, body }: { title: string; body: string }) => (
  <article>
    {title}
    {body}
  </article>
);

const Weather = ({ celsius }: { celsius: number }) => <span>{celsius}</span>;

const Nested = ({ label, children }: PropsWithChildren<{ label: string }>) => (
  <div>
    {label}
    {children}
  </div>
);

const Nada = () => <span />;

const components = { news: News, weather: Weather, nested: Nested };
type Components = typeof components;

describe('widget type inference', () => {
  it('constrains `type` to the keys of the component map', () => {
    expectTypeOf<WidgetItem<Components>['type']>().toEqualTypeOf<
      'news' | 'weather' | 'nested'
    >();
  });

  it('correlates `props` with the component named by `type`', () => {
    type NewsItem = Extract<WidgetItem<Components>, { type: 'news' }>;
    expectTypeOf<NewsItem['props']>().toEqualTypeOf<{
      title: string;
      body: string;
    }>();

    type WeatherItem = Extract<WidgetItem<Components>, { type: 'weather' }>;
    expectTypeOf<WeatherItem['props']>().toEqualTypeOf<{ celsius: number }>();
  });

  it('excludes `children` from item props, because it comes from `children`', () => {
    type NestedItem = Extract<WidgetItem<Components>, { type: 'nested' }>;
    expectTypeOf<NestedItem['props']>().toEqualTypeOf<{ label: string }>();
    expectTypeOf<WidgetDataProps<typeof Nested>>().toEqualTypeOf<{
      label: string;
    }>();
  });

  it('types `children` as never on a component that does not accept them', () => {
    type WeatherItem = Extract<WidgetItem<Components>, { type: 'weather' }>;
    expectTypeOf<WeatherItem['children']>().toEqualTypeOf<undefined>();

    type NestedItem = Extract<WidgetItem<Components>, { type: 'nested' }>;
    expectTypeOf<NestedItem['children']>().toEqualTypeOf<
      WidgetItem<Components>[] | undefined
    >();
  });

  it('rejects an unknown widget type', () => {
    const { defineItems } = createWidgets({ components });

    defineItems([
      { id: '1', type: 'news', props: { title: 'a', body: 'b' } },
      // @ts-expect-error 'nope' is not a key of the component map
      { id: '2', type: 'nope', props: {} },
    ]);
  });

  it('rejects props that do not match the named component', () => {
    const { defineItems } = createWidgets({ components });

    defineItems([
      // @ts-expect-error celsius must be a number, not a string
      { id: '1', type: 'weather', props: { celsius: 'warm' } },
    ]);

    defineItems([
      // @ts-expect-error `body` is required by the news component
      { id: '2', type: 'news', props: { title: 'only a title' } },
    ]);
  });

  it('rejects `children` on a component that does not accept children', () => {
    const { defineItems } = createWidgets({ components });

    defineItems([
      {
        id: '1',
        type: 'weather',
        props: { celsius: 21 },
        // @ts-expect-error the weather component has no `children` prop, so
        // nesting under it would silently drop the child items
        children: [{ id: '2', type: 'news', props: { title: 'a', body: 'b' } }],
      },
    ]);
  });

  it('checks nested children against the same map', () => {
    const { defineItems } = createWidgets({ components });

    defineItems([
      {
        id: '1',
        type: 'nested',
        props: { label: 'outer' },
        children: [
          // @ts-expect-error nested children are checked too
          { id: '2', type: 'nope', props: {} },
        ],
      },
    ]);
  });

  it('accepts arbitrary `meta` on any item', () => {
    const { defineItems } = createWidgets({ components });

    const items = defineItems([
      {
        id: '1',
        type: 'weather',
        props: { celsius: 21 },
        meta: { column: 1, columnSpan: 4 },
      },
    ]);

    expectTypeOf(items).toEqualTypeOf<WidgetItem<Components>[]>();
  });

  it('checks props on a component that declares none', () => {
    // `{}` accepts any object without an excess-property check, so a zero-prop
    // component is where prop checking is easiest to lose.
    expectTypeOf<WidgetDataProps<typeof Nada>>().toEqualTypeOf<
      Record<string, never>
    >();

    const { defineItems } = createWidgets({ components: { nada: Nada } });

    defineItems([{ id: '1', type: 'nada', props: {} }]);

    defineItems([
      // @ts-expect-error the nada component accepts no props at all
      { id: '2', type: 'nada', props: { totally: 'bogus' } },
    ]);
  });

  it('accepts a well-formed set', () => {
    const { defineItems } = createWidgets({ components });

    const items = defineItems([
      { id: '1', type: 'news', props: { title: 'a', body: 'b' } },
      {
        id: '2',
        type: 'nested',
        props: { label: 'outer' },
        children: [{ id: '3', type: 'weather', props: { celsius: 21 } }],
      },
    ]);

    expectTypeOf(items).toEqualTypeOf<WidgetItem<Components>[]>();
  });
});

/**
 * The `meta` vocabulary a dashboard chrome reads: a closed set of lanes and an
 * optional span. `lane_` below is the typo #141 is about -- against an untyped
 * `meta` it compiles, renders, and places the item somewhere its author did not
 * choose.
 */
interface DashMeta {
  lane: 'main' | 'aside' | 'full';
  span?: number;
}

const Cell: WidgetItemComponent<DashMeta> = ({ children }) => (
  <div>{children}</div>
);

describe('meta typing', () => {
  it('infers M from an annotated chrome.item, with no type argument', () => {
    const { defineItems } = createWidgets({
      components,
      chrome: { item: Cell },
    });

    const items = defineItems([
      {
        id: '1',
        type: 'weather',
        props: { celsius: 21 },
        meta: { lane: 'aside', span: 4 },
      },
    ]);

    expectTypeOf(items).toEqualTypeOf<WidgetItem<Components, DashMeta>[]>();
  });

  it('rejects a misspelled meta key', () => {
    const { defineItems } = createWidgets({
      components,
      chrome: { item: Cell },
    });

    defineItems([
      {
        id: '1',
        type: 'weather',
        props: { celsius: 21 },
        // @ts-expect-error `lane` is the key this chrome reads; `lane_` is not,
        // and an item carrying it would be placed by the fallback instead
        meta: { lane_: 'aside' },
      },
    ]);
  });

  it('rejects a misspelled meta key inside children', () => {
    const { defineItems } = createWidgets({
      components,
      chrome: { item: Cell },
    });

    defineItems([
      {
        id: '1',
        type: 'nested',
        props: { label: 'outer' },
        children: [
          {
            id: '2',
            type: 'weather',
            props: { celsius: 21 },
            // @ts-expect-error nested items carry the same vocabulary
            meta: { lane_: 'aside' },
          },
        ],
      },
    ]);
  });

  it('rejects a wrong value and an excess key in meta', () => {
    const { defineItems } = createWidgets({
      components,
      chrome: { item: Cell },
    });

    defineItems([
      {
        id: '1',
        type: 'weather',
        props: { celsius: 21 },
        // @ts-expect-error 'middle' is not one of the lanes the bed declares
        meta: { lane: 'middle' },
      },
    ]);

    defineItems([
      {
        id: '2',
        type: 'weather',
        props: { celsius: 21 },
        // @ts-expect-error `columnSpan` belongs to no vocabulary this set reads
        meta: { lane: 'main', columnSpan: 4 },
      },
    ]);
  });

  it('infers M from a plain function with an annotated parameter object', () => {
    const Inline = ({
      children,
      meta,
    }: {
      children?: ReactNode;
      'data-widget-id': string;
      'data-widget-type': string;
      meta?: DashMeta;
    }) => <div data-lane={meta?.lane}>{children}</div>;

    const { defineItems } = createWidgets({
      components,
      chrome: { item: Inline },
    });

    defineItems([
      {
        id: '1',
        type: 'weather',
        props: { celsius: 21 },
        // @ts-expect-error inference reaches through an inline annotation
        meta: { lane_: 'aside' },
      },
    ]);
  });

  it('infers M through memo()', () => {
    const Memoised = memo(function Memoised({
      children,
      meta,
    }: {
      children?: ReactNode;
      'data-widget-id': string;
      'data-widget-type': string;
      meta?: DashMeta;
    }) {
      return <div data-lane={meta?.lane}>{children}</div>;
    });

    const { defineItems } = createWidgets({
      components,
      chrome: { item: Memoised },
    });

    defineItems([
      {
        id: '1',
        type: 'weather',
        props: { celsius: 21 },
        // @ts-expect-error memo() does not hide the vocabulary
        meta: { lane_: 'aside' },
      },
    ]);
  });

  it('falls back to any object for an unannotated chrome.item', () => {
    // No annotation anywhere, so there is no vocabulary to check against and
    // the set behaves as it did before meta was typed.
    const Bare = ({ children }: PropsWithChildren) => <div>{children}</div>;

    const { defineItems } = createWidgets({
      components,
      chrome: { item: Bare },
    });

    const items = defineItems([
      {
        id: '1',
        type: 'weather',
        props: { celsius: 21 },
        meta: { anything: 'at all' },
      },
    ]);

    expectTypeOf(items).toEqualTypeOf<WidgetItem<Components>[]>();
  });

  it('accepts any meta when the set has no chrome at all', () => {
    const { defineItems } = createWidgets({ components });

    const items = defineItems([
      {
        id: '1',
        type: 'weather',
        props: { celsius: 21 },
        meta: { column: 1, columnSpan: 4 },
      },
    ]);

    expectTypeOf(items).toEqualTypeOf<WidgetItem<Components>[]>();
  });

  it('holds a per-instance chrome to the factory vocabulary', () => {
    const Other: WidgetItemComponent<{ align: 'end' }> = ({ children }) => (
      <div>{children}</div>
    );

    const { Widgets } = createWidgets({ components, chrome: { item: Cell } });

    // A per-instance wrapper is free; it reads no meta.
    const wrapperOverride = (
      <Widgets
        chrome={{ wrapper: ({ children }) => <div>{children}</div> }}
        items={[]}
      />
    );
    expectTypeOf(wrapperOverride).toMatchTypeOf<ReactNode>();

    const itemOverride = (
      <Widgets
        // @ts-expect-error the set's items were checked against DashMeta, so an
        // instance cannot swap in a chrome reading a different vocabulary
        chrome={{ item: Other }}
        items={[]}
      />
    );
    expectTypeOf(itemOverride).toMatchTypeOf<ReactNode>();
  });

  it('does not make the item union too complex to represent', () => {
    // TS2590 is what RenderableWidgetItem exists to avoid. `meta?: M` adds no
    // members to the union, so a wide map stays representable.
    const wide = {
      a: News,
      b: News,
      c: News,
      d: News,
      e: News,
      f: News,
      g: News,
      h: News,
      i: News,
      j: News,
      k: News,
      l: News,
      m: News,
      n: News,
      o: News,
      p: News,
      q: News,
      r: News,
      s: News,
      t: News,
    };

    const { defineItems } = createWidgets({
      components: wide,
      chrome: { item: Cell },
    });

    const items = defineItems([
      {
        id: '1',
        type: 't',
        props: { title: 'a', body: 'b' },
        meta: { lane: 'full' },
      },
    ]);

    expectTypeOf(items).toEqualTypeOf<WidgetItem<typeof wide, DashMeta>[]>();
  });
});
