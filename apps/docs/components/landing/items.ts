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
 *
 * The "Rendering from data" section serialises this list and shows it beside
 * the sections it placed, so what is written here is what a reader sees.
 */
export const items = defineItems([
  {
    id: 'hero',
    type: 'hero',
    props: {
      title: 'Small TypeScript libraries, one problem each.',
      line: 'Documentation for the packages in the Evanion/libraries monorepo. Each is installed on its own. The index is grouped by the problem a package solves, and each entry says what stack it runs in.',
    },
    meta: { ground: 'felt' },
  },
  {
    id: 'rendering',
    type: 'pair',
    props: { group: 'rendering' },
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
    id: 'colophon',
    type: 'colophon',
    props: {},
    meta: { rule: true },
  },
]);
