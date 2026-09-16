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
      title: 'Small TypeScript libraries, one problem each.',
      line: 'Each one solves a problem you would otherwise solve by hand, and stops there. No framework to adopt, no configuration to learn. Install the one you need and it works on its own.',
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
