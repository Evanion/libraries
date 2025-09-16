import { ComponentType, PropsWithChildren } from 'react';

// Base provider component type that accepts children
export type ProviderComponent<T = Record<string, never>> = ComponentType<PropsWithChildren<T>>;

// Provider can be either a component or a tuple with props
export type Provider<T = Record<string, never>> = ProviderComponent<T> | [ProviderComponent<T>, T];

// More flexible provider array type - using any for now to avoid complex type issues
export type ProviderArray = readonly Provider<any>[];

// Utility function to create a provider with props (for better type inference)
export function createProvider<T extends ProviderComponent<any>>(
  component: T,
  props: T extends ProviderComponent<infer P> ? P : never
): [T, T extends ProviderComponent<infer P> ? P : never] {
  return [component, props];
}

// Type-safe provider builder
export class ProviderBuilder {
  private providers: Provider<any>[] = [];

  add<T extends ProviderComponent<any>>(component: T): ProviderBuilder;
  add<T extends ProviderComponent<any>>(
    component: T,
    props: T extends ProviderComponent<infer P> ? P : never
  ): ProviderBuilder;
  add<T extends ProviderComponent<any>>(
    component: T,
    props?: T extends ProviderComponent<infer P> ? P : never
  ): ProviderBuilder {
    if (props) {
      this.providers.push([component, props]);
    } else {
      this.providers.push(component);
    }
    return this;
  }

  build(): readonly Provider<any>[] {
    return this.providers;
  }
}

// Convenience function to create a provider builder
export function createProviderBuilder(): ProviderBuilder {
  return new ProviderBuilder();
}
