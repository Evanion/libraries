import { docsHref } from '../../../tools/docs-path.mjs';
import type { ProductPage } from '../types';

const page: ProductPage = {
  slug: 'rendering',
  group: 'rendering',
  packageName: '@evanion/widget',
  draft: false,
  docsLink: 'Read the docs',
  anchors: {
    '@evanion/react-widget': 'typos',
    '@evanion/astro-widget': 'astro',
  },
  metadata: {
    title: 'Pages as data, checked before they ship',
    description: 'Validate and render pages stored as data in React and Astro.',
  },
  hero: {
    promise:
      'Pages stored as data, checked before they ship, and rendered in React or Astro.',
    line: 'You get a page that is checked for errors before it goes live and drawn by whichever runtime your site uses.',
    definition:
      'A block is one part of a page containing its type, props, and optional child blocks, and the CMS saves a list of these blocks.',
    demoLabel:
      'The React renderer draws this page from the list of blocks below; move a block up or down and the page is composed again.',
    install: 'npm install @evanion/react-widget',
    installs: [
      { label: 'React', command: 'npm install @evanion/react-widget' },
      { label: 'Astro', command: 'npm install @evanion/astro-widget' },
    ],
    demo: 'data',
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
  facts: [
    {
      title: 'Your own CMS',
      text: 'You bring your own CMS or database to provide the list of blocks.',
    },
    {
      title: 'Multi-runtime rendering',
      text: 'One block list renders in both React and Astro.',
    },
    {
      title: 'No dependencies',
      text: 'The core library has no dependencies to install or update.',
      link: { label: 'The core', href: docsHref('widget/') },
    },
    {
      title: 'Server component ready',
      text: 'The React package works in React Server Components.',
    },
  ],
  scenes: [
    {
      id: 'validate',
      title: 'Catch a broken page before it ships',
      lede: 'You prevent layout failures by checking your data before it reaches the browser.',
      why: 'An editor renames a block type or leaves a required field empty and the CMS saves it. The renderer skips what it cannot draw and renders the rest, printing one warning in development and staying silent in production. This gap is easy to miss.',
      how: 'You call `validateItems` in a build script or webhook to find unknown types, blank required fields, or duplicate ids, with each problem naming the block. The function never throws. In Astro, you run this in a script before the build so any problem fails the build.',
      differs:
        'You get a full list of every problem in your block tree in one pass.',
      demo: {
        id: 'widget-validate',
        caption:
          'The problem list shows what `validateItems` finds, and the page below it shows what the React renderer draws if the check is skipped.',
      },
      howItWorks: {
        label: 'Learn how to fail the Astro build on validation errors',
        href: docsHref('astro-widget/validation/'),
      },
    },
    {
      id: 'typos',
      title: 'Stop typos at compile time',
      lede: 'You catch coding errors while you write your components.',
      why: 'A mistyped block type or a wrong prop in the code breaks the page.',
      how: 'The React package checks every block and child block against the component props at compile time.',
      differs:
        'The editor underlines the mistake while you type, and the check on the saved page covers the data the compiler cannot see.',
      sample: {
        install: 'npm install @evanion/react-widget',
        file: 'libs/react-widget/docs/examples.md',
        region: 'react-landing',
      },
      howItWorks: {
        label: 'Read about defining blocks and nesting in React',
        href: docsHref('react-widget/nesting/'),
      },
    },
    {
      id: 'astro',
      title: 'Zero JavaScript for layout in Astro',
      lede: 'The server decides the arrangement of the page.',
      why: 'The browser receives plain HTML for the page structure.',
      how: 'The Astro package renders the block list to HTML on the server, and your own interactive components still ship their own code.',
      howItWorks: {
        label: 'See how to manage block order and nesting in Astro',
        href: docsHref('astro-widget/layout/'),
      },
    },
  ],
  limits: {
    title: 'Scope and boundaries',
    items: [
      {
        title: 'No editor',
        text: 'The library provides no editor; you bring your own CMS or database.',
        link: { label: 'Read the core overview', href: docsHref('widget/') },
      },
      {
        title: 'Astro prop checking',
        text: 'Astro has no compile-time prop checking, so you use `validateItems` with `required` to guard your data.',
        link: {
          label: 'Setup the Astro build gate',
          href: docsHref('astro-widget/validation/'),
        },
      },
      {
        title: 'Meta validation',
        text: 'The library does not validate `meta` properties at runtime.',
        link: {
          label: 'See what the validator reports',
          href: docsHref('widget/problems/'),
        },
      },
    ],
  },
  faq: [
    {
      q: 'What is this library?',
      a: 'It is a system to validate and render pages stored as a list of blocks. The core handles validation, the React package provides a React renderer, and the Astro package provides an Astro renderer.',
    },
    {
      q: 'Does it include a CMS editor?',
      a: 'No, you use your own CMS or database to save the blocks.',
    },
    {
      q: 'Where does validation run in Astro?',
      a: 'You run the check in a script before the build process; the script exits non-zero on any problem and stops the build.',
    },
    {
      q: 'Do the same blocks render in React and Astro?',
      a: 'Yes, the same block array renders through either package.',
    },
    {
      q: 'What happens when a block is bad at render time?',
      a: 'The renderer skips the bad block and renders the rest of the page. It prints one warning in development and stays silent in production, which is why the check runs before shipping.',
    },
  ],
  closing: {
    title: 'Start building',
    text: 'Choose your framework to begin. Use the guides to set up your first renderer.',
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
