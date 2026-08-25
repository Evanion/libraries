import { describe, it, expectTypeOf } from 'vitest';
import { createWidgets } from './index';
import type { WidgetItem, WidgetDataProps } from './index';

const News = ({ title, body }: { title: string; body: string }) => (
  <article>
    {title}
    {body}
  </article>
);

const Weather = ({ celsius }: { celsius: number }) => <span>{celsius}</span>;

const Nested = ({ Output }: { label: string; Output: React.ComponentType }) => (
  <div>
    <Output />
  </div>
);

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

  it('excludes the injected Output prop from item data', () => {
    type NestedItem = Extract<WidgetItem<Components>, { type: 'nested' }>;
    expectTypeOf<NestedItem['props']>().toEqualTypeOf<{ label: string }>();
    expectTypeOf<WidgetDataProps<typeof Nested>>().toEqualTypeOf<{
      label: string;
    }>();
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
