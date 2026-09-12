import { describe, it, expectTypeOf } from 'vitest';
import type { PropsWithChildren } from 'react';
import { createWidgets } from './index.js';
import type { WidgetItem, WidgetDataProps } from './index.js';

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

  it('rejects `children` on a component that does not accept children (#25.2)', () => {
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
