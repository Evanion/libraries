import { docsHref } from '../../../tools/docs-path.mjs';
import type { ProductPage } from '../types';

const page: ProductPage = {
  slug: 'rendering',
  group: 'rendering',
  packageName: '@evanion/widget',
  draft: false,
  docsLink: 'Read the docs',
  anchors: {
    '@evanion/react-widget': 'react',
    '@evanion/astro-widget': 'astro',
  },
  metadata: {
    title: 'Pages as data, checked before they ship',
    description:
      'Validate your page data before it ships and render it in React or Astro using a single item model.',
  },
  hero: {
    promise:
      'Pages stored as data, checked before they ship. Rendered in React or Astro.',
    line: 'Your CMS saves a list of items. The library checks the data for errors. React or Astro draws the page.',
    sub: 'One item list renders in both React and Astro.',
    install: 'npm install @evanion/react-widget',
    demo: 'data',
    actions: [
      {
        label: 'Get started',
        href: docsHref('react-widget/getting-started/'),
      },
      {
        label: 'npm',
        href: 'https://www.npmjs.com/package/@evanion/react-widget',
      },
      {
        label: 'GitHub',
        href: 'https://github.com/Evanion/libraries/tree/main/libs/widget',
      },
    ],
  },
  facts: [
    {
      title: 'Bring your own CMS',
      text: 'The library takes the list of items your CMS saves. No editor is included.',
    },
    {
      title: 'One item list, two runtimes',
      text: 'The same item array renders through the React package and the Astro package.',
    },
    {
      title: 'Zero-dependency core',
      text: 'The core library has zero runtime and zero peer dependencies.',
      link: { label: 'The core', href: docsHref('widget/') },
    },
    {
      title: 'Server Component ready',
      text: "The React package imports from a React Server Component without a `'use client'` boundary.",
    },
  ],
  scenes: [
    {
      id: 'validate',
      title: 'Catch a broken page before it ships',
      lede: 'Stop bad data from reaching your users.',
      why: 'The CMS saves a page. An editor renames a block type or leaves a required field empty. The page goes live with a gap nobody sees because production renderers skip the bad block silently.',
      how: 'You call `validateItems`. It reports unknown types, blank required fields, and duplicate IDs against the named item. The function never throws.',
      differs:
        'A problem list naming each item. This runs in a script, a webhook, or CI.',
      demo: {
        id: 'widget-validate',
        caption:
          'In Astro, this check runs before the build. A problem makes the script exit and the build fails.',
      },
      howItWorks: {
        label: 'Learn about the Astro build gate',
        href: docsHref('astro-widget/validation/'),
      },
    },
    {
      id: 'typos',
      title: 'Typos caught in your editor',
      lede: 'Use the type system to guard your props.',
      why: 'A mistyped type or a wrong prop type in code only shows when the page renders.',
      how: "The React package checks every item's props against the component. This includes nested children. A mistyped type is a compile error.",
      differs:
        'The editor underlines the mistake while the developer types. Data arriving from the CMS cannot be checked by the compiler, so the check on the saved page covers that side.',
      howItWorks: {
        label: 'Guide to nesting items in React',
        href: docsHref('react-widget/nesting/'),
      },
    },
    {
      id: 'astro',
      title: 'Zero JavaScript for layout in Astro',
      lede: 'Ship only the HTML your users need.',
      why: 'The layout is decided on the server when Astro builds or serves the page.',
      how: 'The browser receives HTML. The layout ships zero client-side JavaScript.',
      howItWorks: {
        label: 'Astro order and nesting',
        href: docsHref('astro-widget/layout/'),
      },
    },
    {
      id: 'fail-soft',
      title: 'One broken block never takes the page down',
      lede: 'Keep the rest of your page visible.',
      why: 'A single unknown widget type should not crash the entire render.',
      how: 'The renderers skip items they cannot draw. They render the rest of the page. A missing prop renders the block with that prop undefined, so `required` is the guard. A warning prints once in development. It is silent in production, which is why validation is the check before shipping.',
      howItWorks: {
        label: 'How bad saves render',
        href: docsHref('astro-widget/bad-items/'),
      },
    },
  ],
  limits: {
    title: 'Scope and Constraints',
    items: [
      {
        title: 'No editor',
        text: 'You bring your own CMS or database.',
        link: { label: 'Widget overview', href: docsHref('widget/') },
      },
      {
        title: 'Astro prop checking',
        text: 'Astro components expose no prop types. Use `validateItems` with `required` for your checks.',
        link: {
          label: 'Astro build gate guide',
          href: docsHref('astro-widget/validation/'),
        },
      },
      {
        title: 'Meta validation',
        text: 'The library does not validate `meta` at runtime.',
        link: {
          label: 'What validation reports',
          href: docsHref('widget/problems/'),
        },
      },
    ],
  },
  codeSample: {
    id: 'react',
    title: 'Type-safe React components',
    lede: 'See how `defineItems` flags mistyped types and props in your editor.',
    install: 'npm install @evanion/react-widget',
    file: 'libs/react-widget/docs/examples.md',
    region: 'react-landing',
    link: {
      label: 'React getting started',
      href: docsHref('react-widget/getting-started/'),
    },
  },
  faq: [
    {
      q: 'What is this library?',
      a: 'It is a system to render pages stored as item lists. It includes a core validator and renderers for React and Astro.',
    },
    {
      q: 'Does it include a CMS editor?',
      a: 'No. You provide the item list from your own CMS or database.',
    },
    {
      q: 'Where does validation run in Astro?',
      a: 'You run `validateItems` in a script before the build. Any problem makes the script exit non-zero and stops the build.',
    },
    {
      q: 'Can I use the same data for React and Astro?',
      a: 'Yes. One item array renders in both the React and Astro packages.',
    },
    {
      q: 'What happens if a block is bad at render time?',
      a: 'The renderer skips the bad item and draws the rest of the page. It prints one warning in development and stays silent in production.',
    },
  ],
  closing: {
    title:
      'Pages stored as data, checked before they ship. Rendered in React or Astro.',
    text: 'Store your pages as data in a CMS. Use a validator to catch errors before shipping. Render your items in React or Astro.',
    actions: [
      {
        label: 'Get started with React',
        href: docsHref('react-widget/getting-started/'),
      },
      {
        label: 'Get started with Astro',
        href: docsHref('astro-widget/getting-started/'),
      },
      {
        label: 'GitHub',
        href: 'https://github.com/Evanion/libraries/tree/main/libs/widget',
      },
    ],
  },
};

export default page;
