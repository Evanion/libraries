import { defineItems } from './region';

/**
 * The landing page, as data.
 *
 * One item per section, top to bottom. `type` names the component in
 * `region.tsx` that renders it, `props` is what that component takes, and
 * `meta` is where the chrome puts it. The package groups themselves -- which
 * packages, in what order, under what heading -- come from `app/navigation.ts`,
 * so an item names a group and the section reads the rest.
 *
 * `defineItems` supplies the contextual type: an unknown `type`, a prop the
 * component does not take, or a `meta` key the chrome does not read fails the
 * build rather than rendering a section somewhere its author did not choose.
 */
export const items = defineItems([
  {
    id: 'hero',
    type: 'hero',
    props: {
      title: 'Standard solutions for repeated infrastructure pains.',
      line: 'Stop re-solving authorization, identifiers, and dynamic layouts from scratch in every project. Our small, focused libraries solve these specific problems once, so you can focus on your product.',
    },
    meta: { ground: 'felt' },
  },
  {
    id: 'rendering',
    type: 'pair',
    props: { group: 'rendering' },
  },
  {
    id: 'acl',
    type: 'pair',
    props: { group: 'acl' },
    meta: { rule: true },
  },
  {
    id: 'identifiers',
    type: 'cards',
    props: { group: 'identifiers' },
    meta: { rule: true },
  },
  {
    id: 'standalone',
    type: 'rows',
    props: { group: 'standalone' },
    meta: { rule: true },
  },
  {
    id: 'elsewhere',
    type: 'elsewhere',
    props: {},
    meta: { rule: true },
  },
]);
