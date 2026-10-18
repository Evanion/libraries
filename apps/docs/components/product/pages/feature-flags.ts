import { docsHref } from '../../../tools/docs-path.mjs';
import type { ProductPage } from '../types';

const page: ProductPage = {
  slug: 'feature-flags',
  group: 'feature',
  packageName: '@evanion/feature',
  draft: false,
  frontpageLink: 'See what it does',
  metadata: {
    title: 'Feature flags from a document you own',
    description:
      'Define your features in a plain document. Decide them in your API, your build, and the browser with one library.',
  },
  hero: {
    promise: 'Feature flags from a document you own.',
    line: 'One library decides them in your API, your build, and the browser.',
    demo: 'rollout',
    actions: [
      { label: 'Get started', href: docsHref('feature/getting-started/') },
      { label: 'npm', href: 'https://www.npmjs.com/package/@evanion/feature' },
      {
        label: 'GitHub',
        href: 'https://github.com/Evanion/libraries/tree/main/libs/feature',
      },
    ],
  },
  scenes: [
    {
      id: 'schedule',
      title: 'Launch while you sleep',
      lede: 'Pick the moment a feature turns on. After 09:00, it becomes available for everyone without a new deploy.',
      demo: 'schedule',
      caption:
        'Server and browser always agree because the answer depends only on the time.',
      howItWorks: {
        label: 'See how timing works',
        href: docsHref('feature/configuration/'),
      },
    },
    {
      id: 'cascade',
      title: 'Stop the domino effect',
      lede: 'Turn off a core feature and everything built on top of it follows. You get a full list of what will disappear before you commit.',
      demo: 'cascade',
      caption: 'Every disabled feature explains exactly why it is off.',
      howItWorks: {
        label: 'See how dependencies work',
        href: docsHref('feature/decisions/'),
      },
    },
    {
      id: 'variants',
      title: "Tests that don't jump",
      lede: 'Adjust your visitor split without shuffling everyone. Pin specific groups to a version to keep things consistent.',
      demo: 'variants',
      caption:
        'A visitor always sees the same version unless you move the boundary.',
      howItWorks: {
        label: 'See how splitting works',
        href: docsHref('feature/variants/'),
      },
    },
    {
      id: 'no-flicker',
      title: 'No flicker on load',
      lede: 'Stop the awkward flash of old content. Your page arrives with the right features already decided.',
      demo: 'no-flicker',
      caption:
        "The browser adopts the server's decision so the first paint is already the new checkout.",
      howItWorks: {
        label: 'See how loading works',
        href: docsHref('feature/hydration/'),
      },
    },
  ],
  codeSample: {
    title: 'Simple setup for React',
    lede: 'Wrap your app once. Any component can then ask if a feature is on.',
    install: 'npm install @evanion/feature @evanion/react-feature',
    file: 'libs/react-feature/docs/examples.md',
    region: 'react-provider',
    link: { label: 'Read the guide', href: docsHref('react-feature/') },
  },
  install: { title: 'Installation', command: 'npm install @evanion/feature' },
  next: {
    title: 'Ready to build?',
    links: [
      { label: 'Getting started', href: docsHref('feature/getting-started/') },
      { label: 'API reference', href: docsHref('feature/api/') },
      {
        label: 'GitHub',
        href: 'https://github.com/Evanion/libraries/tree/main/libs/feature',
      },
    ],
  },
};

export default page;
