import { docsHref } from '../../../tools/docs-path.mjs';
import type { ProductPage } from '../types';

const page: ProductPage = {
  slug: 'authorization',
  group: 'acl',
  packageName: '@evanion/acl',
  draft: false,
  docsLink: 'Read the docs',
  anchors: { '@evanion/react-acl': 'react' },
  metadata: {
    title:
      'One policy for server and browser, with answers that explain themselves',
    description:
      'Define one authorization policy as a JSON document and run the same checks on your server and in the browser.',
  },
  hero: {
    promise:
      'One policy decided on the server and in the browser. Every answer explains itself.',
    line: 'Write your authorization rules once in TypeScript. The library builds them into a JSON matrix that your server and browser both use to decide access.',
    sub: 'Every check is a synchronous function call with no network request.',
    install: 'npm install @evanion/acl',
    demo: 'access',
    actions: [
      { label: 'Get started', href: docsHref('acl/getting-started/') },
      { label: 'npm', href: 'https://www.npmjs.com/package/@evanion/acl' },
      {
        label: 'GitHub',
        href: 'https://github.com/Evanion/libraries/tree/main/libs/acl',
      },
    ],
  },
  facts: [
    {
      title: 'One JSON document',
      text: 'The server and browser read the same matrix. Rules cannot drift between your frontend and backend.',
      link: { label: 'The matrix', href: docsHref('acl/matrix/') },
    },
    {
      title: 'Synchronous and local',
      text: 'Checks use plain function calls. There is no await and no network call during a decision.',
    },
    {
      title: 'Zero dependencies',
      text: 'The library is ESM with no runtime or peer dependencies. It runs on Node 20 or newer and in the browser.',
    },
    {
      title: 'The browser hides, the server decides',
      text: 'Decisions are advisory in the browser. Every layer re-decides and trusts no previous result.',
      link: {
        label: 'The security contract',
        href: docsHref('acl/security/'),
      },
    },
  ],
  scenes: [
    {
      id: 'explain',
      title: 'Answers that explain themselves',
      lede: 'Turn a refusal into clear user feedback.',
      why: 'A simple yes or no does not tell the user why they are blocked. Developers often have to manually map errors to messages.',
      how: 'The library returns a Decision object with a `reason` and the `rule` that decided. If data is missing, the status is `unevaluable` and the decision lists exactly which fields to fetch.',
      differs:
        'You get the exact reason for every refusal and a list of missing fields to resolve third-state answers.',
      demo: {
        id: 'acl-explain',
        caption:
          'See which rule decides the access and which fields the library needs to give a final answer.',
      },
      howItWorks: {
        label: 'How decisions work',
        href: docsHref('acl/decision-object/'),
      },
    },
    {
      id: 'diff',
      title: 'See who gains or loses access before you ship',
      lede: 'Review authorization changes in your pull request.',
      why: 'A one-line rule edit can widen or narrow access for a whole group, and a line-by-line diff of the JSON does not show who is affected.',
      how: 'The `diffMatrix` function compares two policy documents. It reports who gained access, who lost it, and which checks now require new fields to be loaded.',
      differs:
        'You get a clear report of granted and withdrawn permissions before you deploy a change.',
      demo: {
        id: 'acl-diff',
        caption:
          'Select a rule change to see how it shifts access for different subjects.',
      },
      howItWorks: {
        label: 'Comparing policy versions',
        href: docsHref('acl/rule-changes/'),
      },
    },
    {
      id: 'contract',
      title: 'A security contract you can read',
      lede: 'Know exactly what the library prevents and what your app must handle.',
      why: 'Security is often a black box. Developers need to know where the library ends and their responsibility begins.',
      how: "The library maps 37 attack classes to CWE and OWASP entries. Some are prevented by the engine, some use provided primitives, and some are listed as your application's job.",
      differs:
        "You get an attack register with a test for each of the 37 classes, and a plain list of what stays your application's job.",
      howItWorks: {
        label: 'Read the security contract',
        href: docsHref('acl/security/'),
      },
      more: {
        label: 'View the attack register',
        href: docsHref('acl/attacks/'),
      },
    },
    {
      id: 'fields',
      title: 'Field-level control',
      lede: 'Control exactly which fields a user can read or write.',
      why: 'Users may have access to a row but should not be able to change every column.',
      how: 'Use `canFields` to determine allowed fields for a subject. Use `pickAllowedFields` to strip unauthorized fields from a submitted write.',
      differs:
        'You get the ability to narrow write requests to only the fields the user is permitted to change.',
      howItWorks: {
        label: 'Managing field access',
        href: docsHref('acl/fields/'),
      },
    },
    {
      id: 'ci-tests',
      title: 'Contract tests in CI',
      lede: 'Catch a changed contract in your pipeline.',
      why: "Another service's rules can change under you, and your tests keep passing against your old copy.",
      how: '`contractDrift` from `@evanion/acl/testing` replays your own questions against the contract you pinned and the one CI fetched, and reports what moved between them.',
      differs:
        'You get a CI failure that names which of your answers moved when a contract you consume changes.',
      howItWorks: {
        label: 'Testing your policy',
        href: docsHref('acl/testing/'),
      },
    },
    {
      id: 'explorer',
      title: 'Try it with your own policy',
      lede: 'Paste your policy and see what it decides.',
      why: 'Writing and deploying a policy to see a result is a slow feedback loop.',
      how: 'The matrix explorer lets you paste your JSON policy and test decisions for any subject. The document is read in your browser and never uploaded.',
      howItWorks: {
        label: 'Open the matrix explorer',
        href: '/matrix-explorer/',
      },
    },
  ],
  limits: {
    title: 'Limits',
    items: [
      {
        title: 'Public matrix',
        text: 'The matrix is shipped to the browser in full. Do not put secrets in your rules.',
        link: {
          label: 'Everything it does not do',
          href: docsHref('acl/limits/'),
        },
      },
      {
        title: 'No database filtering',
        text: 'The library decides about a row you already hold. It does not write SQL WHERE clauses.',
      },
      {
        title: 'No relationship traversal',
        text: 'Rules read the subject and the object you pass. They do not traverse across multiple rows.',
      },
      {
        title: 'JavaScript and TypeScript only',
        text: 'The library supports JavaScript and TypeScript only.',
      },
      {
        title: 'No remote service',
        text: 'This is a library. There is no remote decision service or admin interface.',
      },
    ],
  },
  codeSample: {
    id: 'react',
    title: 'Integrated with React',
    lede: 'Use a provider and hooks to manage access in your components.',
    install: 'npm install @evanion/acl @evanion/react-acl',
    file: 'libs/react-acl/docs/examples.md',
    region: 'react-landing',
    link: { label: 'Read the guide', href: docsHref('react-acl/') },
  },
  faq: [
    {
      q: 'What is this library?',
      a: 'It is a TypeScript authorization library that compiles a policy into a JSON matrix. This matrix allows the same synchronous checks to run on both your server and in the browser.',
    },
    {
      q: 'Does it need a server or service of its own?',
      a: 'No. It is a library with zero dependencies. You install it via npm and run it within your own application process.',
    },
    {
      q: 'Can I trust the browser check?',
      a: 'No. Browser checks are advisory and used to update the UI. You must re-decide every request on your server or gateway to ensure security.',
    },
    {
      q: 'What happens when the row is not loaded?',
      a: 'The library returns an `unevaluable` decision. The result is `allowed: false`, and the `missing` field lists the data needed to make a final decision.',
    },
    {
      q: 'Does it work with React?',
      a: 'Yes. The `@evanion/react-acl` package provides a `PolicyProvider` and a `useCan` hook to check permissions inside your components.',
    },
  ],
  closing: {
    title: 'One policy. Every answer explains itself.',
    text: 'Decide access using one policy on both the server and in the browser, with results that explain exactly why they were reached.',
    actions: [
      { label: 'Get started', href: docsHref('acl/getting-started/') },
      { label: 'API reference', href: docsHref('acl/api/') },
      {
        label: 'GitHub',
        href: 'https://github.com/Evanion/libraries/tree/main/libs/acl',
      },
    ],
  },
};

export default page;
