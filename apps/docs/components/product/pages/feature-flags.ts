import { docsHref } from '../../../tools/docs-path.mjs';
import type { ProductPage } from '../types';

const page: ProductPage = {
  slug: 'feature-flags',
  group: 'feature',
  packageName: '@evanion/feature',
  draft: true,
  metadata: {
    title: 'Feature flags from a document you own',
    description:
      'Define feature flags in a plain document and decide them in your API, your build and the browser with one library.',
  },
  hero: {
    promise: 'Feature flags from a document you own.',
    line: 'One library decides them in your API, your build and the browser.',
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
      title: 'Launch on a schedule',
      lede: 'Set the moment a feature turns on. Nobody has to deploy at 9am.',
      demo: 'schedule',
      caption:
        'The answer depends only on the time you ask about, so server and browser agree.',
      howItWorks: {
        label: 'How conditions work',
        href: docsHref('feature/configuration/'),
      },
    },
    {
      id: 'cascade',
      title: 'One switch, everything that depends on it',
      lede: 'Turn a feature off and the features built on it go with it. You see the list before you confirm.',
      demo: 'cascade',
      caption: 'Each feature says why it is off.',
      howItWorks: {
        label: 'How decisions work',
        href: docsHref('feature/decisions/'),
      },
    },
    {
      id: 'variants',
      title: 'A/B tests that stay put',
      lede: 'Change the split and only the visitors at the edge move. Pin a group to one variant.',
      demo: 'variants',
      caption: 'The same visitor always gets the same variant.',
      howItWorks: {
        label: 'How variants work',
        href: docsHref('feature/variants/'),
      },
    },
    {
      id: 'no-flicker',
      title: 'No flicker on load',
      lede: 'The page arrives with the right features already decided.',
      demo: 'no-flicker',
      caption:
        'The browser adopts what the server decided, so the first paint is already right.',
      howItWorks: {
        label: 'How hydration works',
        href: docsHref('feature/hydration/'),
      },
    },
  ],
  codeSample: {
    title: 'Use it in React',
    lede: 'Wrap your app once and ask any component whether a feature is on.',
    file: 'libs/react-feature/docs/examples.md',
    region: 'react-provider',
    link: { label: 'React docs', href: docsHref('react-feature/') },
  },
  install: { title: 'Install', command: 'npm install @evanion/feature' },
  next: {
    title: 'Next steps',
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
