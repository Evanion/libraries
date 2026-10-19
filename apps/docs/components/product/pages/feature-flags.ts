import { docsHref } from '../../../tools/docs-path.mjs';
import type { ProductPage } from '../types';

const page: ProductPage = {
  slug: 'feature-flags',
  group: 'feature',
  packageName: '@evanion/feature',
  draft: false,
  docsLink: 'Read the docs',
  anchors: { '@evanion/react-feature': 'react' },
  metadata: {
    title: 'Feature flags your build can decide',
    description:
      'Decouple release from deployment. A feature flag library that decides what it can at build time, with your flags in a file in your own repo.',
  },
  hero: {
    promise: 'Feature flags your build can decide',
    line: 'The build decides every flag it can before deploy, and only flags that depend on the visitor wait. Decouple release from deployment.',
    sub: 'Your flags live in your repo as a file, changed in the same pull request as your code.',
    install: 'npm install @evanion/feature',
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
  facts: [
    {
      title: 'A file in your own repo',
      text: "Your flags are a file in your app's own repo. You change them in the same pull request as the code that uses them and review them like code.",
    },
    {
      title: 'No network call per check',
      text: 'Your API, your build and the browser answer flags by themselves.',
    },
    {
      title: 'Update flags without a deploy',
      text: 'Serve the file as a plain asset and reload it in the running app.',
      link: {
        label: 'How reloading works',
        href: docsHref('feature/distribution/'),
      },
    },
    {
      title: 'No dashboard included',
      text: 'This is a library. You decide how your team edits the flag file.',
    },
  ],
  scenes: [
    {
      id: 'cascade',
      title: 'Stop the domino effect',
      lede: 'Your customers never see a feature whose foundation is gone.',
      why: 'New features often rely on older ones. Turning off a foundation feature can leave dependent features in a broken state.',
      how: 'You can make features depend on one another. Before you commit, the toggle lists exactly what will go off. After the change, each feature says why it is off.',
      differs:
        'Other tools may document dependencies, but none of the tools we compared shows a preview of what will go off before you commit.',
      demo: {
        id: 'cascade',
        caption:
          'A preview shows that disabling the checkout foundation also disables express pickup.',
      },
      howItWorks: {
        label: 'See how dependencies work',
        href: docsHref('feature/decisions/'),
      },
    },
    {
      id: 'variants',
      title: "Tests that don't jump",
      lede: 'Run clean A/B tests where visitors stay in their assigned group.',
      why: 'Shuffling people between versions mid-test ruins your data and confuses your users.',
      how: 'Visitors who keep their ID keep their variant when you move a two-way split. Only those between the old and new boundary change. You can also pin a specific group to one variant.',
      differs:
        'Every flag tool needs a stable visitor ID. Some also store which variant each visitor got to keep splits stable. This library does not need that: no assignment stored.',
      demo: {
        id: 'variants',
        caption:
          'A visitor always sees the same version unless you move the split. The line under the slider counts who sees blue and who changed.',
      },
      howItWorks: {
        label: 'See how splitting works',
        href: docsHref('feature/variants/'),
      },
    },
    {
      id: 'schedule',
      title: 'Launch while you sleep',
      lede: 'Set your release date and forget it.',
      why: 'You want to coordinate a big launch without being awake to flip a switch or trigger a deployment.',
      how: 'A rule turns a feature on after the time you choose. Because the decision depends only on the clock, the server and browser always stay in sync.',
      howItWorks: {
        label: 'See how it works',
        href: docsHref('feature/configuration/#time-windows'),
      },
    },
    {
      id: 'no-flicker',
      title: 'No flicker on load',
      lede: 'Eliminate the jarring visual jump on page load.',
      why: 'Pages that decide flags only in the browser often show a default version for a split second before swapping to the correct one.',
      how: "The server decides the flags and sends those decisions inside the page. The browser uses them before the first paint and can check the server's decisions against its own copy to report differences.",
      howItWorks: {
        label: 'See how it works',
        href: docsHref('feature/hydration/'),
      },
    },
  ],
  codeSample: {
    id: 'react',
    title: 'Built for React',
    lede: 'Wrap your app once and any component can ask if a feature is on.',
    install: 'npm install @evanion/feature @evanion/react-feature',
    file: 'libs/react-feature/docs/examples.md',
    region: 'react-landing',
    link: { label: 'Read the guide', href: docsHref('react-feature/') },
  },
  faq: [
    {
      q: 'What is @evanion/feature?',
      a: 'It is an open source TypeScript library (MIT). You define your rules, rollouts, variants, and dependencies in a file and call it from your API, build, or browser.',
    },
    {
      q: 'Does it need a server of its own?',
      a: 'No. There is no service to call. The file ships with your app, or you can serve it as a plain file to reload it in a running app.',
    },
    {
      q: 'How do anonymous visitors get a stable variant?',
      a: 'Bring your own visitor ID. The library never sets a cookie and never stores which variant anyone got. Signed-in visitors use the account ID. Anonymous visitors use an ID the site already sets, such as a session, cart or analytics ID. If the site has none, you can set a first-party ID cookie yourself, under your own consent rules. Without any ID, the visitor gets the default variant. To keep a variant across sign-in, use `variantBy` or `stickyVariants`.',
    },
    {
      q: 'Does it work with static sites?',
      a: 'Yes. A build decides every flag it has enough information for and writes the answer into the page. Flags that depend on the visitor are decided when the visitor arrives.',
    },
    {
      q: 'Is there React support?',
      a: 'Yes, via @evanion/react-feature. It provides a provider and hooks to access flags anywhere. Server decisions reach the browser so there is no flicker.',
    },
  ],
  closing: {
    title: 'Feature flags your build can decide',
    text: 'The build decides what it can before deploy, and only flags that depend on the visitor wait. Decouple release from deployment. Install the library and follow the getting started guide to begin.',
    actions: [
      { label: 'Get started', href: docsHref('feature/getting-started/') },
      { label: 'API reference', href: docsHref('feature/api/') },
      {
        label: 'GitHub',
        href: 'https://github.com/Evanion/libraries/tree/main/libs/feature',
      },
    ],
  },
};

export default page;
