import { Context } from 'react';

export type WidgetProps<Type extends string, Props = object> = {
  id: string;
  type: Type;
  props: Props;
  children?: WidgetProps<string>[];
};

export type WidgetComponent<
  Items extends Record<string, WidgetProps<string>>,
  Type extends keyof Items
> = React.ComponentType<any>;

export type WidgetsConfig<Items extends Record<string, WidgetProps<string>>> = {
  components: Record<string, React.ComponentType<any>>;
  chrome?: {
    wrapper?: React.ComponentType<any>;
    item?: React.ComponentType<any>;
  };
  context?: Context<any>;
};

export type WidgetsProps<
  Items extends Record<string, WidgetProps<string>>,
  Config extends WidgetsConfig<Items> = WidgetsConfig<Items>
> = Partial<Config> & {
  items: WidgetProps<string>[];
};
