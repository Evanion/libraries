import { Context, PropsWithChildren } from 'react';

export type WidgetProps<Type extends string, Props = object> = {
  id: string;
  type: Type;
  props: Props;
  children: WidgetProps<string>[];
};

export type WidgetComponent<
  Items extends Record<string, WidgetProps<string>>,
  Type extends keyof Items
> = React.ComponentType<Items[Type]['props']>;

export type WidgetsConfig<Items extends Record<string, WidgetProps<string>>> = {
  components: {
    [K in keyof Items]: WidgetComponent<Items, K>;
  };
  chrome?: {
    wrapper?: React.ComponentType<PropsWithChildren>;
    item?: React.ComponentType<PropsWithChildren>;
  };
  context?: Context<{
    [K in keyof Items]: WidgetComponent<Items, K>;
  }>;
};

export type WidgetsProps<
  Items extends Record<string, WidgetProps<string>>,
  Config extends WidgetsConfig<Items> = WidgetsConfig<Items>
> = Partial<Config> & {
  items: WidgetProps<string>[];
};
