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
      'One policy for server and browser with answers that explain themselves',
    description:
      'Define your authorization rules once in TypeScript and run the same synchronous checks on your server and in the browser.',
  },
  hero: {
    promise:
      'One policy for server and browser. Answers that explain themselves.',
    line: 'Write your authorization rules in TypeScript. The library builds them into a JSON document, called the matrix, that your server and browser both read.',
    sub: 'Every check is a synchronous function call with no network request.',
    install: 'npm install @evanion/acl',
    demo: 'access-api',
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
      title: 'Unified JSON policy',
      text: 'The server and browser read the same rules.',
      link: { label: 'About the document', href: docsHref('acl/matrix/') },
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
      why: 'A simple yes or no does not tell the user why they are blocked.',
      how: 'The library returns a Decision object with a `reason` and the `rule` that decided. If data is missing, the status is `unevaluable` and the decision lists exactly which fields to fetch.',
      differs: 'A UI that translates a rule ID into a human-readable reason.',
      demo: {
        id: 'acl-explain',
        caption:
          'See which rule decides the access and which fields the library needs for a final answer.',
      },
      howItWorks: {
        label: 'How decisions work',
        href: docsHref('acl/decision-object/'),
      },
    },
    {
      id: 'diff',
      title: 'Review access changes before you ship',
      lede: 'Identify who gains or loses access in your pull request.',
      why: 'A one-line rule edit can widen or narrow access for a whole group, and a line-by-line diff of the JSON does not show who is affected.',
      how: 'The `diffMatrix` function compares two policy documents. It reports granted and withdrawn permissions and which checks now read different fields of the row.',
      differs:
        'A report that names which roles gained or lost access, ready to read in review.',
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
      why: 'Developers need to know where the library ends and their responsibility begins.',
      how: "The library maps 37 attack classes to CWE and OWASP entries. Some are prevented by the engine, some use provided primitives, and some are listed as your application's job.",
      differs:
        "A clear list of security tasks that remain the application's job.",
      entries: [
        {
          id: 'SEC-004',
          attack:
            'Unevaluable deny: a deny rule reading a path the projection lacks',
          cwe: 'CWE-863, A01:2021',
          handled:
            'A deny side that cannot be read outranks a matching allow; the decision is `unevaluable` and names the paths to fetch',
        },
        {
          id: 'SEC-005',
          attack: 'Prototype pollution reaching a decision',
          cwe: 'CWE-1321',
          handled:
            'Every path read and every rule lookup is own-property guarded; every decision map is written with `defineProperty`',
        },
        {
          id: 'SEC-010',
          attack: 'Incorrect default permissions',
          cwe: 'CWE-276, A01:2021',
          handled:
            'Nothing is allowed without an allow rule that matched: no rules, an empty rule list and an unknown action all refuse',
        },
      ],
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
        'A write handler that saves only the fields the user may change.',
      sample: {
        file: 'libs/acl/docs/examples.md',
        region: 'fields-landing',
      },
      howItWorks: {
        label: 'Managing field access',
        href: docsHref('acl/fields/'),
      },
    },
    {
      id: 'explorer',
      title: 'Try it with your own policy',
      lede: 'Paste your policy and see what it decides.',
      why: 'You can verify your logic without writing and deploying a full update.',
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
        title: 'Public rules',
        text: 'The JSON document is shipped to the browser in full. Do not put secrets in your rules.',
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
      a: 'It is a TypeScript authorization library that builds a policy into a JSON document. This allows the same synchronous checks to run on both your server and in the browser.',
    },
    {
      q: 'Does it need a service of its own?',
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
    {
      q: 'How do I notice changes when another service publishes new rules?',
      a: 'Use `contractDrift` from `@evanion/acl/testing`. It replays your own questions against the contract you pinned and the one CI fetched, then reports what moved between them.',
    },
  ],
  closing: {
    title: 'Unified authorization logic',
    text: 'Run the same rules across every layer of your app. Every decision provides the reason and the rule used to reach it.',
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
