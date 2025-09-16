import * as React from 'react';
import { ProviderArray } from './Compose.types';

// Props for the ComposeProvider component
interface ComposeProviderProps {
  providers: ProviderArray;
  children: React.ReactNode;
}

// Legacy support for 'components' prop (deprecated)
interface LegacyComposeProviderProps {
  components: ProviderArray;
  children: React.ReactNode;
}

export const ComposeProvider: React.FC<
  ComposeProviderProps | LegacyComposeProviderProps
> = (props) => {
  const { children, components, providers } = props as any;
  const providerList = providers || components;

  return (
    <>
      {providerList
        .slice()
        .reverse()
        .reduce((acc: React.ReactNode, curr: any) => {
          const [ProviderComponent, providerProps] = Array.isArray(curr)
            ? [curr[0], curr[1]]
            : [curr, {}];

          return (
            <ProviderComponent {...providerProps}>{acc}</ProviderComponent>
          );
        }, children)}
    </>
  );
};
