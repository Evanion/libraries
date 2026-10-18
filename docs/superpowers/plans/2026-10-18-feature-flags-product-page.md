# Feature Flags Product Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `https://libs.evanion.com/feature-flags/`, a fun, low-technical, interactive product page for `@evanion/feature`, built on a reusable product-page system (definition-as-data, one route, one renderer, shared demo primitives) that the authorization and rendering pages reuse.

**Architecture:** One dynamic route `app/(product)/[product]/page.tsx` renders any `ProductPage` definition from a registry through `ProductPageView`. Scenes name demos by id; a map resolves ids to client components built from shared presentation primitives (`CodeView`, `VisitorCrowd`, `Scrubber`, `ReplayFrame`, `DecisionTree`). Each demo's logic is a pure module over the real `@evanion/feature` API. Metadata and JSON-LD come from the definition.

**Tech Stack:** Next.js 16 static export (`output: 'export'`), React 19, `@evanion/feature`, `@evanion/react-feature`, `@evanion/doc-examples/regions`, Vitest + jsdom + `@testing-library/react`, Nx.

**Spec:** `docs/superpowers/specs/2026-10-18-feature-flags-product-page-design.md` (approved 2026-10-18).

## Global Constraints

- Angle: feature definitions are a plain document you own; one library decides them in a Node.js API, a build and the browser; a build decides what it already knows and leaves the rest for the visitor.
- Never mention running, hosting or paying for a flag service; never name or compare other products.
- Library names (`toggle`, `targetingKey`, …) appear only inside a demo's code view, never in headings, ledes or captions.
- Every demo answers from the real library; the no-flicker scene's client-only side is a labelled simulation.
- Code shown on the page is an existing tested region, read at build time; never hand-written code.
- Product pages live in `app/(product)/`, outside the content tree; product slugs never collide with `/docs/...` or `/matrix-explorer/`.
- Light and dark; usable at 360px wide with no horizontal scroll; `prefers-reduced-motion` respected.
- All copy (headings, ledes, captions, buttons, title, description) is Gemma's, written in dialogue at page level (Task 9). Until then, copy is a plain placeholder draft marked in the definition with `draft: true`.
- Conventional commits (`feat(docs)`, `test(docs)`, `fix(docs)`), each ending with the session's Co-Authored-By line. Comments describe the code as it is (`/** */`, no history).
- Next 16: read `apps/docs/node_modules/next/dist/docs/` (or the root `node_modules/next/dist/docs/`) before writing route code, per `apps/docs/AGENTS.md`.
- Verification: `npx nx run-many -t test lint typecheck -p docs repo-checks --parallel=2 --skip-nx-cache`; `npx nx run docs:build --skip-nx-cache` then `cd apps/docs && npm run postbuild`. Never run a build in a worktree where `docs:dev` runs.
- `.fallowrc.jsonc` flags unreachable files: every new module must be imported from the route or a test.

## Review Focus

1. The schedule scene at exactly the launch instant: a reasonable person expects "on" at 09:00:00, not one step later. Pinned in Task 4.
2. Cancelling the kill switch leaves every node exactly as before (no hidden write). Pinned in Task 5.
3. Turning the A/B pin on must not switch the feature off for non-booksellers (rules are OR-ed). Pinned in Task 6.
4. The no-flicker scene under reduced motion still shows the difference (both end states and a caption), without animation. Pinned in Task 7.
5. A product page link written into docs content (`/feature-flags/`) passes the docs link check even though the route is dynamic. Pinned in Task 8.

---

### Task 1: Product page types, registry and metadata

**Files:**

- Create: `apps/docs/components/product/types.ts`
- Create: `apps/docs/components/product/product-slugs.mjs`
- Create: `apps/docs/components/product/registry.ts`
- Create: `apps/docs/components/product/metadata.ts`
- Create: `apps/docs/components/product/pages/feature-flags.ts`
- Test: `apps/docs/components/product/registry.test.ts`

**Interfaces:**

- Produces:

  ```ts
  // types.ts
  export type DemoId =
    'rollout' | 'schedule' | 'cascade' | 'variants' | 'no-flicker';
  export interface Link {
    label: string;
    href: string;
  }
  export interface SceneDefinition {
    id: string;
    title: string;
    lede: string;
    demo: DemoId;
    caption: string;
    howItWorks: Link;
  }
  export interface ProductPage {
    slug: string; // URL segment, e.g. 'feature-flags'
    group: string; // group id in app/navigation.ts, e.g. 'feature'
    packageName: string; // '@evanion/feature'
    draft: boolean; // true until Gemma's copy lands (Task 9)
    metadata: { title: string; description: string };
    hero: { promise: string; line: string; demo: DemoId; actions: Link[] };
    scenes: SceneDefinition[];
    codeSample: {
      title: string;
      lede: string;
      file: string;
      region: string;
      link: Link;
    };
    install: { title: string; command: string };
    next: { title: string; links: Link[] };
  }
  // product-slugs.mjs
  export const productSlugs = ['feature-flags'];
  // registry.ts
  export const products: readonly ProductPage[];
  export function productBySlug(slug: string): ProductPage; // throws on unknown
  export function productForGroup(group: string): ProductPage | undefined;
  // metadata.ts
  export const ORIGIN = 'https://libs.evanion.com';
  export function productMetadata(page: ProductPage): import('next').Metadata;
  export function productJsonLd(page: ProductPage): Record<string, unknown>;
  ```

- [ ] **Step 1: Write the failing test** `apps/docs/components/product/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { productSlugs } from './product-slugs.mjs';
import { productBySlug, productForGroup, products } from './registry';
import { ORIGIN, productJsonLd, productMetadata } from './metadata';

describe('the product registry', () => {
  it('lists the slugs product-slugs.mjs names, in the same order', () => {
    expect(products.map((p) => p.slug)).toEqual(productSlugs);
  });

  it('finds a page by slug and by navigation group', () => {
    expect(productBySlug('feature-flags').packageName).toBe('@evanion/feature');
    expect(productForGroup('feature')?.slug).toBe('feature-flags');
    expect(productForGroup('identifiers')).toBeUndefined();
    expect(() => productBySlug('nope')).toThrow(/nope/);
  });
});

describe('product metadata', () => {
  const page = productBySlug('feature-flags');

  it('names the page, its canonical URL and its Open Graph card', () => {
    const meta = productMetadata(page);
    expect(meta.title).toBe(page.metadata.title);
    expect(meta.description).toBe(page.metadata.description);
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/feature-flags/`);
    expect(meta.openGraph).toMatchObject({
      title: page.metadata.title,
      url: `${ORIGIN}/feature-flags/`,
    });
  });

  it('describes the package as SoftwareSourceCode', () => {
    expect(productJsonLd(page)).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: '@evanion/feature',
      codeRepository:
        'https://github.com/Evanion/libraries/tree/main/libs/feature',
      programmingLanguage: 'TypeScript',
      license: 'https://opensource.org/licenses/MIT',
    });
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd apps/docs && npx vitest run components/product/registry.test.ts`
Expected: FAIL, cannot resolve `./product-slugs.mjs`.

- [ ] **Step 3: Implement.** `types.ts` exactly as the Interfaces block. `product-slugs.mjs`:

```js
/**
 * The URL segment of every product page, in registry order.
 *
 * Plain ESM so the docs link check in tools/repo-checks can read it: the
 * product route is dynamic (`app/(product)/[product]`), and a link check that
 * walks route directories sees no segment there. `registry.test.ts` holds
 * this list to the registry's definitions.
 */
export const productSlugs = ['feature-flags'];
```

`registry.ts`:

```ts
import featureFlags from './pages/feature-flags';
import type { ProductPage } from './types';

/** Every product page, in the order their slugs are listed in `product-slugs.mjs`. */
export const products: readonly ProductPage[] = [featureFlags];

export function productBySlug(slug: string): ProductPage {
  const page = products.find((p) => p.slug === slug);
  if (!page) throw new Error(`No product page has the slug ${slug}`);
  return page;
}

/** The product page for a navigation group, when the group has one. */
export function productForGroup(group: string): ProductPage | undefined {
  return products.find((p) => p.group === group);
}
```

`metadata.ts`:

```ts
import type { Metadata } from 'next';
import { packages } from '../../app/navigation';
import type { ProductPage } from './types';

export const ORIGIN = 'https://libs.evanion.com';
const REPOSITORY = 'https://github.com/Evanion/libraries/tree/main';

const urlOf = (page: ProductPage) => `${ORIGIN}/${page.slug}/`;

export function productMetadata(page: ProductPage): Metadata {
  return {
    title: page.metadata.title,
    description: page.metadata.description,
    alternates: { canonical: urlOf(page) },
    openGraph: {
      type: 'website',
      title: page.metadata.title,
      description: page.metadata.description,
      url: urlOf(page),
    },
  };
}

export function productJsonLd(page: ProductPage): Record<string, unknown> {
  const entry = packages.find((p) => p.name === page.packageName);
  if (!entry)
    throw new Error(`No package in navigation.ts is named ${page.packageName}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: page.packageName,
    description: page.metadata.description,
    url: urlOf(page),
    codeRepository: `${REPOSITORY}/${entry.root}`,
    programmingLanguage: 'TypeScript',
    license: 'https://opensource.org/licenses/MIT',
  };
}
```

`pages/feature-flags.ts` (placeholder copy; Gemma replaces it in Task 9):

```ts
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
```

- [ ] **Step 4: Run it and see it pass**

Run: `cd apps/docs && npx vitest run components/product/registry.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/components/product
git commit -m "feat(docs): describe a product page as data"
```

---

### Task 2: CodeView and VisitorCrowd, with FeatureDemo and AccessDemo on them

**Files:**

- Create: `apps/docs/components/product/primitives/CodeView.tsx`, `VisitorCrowd.tsx`, `primitives.css`
- Test: `apps/docs/components/product/primitives/code-view.test.tsx`, `visitor-crowd.test.tsx`
- Modify: `apps/docs/components/landing/FeatureDemo.tsx`, `apps/docs/components/landing/AccessDemo.tsx`, `apps/docs/components/landing/landing.css`
- Keep green: `apps/docs/components/landing/feature-demo.test.tsx`, `access.test.tsx`

**Interfaces:**

- Produces:
  ```ts
  export interface CodeLine {
    key: string;
    content: React.ReactNode;
    lit?: boolean;
    tone?: 'deny';
  }
  export function CodeView(props: {
    lines: CodeLine[];
    label: string;
    className?: string;
  }): JSX.Element;
  // renders pre.code-view > code > span.code-view__line[data-lit][data-tone]
  export interface CrowdMember {
    id: string;
    lit: boolean;
    mark?: 'pinned' | 'moved';
    tone?: 'a' | 'b';
    label: string;
  }
  export function VisitorCrowd(props: {
    members: CrowdMember[];
    legend: string;
    count: string;
    dimmed?: boolean;
    onFocusMember?: (id: string | null) => void;
  }): JSX.Element;
  // renders div.visitor-crowd > p.visitor-crowd__legend, p.visitor-crowd__count, ul.visitor-crowd__grid > li > span.visitor-crowd__dot[data-lit][data-tone][data-mark][role=img][tabIndex=0][aria-label]
  ```
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests.** `code-view.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeView } from './CodeView';

describe('CodeView', () => {
  it('renders one line per entry and marks the lit and denied ones', () => {
    const { container } = render(
      <CodeView
        label="The document"
        lines={[
          { key: 'a', content: 'one' },
          { key: 'b', content: 'two', lit: true },
          { key: 'c', content: 'three', lit: true, tone: 'deny' },
        ]}
      />,
    );
    const lines = container.querySelectorAll('.code-view__line');
    expect(lines).toHaveLength(3);
    expect(lines[0]).not.toHaveAttribute('data-lit');
    expect(lines[1]).toHaveAttribute('data-lit');
    expect(lines[2]).toHaveAttribute('data-tone', 'deny');
    expect(container.querySelector('pre')).toHaveAttribute(
      'aria-label',
      'The document',
    );
  });
});
```

`visitor-crowd.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VisitorCrowd } from './VisitorCrowd';

const members = Array.from({ length: 4 }, (_, i) => ({
  id: `cust-000${i}`,
  lit: i % 2 === 0,
  label: `cust-000${i}: ${i % 2 === 0 ? 'on' : 'off'}`,
}));

describe('VisitorCrowd', () => {
  it('renders a focusable dot per member with its label, legend and count', () => {
    const { container } = render(
      <VisitorCrowd
        members={members}
        legend="Each dot is a visitor."
        count="2 of 4"
      />,
    );
    const dots = screen.getAllByRole('img');
    expect(dots).toHaveLength(4);
    expect(dots[0]).toHaveAttribute('aria-label', 'cust-0000: on');
    expect(dots[0]).toHaveAttribute('data-lit');
    expect(dots[1]).not.toHaveAttribute('data-lit');
    expect(dots[0]).toHaveAttribute('tabindex', '0');
    expect(container).toHaveTextContent('Each dot is a visitor.');
    expect(container).toHaveTextContent('2 of 4');
  });

  it('reports the focused member and dims on request', () => {
    const onFocusMember = vi.fn();
    const { container } = render(
      <VisitorCrowd
        members={members}
        legend=""
        count=""
        dimmed
        onFocusMember={onFocusMember}
      />,
    );
    fireEvent.focus(screen.getAllByRole('img')[1]);
    expect(onFocusMember).toHaveBeenCalledWith('cust-0001');
    expect(container.querySelector('.visitor-crowd')).toHaveAttribute(
      'data-dimmed',
    );
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `cd apps/docs && npx vitest run components/product/primitives`
Expected: FAIL, cannot resolve `./CodeView` and `./VisitorCrowd`.

- [ ] **Step 3: Implement the primitives.** `CodeView.tsx`:

```tsx
import type { ReactNode } from 'react';
import './primitives.css';

/** One line of a document shown as code; `lit` marks the line a control just changed. */
export interface CodeLine {
  key: string;
  content: ReactNode;
  lit?: boolean;
  tone?: 'deny';
}

/** A document shown as code, with the lines that decided something lit. Presentation only. */
export function CodeView({
  lines,
  label,
  className,
}: {
  lines: CodeLine[];
  label: string;
  className?: string;
}) {
  return (
    <pre
      className={['code-view', className].filter(Boolean).join(' ')}
      aria-label={label}
    >
      <code>
        {lines.map((line) => (
          <span
            key={line.key}
            className="code-view__line"
            data-lit={line.lit ? '' : undefined}
            data-tone={line.tone}
          >
            {line.content}
            {'\n'}
          </span>
        ))}
      </code>
    </pre>
  );
}
```

`VisitorCrowd.tsx`:

```tsx
import './primitives.css';

/** One visitor in the crowd. `label` is what a screen reader and the readout say about them. */
export interface CrowdMember {
  id: string;
  lit: boolean;
  mark?: 'pinned' | 'moved';
  tone?: 'a' | 'b';
  label: string;
}

/** A grid of visitors, each a focusable dot. Presentation only: the caller decides who is lit. */
export function VisitorCrowd({
  members,
  legend,
  count,
  dimmed,
  onFocusMember,
}: {
  members: CrowdMember[];
  legend: string;
  count: string;
  dimmed?: boolean;
  onFocusMember?: (id: string | null) => void;
}) {
  return (
    <div className="visitor-crowd" data-dimmed={dimmed ? '' : undefined}>
      {legend && <p className="visitor-crowd__legend">{legend}</p>}
      {count && <p className="visitor-crowd__count">{count}</p>}
      <ul className="visitor-crowd__grid">
        {members.map((m) => (
          <li key={m.id}>
            <span
              className="visitor-crowd__dot"
              role="img"
              tabIndex={0}
              aria-label={m.label}
              title={m.label}
              data-lit={m.lit ? '' : undefined}
              data-tone={m.tone}
              data-mark={m.mark}
              onFocus={() => onFocusMember?.(m.id)}
              onBlur={() => onFocusMember?.(null)}
              onPointerEnter={() => onFocusMember?.(m.id)}
              onPointerLeave={() => onFocusMember?.(null)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`primitives.css`: move the rules for the crowd and the code view out of `landing.css` under the new class names. Take `.landing-feature__crowd` (L1450), `.landing-feature__dot` (L1461), `.landing-feature__dot[data-lit]` (L1474), `.landing-feature__source` (L1242), `.landing-feature__line` (L1252), `.landing-feature__line[data-lit]` (L1261) and `.landing-access__line[data-lit][data-side='deny']` (L1161) verbatim, renamed to `.visitor-crowd__grid`, `.visitor-crowd__dot`, `.visitor-crowd__dot[data-lit]`, `.code-view`, `.code-view__line`, `.code-view__line[data-lit]`, `.code-view__line[data-lit][data-tone='deny']`. Add:

```css
.visitor-crowd[data-dimmed] {
  opacity: 0.45;
}
.visitor-crowd__dot[data-tone='b'] {
  background: color-mix(in oklab, var(--baize-hue) 45%, transparent);
}
.visitor-crowd__dot[data-mark='pinned'] {
  outline: 2px dashed var(--baize-hue);
  outline-offset: 2px;
}
.visitor-crowd__dot[data-mark='moved'] {
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--baize-hue) 35%, transparent);
}
@media (max-width: 480px) {
  .visitor-crowd__grid {
    grid-template-columns: repeat(8, 1fr);
  }
}
```

- [ ] **Step 4: Run them and see them pass**

Run: `cd apps/docs && npx vitest run components/product/primitives`
Expected: PASS, 3 tests.

- [ ] **Step 5: Move FeatureDemo onto the primitives.** In `FeatureDemo.tsx`, render the document with `<CodeView label=... lines={source.map((line, i) => ({ key: String(i), lit: line.writtenBy === moved.control && moved.count > 0, content: <>{line.segments.map(...)}</> }))} />` (keep the existing segment rendering and `.landing-feature__value` spans inside `content`), and the crowd with `<VisitorCrowd members={visitors.map((v) => ({ id: v.id, lit: v.gallery.enabled, label: describeVisitor(v) }))} legend={...} count={...} dimmed={page is azul} onFocusMember={setActive} />`, keeping the legend, count and readout text exactly as now. Delete the moved CSS rules from `landing.css`. Update `feature-demo.test.tsx`'s selector `.landing-feature__dot` to `.visitor-crowd__dot` (the only change to that test).
- [ ] **Step 6: Move AccessDemo onto CodeView.** Render its `source` with `<CodeView lines={source.map((line, i) => ({ key: String(i), lit: isLit(line, decisions), tone: line.rule?.side === 'deny' ? 'deny' : undefined, content: <>…existing segments incl. role buttons…</> }))} label=… />`. Update `access.test.tsx` selectors from `.landing-access__line` to `.code-view__line` and `data-side='deny'` to `data-tone='deny'` (only those changes).
- [ ] **Step 7: Run the landing tests and the primitives**

Run: `cd apps/docs && npx vitest run components/landing components/product`
Expected: PASS, every existing landing test plus the 3 new ones.

- [ ] **Step 8: Commit**

```bash
git add apps/docs/components/product/primitives apps/docs/components/landing
git commit -m "feat(docs): share the code view and the visitor crowd between demos"
```

---

### Task 3: Scrubber, ReplayFrame and DecisionTree

**Files:**

- Create: `apps/docs/components/product/primitives/Scrubber.tsx`, `ReplayFrame.tsx`, `DecisionTree.tsx` (styles appended to `primitives.css`)
- Test: `apps/docs/components/product/primitives/scrubber.test.tsx`, `replay-frame.test.tsx`, `decision-tree.test.tsx`

**Interfaces:**

- Produces:

  ```ts
  export function Scrubber(props: {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    format: (v: number) => string;
    marks?: { value: number; label: string }[];
    onChange: (v: number) => void;
  }): JSX.Element;
  export function ReplayFrame(props: {
    title: string;
    frames: React.ReactNode[];
    interval: number;
    replayLabel: string;
  }): JSX.Element;
  // shows frames[0], advances one frame per `interval` ms after mount or Replay; under prefers-reduced-motion shows the last frame and no timer
  export interface TreeNode {
    key: string;
    label: string;
    on: boolean;
    reason: string;
    children?: TreeNode[];
  }
  export function DecisionTree(props: {
    root: TreeNode;
    label: string;
  }): JSX.Element;
  // renders ul.decision-tree > li[data-on] with the label and reason, nested
  ```

- [ ] **Step 1: Write the failing tests.**

`scrubber.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Scrubber } from './Scrubber';

describe('Scrubber', () => {
  it('shows the formatted value and reports changes', () => {
    const onChange = vi.fn();
    render(
      <Scrubber
        label="Time"
        min={0}
        max={10}
        step={1}
        value={3}
        format={(v) => `${v}:00`}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('3:00')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Time' }), {
      target: { value: '7' },
    });
    expect(onChange).toHaveBeenCalledWith(7);
  });
});
```

`replay-frame.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReplayFrame } from './ReplayFrame';

function motion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}
afterEach(() => vi.useRealTimers());

describe('ReplayFrame', () => {
  it('advances through its frames and starts over on Replay', () => {
    motion(false);
    vi.useFakeTimers();
    render(
      <ReplayFrame
        title="Client"
        frames={['old', 'new']}
        interval={800}
        replayLabel="Replay"
      />,
    );
    expect(screen.getByText('old')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByText('new')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(screen.getByText('old')).toBeInTheDocument();
  });

  it('shows the last frame without animating under reduced motion', () => {
    motion(true);
    render(
      <ReplayFrame
        title="Client"
        frames={['old', 'new']}
        interval={800}
        replayLabel="Replay"
      />,
    );
    expect(screen.getByText('new')).toBeInTheDocument();
  });
});
```

`decision-tree.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DecisionTree } from './DecisionTree';

describe('DecisionTree', () => {
  it('renders each node with its state and reason, nested', () => {
    const { container } = render(
      <DecisionTree
        label="Features"
        root={{
          key: 'a',
          label: 'New checkout',
          on: false,
          reason: 'switched off',
          children: [
            {
              key: 'b',
              label: 'Express pickup',
              on: false,
              reason: 'off because New checkout is off',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Express pickup')).toBeInTheDocument();
    expect(
      screen.getByText('off because New checkout is off'),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('li[data-on]')).toHaveLength(0);
    expect(container.querySelectorAll('ul ul li')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `cd apps/docs && npx vitest run components/product/primitives`
Expected: FAIL, cannot resolve the three modules.

- [ ] **Step 3: Implement.** `Scrubber.tsx`:

```tsx
import { useId } from 'react';
import './primitives.css';

/** A labelled slider over a range, showing its value in words. Presentation only. */
export function Scrubber({
  label,
  min,
  max,
  step,
  value,
  format,
  marks,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  marks?: { value: number; label: string }[];
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="scrubber">
      <label htmlFor={id} className="scrubber__label">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        list={marks ? `${id}-marks` : undefined}
      />
      <output htmlFor={id} className="scrubber__value">
        {format(value)}
      </output>
      {marks && (
        <datalist id={`${id}-marks`}>
          {marks.map((m) => (
            <option key={m.value} value={m.value} label={m.label} />
          ))}
        </datalist>
      )}
    </div>
  );
}
```

`ReplayFrame.tsx`:

```tsx
'use client';
import { useEffect, useState, type ReactNode } from 'react';
import './primitives.css';

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/** A small browser frame that plays its frames in order, with a Replay button. Under reduced motion it shows the last frame. */
export function ReplayFrame({
  title,
  frames,
  interval,
  replayLabel,
}: {
  title: string;
  frames: ReactNode[];
  interval: number;
  replayLabel: string;
}) {
  const [still] = useState(reducedMotion);
  const [index, setIndex] = useState(still ? frames.length - 1 : 0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (still || index >= frames.length - 1) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), interval);
    return () => clearTimeout(timer);
  }, [still, index, frames.length, interval, run]);

  return (
    <figure className="replay-frame">
      <figcaption className="replay-frame__bar">{title}</figcaption>
      <div className="replay-frame__view">{frames[index]}</div>
      {!still && (
        <button
          type="button"
          className="replay-frame__replay"
          onClick={() => {
            setIndex(0);
            setRun((r) => r + 1);
          }}
        >
          {replayLabel}
        </button>
      )}
    </figure>
  );
}
```

`DecisionTree.tsx`:

```tsx
import './primitives.css';

/** One feature in a dependency tree: whether it is on, and why, in plain words. */
export interface TreeNode {
  key: string;
  label: string;
  on: boolean;
  reason: string;
  children?: TreeNode[];
}

function Branch({ node }: { node: TreeNode }) {
  return (
    <li data-on={node.on ? '' : undefined}>
      <span className="decision-tree__label">{node.label}</span>
      <span className="decision-tree__reason">{node.reason}</span>
      {node.children?.length ? (
        <ul>
          {node.children.map((c) => (
            <Branch key={c.key} node={c} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** A dependency tree of features, each with its state and reason. Presentation only. */
export function DecisionTree({
  root,
  label,
}: {
  root: TreeNode;
  label: string;
}) {
  return (
    <ul className="decision-tree" aria-label={label}>
      <Branch node={root} />
    </ul>
  );
}
```

Append to `primitives.css`: `.scrubber` (flex row, wraps under 480px), `.replay-frame` (border 1px var(--baize-line, currentColor), radius 8px, `.replay-frame__bar` a 24px top bar with three 6px dots, `.replay-frame__view` min-height 96px), `.decision-tree` (list-style none; nested `ul` with 1.25rem left padding and a 1px left border; `li` labels muted when not `[data-on]`, the hue when `[data-on]`; `.decision-tree__reason` small text).

- [ ] **Step 4: Run them and see them pass**

Run: `cd apps/docs && npx vitest run components/product/primitives`
Expected: PASS, 7 tests in total.

- [ ] **Step 5: Commit**

```bash
git add apps/docs/components/product/primitives
git commit -m "feat(docs): add a scrubber, a replay frame and a decision tree for demos"
```

---

### Task 4: Scene "launch on a schedule"

**Files:**

- Create: `apps/docs/components/product/feature-flags/schedule.ts`, `ScheduleDemo.tsx`
- Test: `schedule.test.ts`, `schedule-demo.test.tsx`

**Interfaces:**

- Consumes: `Scrubber`, `CodeView` (Tasks 2–3).
- Produces: `LAUNCH = '2026-11-02T09:00:00Z'`; `instantAt(minutes: number): Date` (minutes after 06:00 UTC on 2026-11-02); `scheduleStore()`; `checkoutAt(minutes: number): Decision`; `default function ScheduleDemo()`.

- [ ] **Step 1: Write the failing logic test** `schedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LAUNCH, checkoutAt, instantAt, scheduleStore } from './schedule';

describe('the schedule scene', () => {
  it('maps minutes after 06:00 to the instant', () => {
    expect(instantAt(0).toISOString()).toBe('2026-11-02T06:00:00.000Z');
    expect(instantAt(180).toISOString()).toBe(LAUNCH.replace('Z', '.000Z'));
  });
  it('is off before the launch instant and on at and after it', () => {
    expect(checkoutAt(179).enabled).toBe(false);
    expect(checkoutAt(180).enabled).toBe(true);
    expect(checkoutAt(181).enabled).toBe(true);
  });
  it('gives the same answer from a second store at the same instant', () => {
    const now = instantAt(200);
    expect(scheduleStore().resolve({ now })['new-checkout'].enabled).toBe(
      scheduleStore().resolve({ now })['new-checkout'].enabled,
    );
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `cd apps/docs && npx vitest run components/product/feature-flags/schedule.test.ts`
Expected: FAIL, cannot resolve `./schedule`.

- [ ] **Step 3: Implement** `schedule.ts`:

```ts
import { createFeatures } from '@evanion/feature';

/** The instant the new checkout launches. */
export const LAUNCH = '2026-11-02T09:00:00Z';
const START = Date.parse('2026-11-02T06:00:00Z');

/** The instant `minutes` after 06:00 UTC on launch day. */
export function instantAt(minutes: number): Date {
  return new Date(START + minutes * 60_000);
}

/** The document: the new checkout turns on at the launch instant, for everyone. */
export function scheduleStore() {
  return createFeatures([
    {
      key: 'new-checkout',
      enabled: true,
      rules: [
        { id: 'launch', when: [{ field: 'now', op: 'after', value: LAUNCH }] },
      ],
    },
  ]);
}

/** The new checkout's decision at `minutes` after 06:00. */
export function checkoutAt(minutes: number) {
  return scheduleStore().resolve({ now: instantAt(minutes) })['new-checkout'];
}
```

Run the test. If `checkoutAt(180)` is `false` (the library's `after` is strict), that is the library's documented boundary, not a bug: set the scene's launch mark and copy to the first minute that resolves on, change the test's boundary to that minute, and ledger a ruling. Do not change the library.

- [ ] **Step 4: Write the failing render test** `schedule-demo.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScheduleDemo from './ScheduleDemo';

describe('ScheduleDemo', () => {
  it('opens before launch with the old checkout and switches when scrubbed past it', () => {
    render(<ScheduleDemo />);
    expect(screen.getByTestId('checkout')).toHaveTextContent(/old checkout/i);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '240' } });
    expect(screen.getByTestId('checkout')).toHaveTextContent(/new checkout/i);
  });
});
```

- [ ] **Step 5: Implement** `ScheduleDemo.tsx` (`'use client'`): state `minutes` (opening 120 = 08:00). Render a `CodeView` of the document (lines: `createFeatures([`, `  { key: 'new-checkout', enabled: true,`, `    rules: [{ when: [{ field: 'now', op: 'after', value: '2026-11-02T09:00:00Z' }] }] },`, `])`, with the `value` line lit when the decision is on), a `Scrubber` (label "Time on launch day", 0–360, step 15, `format` → `HH:MM UTC`, mark at 180 "Launch"), and a small mock `<div data-testid="checkout">` that reads "Old checkout" or "New checkout" from `checkoutAt(minutes).enabled`. Plain words only outside the code view.
- [ ] **Step 6: Run both tests**

Run: `cd apps/docs && npx vitest run components/product/feature-flags/schedule`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/docs/components/product/feature-flags/schedule.ts apps/docs/components/product/feature-flags/schedule.test.ts apps/docs/components/product/feature-flags/ScheduleDemo.tsx apps/docs/components/product/feature-flags/schedule-demo.test.tsx
git commit -m "feat(docs): show a feature launching on a schedule"
```

---

### Task 5: Scene "one switch, everything that depends on it"

**Files:**

- Create: `apps/docs/components/product/feature-flags/cascade.ts`, `CascadeDemo.tsx`
- Test: `cascade.test.ts`, `cascade-demo.test.tsx`

**Interfaces:**

- Consumes: `DecisionTree`, `TreeNode` (Task 3).
- Produces: `cascadeStore(checkoutOn: boolean)`; `preview(checkoutOn: boolean): string[]` (the `willDisable` list for switching the new checkout off, computed on a fresh store); `tree(checkoutOn: boolean): TreeNode`; `LABELS: Record<string, string>`; `default function CascadeDemo()`.

- [ ] **Step 1: Write the failing logic test** `cascade.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cascadeStore, preview, tree } from './cascade';

describe('the cascade scene', () => {
  it('lists exactly the dependants before the switch', () => {
    expect(preview(true)).toEqual(['express-pickup', 'demo-night-booking']);
  });
  it('previews on a copy: the shown store is unchanged by a preview', () => {
    const before = JSON.stringify(cascadeStore(true).resolve());
    preview(true);
    expect(JSON.stringify(cascadeStore(true).resolve())).toBe(before);
  });
  it('turns the branch off with a reason naming the parent', () => {
    const root = tree(false);
    expect(root.on).toBe(false);
    expect(root.children?.[0]).toMatchObject({
      on: false,
      reason: expect.stringContaining('New checkout'),
    });
    expect(root.children?.[0].children?.[0]).toMatchObject({ on: false });
    expect(tree(true).children?.[0].children?.[0].on).toBe(true);
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `cd apps/docs && npx vitest run components/product/feature-flags/cascade.test.ts`
Expected: FAIL, cannot resolve `./cascade`.

- [ ] **Step 3: Implement** `cascade.ts`:

```ts
import { createFeatures } from '@evanion/feature';
import type { TreeNode } from '../primitives/DecisionTree';

export const LABELS: Record<string, string> = {
  'new-checkout': 'New checkout',
  'express-pickup': 'Express pickup',
  'demo-night-booking': 'Demo-night booking',
};

/** The document: express pickup needs the new checkout, demo-night booking needs express pickup. */
export function cascadeStore(checkoutOn: boolean) {
  return createFeatures([
    { key: 'new-checkout', enabled: checkoutOn },
    { key: 'express-pickup', enabled: true, dependsOn: ['new-checkout'] },
    { key: 'demo-night-booking', enabled: true, dependsOn: ['express-pickup'] },
  ]);
}

/** What switching the new checkout off would take with it, asked of a fresh store so nothing shown changes. */
export function preview(checkoutOn: boolean): string[] {
  const result = cascadeStore(checkoutOn).toggle('new-checkout', false);
  return result.ok ? [...result.willDisable] : [];
}

function reasonOf(decision: {
  enabled: boolean;
  reason: string;
  blockedBy?: string;
}): string {
  if (decision.enabled) return 'on';
  if (decision.reason === 'dependency-off' && decision.blockedBy)
    return `off because ${LABELS[decision.blockedBy]} is off`;
  return 'switched off';
}

/** The three features as a tree, each with its state and reason. */
export function tree(checkoutOn: boolean): TreeNode {
  const d = cascadeStore(checkoutOn).resolve();
  const node = (key: string, children?: TreeNode[]): TreeNode => ({
    key,
    label: LABELS[key],
    on: d[key].enabled,
    reason: reasonOf(d[key]),
    children,
  });
  return node('new-checkout', [
    node('express-pickup', [node('demo-night-booking')]),
  ]);
}
```

- [ ] **Step 4: Write the failing render test** `cascade-demo.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CascadeDemo from './CascadeDemo';

describe('CascadeDemo', () => {
  it('asks before switching off, and cancel changes nothing', () => {
    const { container } = render(<CascadeDemo />);
    fireEvent.click(
      screen.getByRole('button', { name: /switch new checkout off/i }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent(/Express pickup/);
    expect(screen.getByRole('dialog')).toHaveTextContent(/Demo-night booking/);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(container.querySelectorAll('li[data-on]')).toHaveLength(3);
  });
  it('switches the branch off on confirm', () => {
    const { container } = render(<CascadeDemo />);
    fireEvent.click(
      screen.getByRole('button', { name: /switch new checkout off/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /switch off/i }));
    expect(container.querySelectorAll('li[data-on]')).toHaveLength(0);
    expect(
      screen.getByText(/off because New checkout is off/),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Implement** `CascadeDemo.tsx` (`'use client'`): state `checkoutOn` (opening true) and `asking` (boolean). A button "Switch new checkout off" (or "Switch new checkout on" when off). Clicking it while on sets `asking`; render an inline `<div role="dialog" aria-label="Confirm">` listing `preview(true).map((k) => LABELS[k])` with buttons "Switch off" (sets `checkoutOn=false`, `asking=false`) and "Cancel" (`asking=false`). Below, `<DecisionTree root={tree(checkoutOn)} label="Features" />`. Switching back on needs no confirm.
- [ ] **Step 6: Run both tests**

Run: `cd apps/docs && npx vitest run components/product/feature-flags/cascade`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/docs/components/product/feature-flags/cascade.ts apps/docs/components/product/feature-flags/cascade.test.ts apps/docs/components/product/feature-flags/CascadeDemo.tsx apps/docs/components/product/feature-flags/cascade-demo.test.tsx
git commit -m "feat(docs): show one switch taking its dependants with it"
```

---

### Task 6: Scene "A/B tests that stay put"

**Files:**

- Create: `apps/docs/components/product/feature-flags/variants.ts`, `VariantsDemo.tsx`
- Test: `variants.test.ts`, `variants-demo.test.tsx`

**Interfaces:**

- Consumes: `VisitorCrowd`, `CrowdMember`, `CodeView` (Task 2).
- Produces: `visitors: { id: string; bookseller: boolean }[]` (24; `cust-0004`, `cust-0012`, `cust-0020` are booksellers); `variantStore(blueWeight: number, pinned: boolean)`; `assign(blueWeight: number, pinned: boolean): Record<string, 'control' | 'blue'>`; `moved(a, b): string[]`; `default function VariantsDemo()`.

- [ ] **Step 1: Write the failing logic test** `variants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assign, moved, variantStore, visitors } from './variants';

describe('the variants scene', () => {
  it('moves only visitors at the boundary when the split changes', () => {
    const a = assign(30, false);
    const b = assign(50, false);
    for (const id of moved(a, b)) expect(a[id]).toBe('control');
    for (const id of moved(a, b)) expect(b[id]).toBe('blue');
    expect(moved(a, b).length).toBeLessThan(visitors.length);
  });
  it('the same visitor keeps their variant at the same split', () => {
    expect(assign(40, false)).toEqual(assign(40, false));
  });
  it('pins booksellers to blue without switching the feature off for anyone', () => {
    const pinned = assign(0, true);
    for (const v of visitors)
      if (v.bookseller) expect(pinned[v.id]).toBe('blue');
    const decisions = visitors.map(
      (v) =>
        variantStore(0, true).resolve({
          targetingKey: v.id,
          role: v.bookseller ? 'bookseller' : 'customer',
        })['checkout-cta'],
    );
    expect(decisions.every((d) => d.enabled)).toBe(true);
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `cd apps/docs && npx vitest run components/product/feature-flags/variants.test.ts`
Expected: FAIL, cannot resolve `./variants`.

- [ ] **Step 3: Implement** `variants.ts`:

```ts
import { createFeatures } from '@evanion/feature';

/** The 24 visitors; three are booksellers. */
export const visitors = Array.from({ length: 24 }, (_, i) => {
  const id = `cust-${String(i + 1).padStart(4, '0')}`;
  return {
    id,
    bookseller: ['cust-0004', 'cust-0012', 'cust-0020'].includes(id),
  };
});

/**
 * The document: a two-way split of the checkout button. With `pinned`, booksellers
 * always get blue. Rules are OR-ed, so the pin sits beside a rule every visitor
 * matches, or the feature would turn off for everyone else.
 */
export function variantStore(blueWeight: number, pinned: boolean) {
  return createFeatures([
    {
      key: 'checkout-cta',
      enabled: true,
      variants: [
        { name: 'control', weight: 100 - blueWeight, order: 0 },
        { name: 'blue', weight: blueWeight, order: 1 },
      ],
      ...(pinned
        ? {
            rules: [
              {
                id: 'booksellers',
                when: [{ field: 'role', op: 'eq', value: 'bookseller' }],
                variant: 'blue',
              },
              { id: 'everyone', rollout: { percent: 100, by: 'targetingKey' } },
            ],
          }
        : {}),
    },
  ]);
}

/** Each visitor's variant at a split. */
export function assign(
  blueWeight: number,
  pinned: boolean,
): Record<string, 'control' | 'blue'> {
  const store = variantStore(blueWeight, pinned);
  return Object.fromEntries(
    visitors.map((v) => [
      v.id,
      store.resolve({
        targetingKey: v.id,
        role: v.bookseller ? 'bookseller' : 'customer',
      })['checkout-cta'].variant as 'control' | 'blue',
    ]),
  );
}

/** The visitors whose variant differs between two assignments. */
export function moved(
  a: Record<string, string>,
  b: Record<string, string>,
): string[] {
  return Object.keys(a).filter((id) => a[id] !== b[id]);
}
```

If `weight: 0` for a variant is rejected by validation (check `validateConfig`), use a minimum of 1 for both weights in the slider and in the tests, and ledger it.

- [ ] **Step 4: Write the failing render test** `variants-demo.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VariantsDemo from './VariantsDemo';

describe('VariantsDemo', () => {
  it('reports how many visitors moved when the split changes', () => {
    render(<VariantsDemo />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '70' } });
    expect(screen.getByTestId('moved')).toHaveTextContent(
      /\d+ of 24 visitors switched/,
    );
  });
  it('marks the three booksellers when they are pinned', () => {
    const { container } = render(<VariantsDemo />);
    fireEvent.click(screen.getByRole('checkbox', { name: /booksellers/i }));
    expect(container.querySelectorAll('[data-mark="pinned"]')).toHaveLength(3);
  });
});
```

- [ ] **Step 5: Implement** `VariantsDemo.tsx` (`'use client'`): state `weight` (opening 50), `previous` assignment, `pinned` (false). On slider change, keep the prior `assign` result, compute the new one, and show `moved(prev, next).length` in `<p data-testid="moved">{n} of 24 visitors switched</p>` (first render: "Move the split to see who switches"). A checkbox "Always show blue to booksellers". `VisitorCrowd` members: `{ id, lit: variant === 'blue', tone: variant === 'blue' ? 'b' : 'a', mark: pinned && bookseller ? 'pinned' : movedSet.has(id) ? 'moved' : undefined, label: `${id}${bookseller ? ' (bookseller)' : ''}: ${variant}` }`; legend "Each dot is a visitor. Filled ones see the blue button." Code view of the document with the weights line lit after a slider move and the pin rule line present and lit when pinned.
- [ ] **Step 6: Run both tests**

Run: `cd apps/docs && npx vitest run components/product/feature-flags/variants`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/docs/components/product/feature-flags/variants.ts apps/docs/components/product/feature-flags/variants.test.ts apps/docs/components/product/feature-flags/VariantsDemo.tsx apps/docs/components/product/feature-flags/variants-demo.test.tsx
git commit -m "feat(docs): show an A/B split that keeps its visitors"
```

---

### Task 7: Scene "no flicker on load"

**Files:**

- Create: `apps/docs/components/product/feature-flags/no-flicker.ts`, `NoFlickerDemo.tsx`
- Test: `no-flicker.test.ts`, `no-flicker-demo.test.tsx`

**Interfaces:**

- Consumes: `ReplayFrame` (Task 3).
- Produces: `VISITOR = { targetingKey: 'cust-0042', role: 'member' }`; `serverSet(): DecisionSet` (the server's snapshot, JSON round-tripped as on the wire); `firstPaint(mode: 'client-only' | 'adopted'): 'old' | 'new'`; `finalPaint(): 'old' | 'new'`; `default function NoFlickerDemo()`.

- [ ] **Step 1: Write the failing logic test** `no-flicker.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { finalPaint, firstPaint, serverSet } from './no-flicker';

describe('the no-flicker scene', () => {
  it('the server decides the new checkout for this visitor', () => {
    expect(serverSet().decisions['new-checkout'].enabled).toBe(true);
    expect(finalPaint()).toBe('new');
  });
  it('adopting the server set makes the first paint equal the final one', () => {
    expect(firstPaint('adopted')).toBe(finalPaint());
  });
  it('a client-only setup paints the old checkout first', () => {
    expect(firstPaint('client-only')).toBe('old');
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `cd apps/docs && npx vitest run components/product/feature-flags/no-flicker.test.ts`
Expected: FAIL, cannot resolve `./no-flicker`.

- [ ] **Step 3: Implement** `no-flicker.ts`:

```ts
import {
  adoptDecisions,
  createFeatures,
  type DecisionSet,
} from '@evanion/feature';

export const VISITOR = { targetingKey: 'cust-0042', role: 'member' };

function store() {
  return createFeatures([
    {
      key: 'new-checkout',
      enabled: true,
      rules: [
        { id: 'members', when: [{ field: 'role', op: 'eq', value: 'member' }] },
      ],
    },
  ]);
}

/** The server's decisions for the visitor, as they arrive in the page: serialised and parsed. */
export function serverSet(): DecisionSet {
  return JSON.parse(JSON.stringify(store().snapshot(VISITOR))) as DecisionSet;
}

const paint = (enabled: boolean) => (enabled ? 'new' : 'old');

/** What the visitor ends up seeing. */
export function finalPaint(): 'old' | 'new' {
  return paint(store().resolve(VISITOR)['new-checkout'].enabled);
}

/**
 * The first paint. `adopted` is the browser adopting the server's set before it
 * renders. `client-only` stands for a page that renders before anything is
 * decided, so it paints the default (the old checkout) and swaps later.
 */
export function firstPaint(mode: 'client-only' | 'adopted'): 'old' | 'new' {
  if (mode === 'client-only') return 'old';
  return paint(
    adoptDecisions(store(), serverSet(), { context: VISITOR })['new-checkout']
      .enabled,
  );
}
```

- [ ] **Step 4: Write the failing render test** `no-flicker-demo.test.tsx` (covers Review Focus 4):

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NoFlickerDemo from './NoFlickerDemo';

function motion(reduced: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}
afterEach(() => vi.useRealTimers());

describe('NoFlickerDemo', () => {
  it('labels the client-only side as a simulation and starts it on the old checkout', () => {
    motion(false);
    render(<NoFlickerDemo />);
    expect(
      screen.getByText(/decided in the browser after load/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/decided on the server, adopted by the browser/i),
    ).toBeInTheDocument();
    const [client, adopted] = screen.getAllByRole('figure');
    expect(client).toHaveTextContent(/old checkout/i);
    expect(adopted).toHaveTextContent(/new checkout/i);
  });
  it('under reduced motion shows both end states and a caption, without a Replay button', () => {
    motion(true);
    render(<NoFlickerDemo />);
    expect(screen.queryByRole('button', { name: /replay/i })).toBeNull();
    expect(screen.getByText(/swapped after load/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Implement** `NoFlickerDemo.tsx` (`'use client'`): two `ReplayFrame`s side by side (stacked under 600px). Left title "Decided in the browser after load (a typical setup)", frames `[<Checkout kind={firstPaint('client-only')} />, <Checkout kind={finalPaint()} />]`, interval 900. Right title "Decided on the server, adopted by the browser", frames `[<Checkout kind={firstPaint('adopted')} />]` (a single frame: nothing changes). `Checkout` renders "Old checkout" or "New checkout" in a small mock card. Under reduced motion (read once like `ReplayFrame` does), render under the left frame the line "Old checkout first, swapped after load". One shared Replay button is not needed: each frame has its own.
- [ ] **Step 6: Run both tests**

Run: `cd apps/docs && npx vitest run components/product/feature-flags/no-flicker`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/docs/components/product/feature-flags/no-flicker.ts apps/docs/components/product/feature-flags/no-flicker.test.ts apps/docs/components/product/feature-flags/NoFlickerDemo.tsx apps/docs/components/product/feature-flags/no-flicker-demo.test.tsx
git commit -m "feat(docs): show a page arriving with its features decided"
```

---

### Task 8: The page system, the route and the registry contract

**Files:**

- Create: `apps/docs/components/product/demos.ts`, `ProductPageView.tsx`, `ProductHero.tsx`, `Scene.tsx`, `CodeSample.tsx`, `InstallBlock.tsx`, `NextSteps.tsx`, `region.ts`, `product.css`
- Create: `apps/docs/app/(product)/layout.tsx`, `apps/docs/app/(product)/[product]/page.tsx`
- Test: `apps/docs/components/product/contract.test.ts`, `apps/docs/components/product/product-page-view.test.tsx`
- Modify: `tools/repo-checks/src/doc-links.test.ts` (product routes count as routes)

**Interfaces:**

- Consumes: Task 1 (`ProductPage`, `products`, `productBySlug`, `productMetadata`, `productJsonLd`), demos from Tasks 4–7, `FeatureDemo` from `components/landing`.
- Produces:

  ```ts
  // demos.ts
  export const demos: Record<DemoId, React.ComponentType>;
  // region.ts
  export function regionCode(file: string, region: string): string; // the region's code, with the test plumbing lines removed
  // ProductPageView.tsx
  export function ProductPageView(props: {
    page: ProductPage;
    code: string;
  }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing contract test** `contract.test.ts`:

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { demos } from './demos';
import { productJsonLd, productMetadata } from './metadata';
import { regionCode } from './region';
import { products } from './registry';

const DOCS = join(import.meta.dirname, '../..');

/** A docs link resolves when content/next has the page it names. */
function resolves(href: string): boolean {
  const path = href.replace(/^\/docs\//, '').replace(/\/$/, '');
  const [slug, ...rest] = path.split('/');
  const page = rest.join('/') || 'index';
  return existsSync(join(DOCS, 'content', 'next', slug, `${page}.mdx`));
}

describe.each(products.map((p) => [p.slug, p] as const))(
  'product page %s',
  (_, page) => {
    it('has metadata and structured data', () => {
      expect(productMetadata(page).title).toBeTruthy();
      expect(productJsonLd(page).name).toBe(page.packageName);
    });
    it('has scenes, each naming a known demo', () => {
      expect(page.scenes.length).toBeGreaterThan(0);
      for (const id of [page.hero.demo, ...page.scenes.map((s) => s.demo)])
        expect(demos[id]).toBeDefined();
    });
    it('links only docs pages that exist', () => {
      const links = [
        ...page.hero.actions,
        ...page.scenes.map((s) => s.howItWorks),
        page.codeSample.link,
        ...page.next.links,
      ]
        .map((l) => l.href)
        .filter((h) => h.startsWith('/docs/'));
      expect(links.filter((h) => !resolves(h))).toEqual([]);
    });
    it('shows a code sample from a tested region', () => {
      expect(regionCode(page.codeSample.file, page.codeSample.region)).toMatch(
        /\S/,
      );
    });
  },
);
```

and `product-page-view.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductPageView } from './ProductPageView';
import { productBySlug } from './registry';

describe('ProductPageView', () => {
  it('renders the hero, one section per scene, the code sample and the install command', () => {
    const page = productBySlug('feature-flags');
    render(<ProductPageView page={page} code="const x = 1;" />);
    expect(
      screen.getByRole('heading', { level: 1, name: page.hero.promise }),
    ).toBeInTheDocument();
    for (const scene of page.scenes)
      expect(
        screen.getByRole('heading', { level: 2, name: scene.title }),
      ).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    expect(screen.getByText(page.install.command)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and see them fail**

Run: `cd apps/docs && npx vitest run components/product/contract.test.ts components/product/product-page-view.test.tsx`
Expected: FAIL, cannot resolve `./demos`, `./region`, `./ProductPageView`.

- [ ] **Step 3: Implement the modules.** `region.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readRegion } from '@evanion/doc-examples/regions';

/** The workspace root: the nearest directory above the working directory holding `nx.json`. */
function workspaceRoot(): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, 'nx.json'))) {
    const up = dirname(dir);
    if (up === dir) throw new Error('No nx.json above the working directory');
    dir = up;
  }
  return dir;
}

/** Lines a region carries for its test run and a reader never needs. */
const PLUMBING = [
  /^\/\*\* @jsxRuntime classic \*\/$/,
  /^import \* as React from 'react';$/,
  /^\/\/ ---cut---$/,
];

/** A tested region's code, read at build time, without its test plumbing or `// ->` result comments. */
export function regionCode(file: string, region: string): string {
  const source = readFileSync(join(workspaceRoot(), file), 'utf8');
  return readRegion(source, file, region)
    .code.split('\n')
    .filter((line) => !PLUMBING.some((p) => p.test(line.trim())))
    .map((line) => line.replace(/\s*\/\/ -> .*$/, ''))
    .join('\n')
    .trim();
}
```

`demos.ts`:

```ts
import type { ComponentType } from 'react';
import FeatureDemo from '../landing/FeatureDemo';
import CascadeDemo from './feature-flags/CascadeDemo';
import NoFlickerDemo from './feature-flags/NoFlickerDemo';
import ScheduleDemo from './feature-flags/ScheduleDemo';
import VariantsDemo from './feature-flags/VariantsDemo';
import type { DemoId } from './types';

/** Every demo a product page can name, by id. */
export const demos: Record<DemoId, ComponentType> = {
  rollout: FeatureDemo,
  schedule: ScheduleDemo,
  cascade: CascadeDemo,
  variants: VariantsDemo,
  'no-flicker': NoFlickerDemo,
};
```

`ProductHero.tsx`, `Scene.tsx`, `CodeSample.tsx`, `InstallBlock.tsx`, `NextSteps.tsx`: server components taking the matching slice of `ProductPage` (`hero`, one `SceneDefinition`, `codeSample` plus `code`, `install`, `next`). `ProductHero` renders `<h1>{promise}</h1><p>{line}</p>`, the actions as links (first one styled as the primary button), then `<figure className="landing-proof">` with the hero demo. `Scene` renders `<section id={scene.id}><h2>{title}</h2><p>{lede}</p><figure className="landing-proof">{demo}<figcaption className="landing-proof__caption">{caption}</figcaption></figure><a href={howItWorks.href}>{howItWorks.label} →</a></section>`. `CodeSample` renders `<h2>`, lede, `<pre className="code-view"><code>{code}</code></pre>`, the link. `InstallBlock` renders `<h2>` and `<pre><code>{command}</code></pre>`. `NextSteps` renders `<h2>` and a list of links.

`ProductPageView.tsx`:

```tsx
import { categoricalClass } from '@evanion/baize-ui/tokens';
import { packages } from '../../app/navigation';
import { CodeSample } from './CodeSample';
import { demos } from './demos';
import { InstallBlock } from './InstallBlock';
import { NextSteps } from './NextSteps';
import { ProductHero } from './ProductHero';
import { Scene } from './Scene';
import type { ProductPage } from './types';
import '../landing/landing.css';
import './product.css';

/** Any product page, from its definition. `code` is the code sample, read at build time. */
export function ProductPageView({
  page,
  code,
}: {
  page: ProductPage;
  code: string;
}) {
  const lead = packages.find((p) => p.name === page.packageName);
  const Hero = demos[page.hero.demo];
  return (
    <main
      className={`product docs-identity ${lead ? categoricalClass(lead.hue) : ''}`}
    >
      <ProductHero hero={page.hero} demo={<Hero />} />
      {page.scenes.map((scene) => {
        const Demo = demos[scene.demo];
        return <Scene key={scene.id} scene={scene} demo={<Demo />} />;
      })}
      <CodeSample sample={page.codeSample} code={code} />
      <InstallBlock install={page.install} />
      <NextSteps next={page.next} />
    </main>
  );
}
```

`product.css`: `.product` max-width 72rem, centred, 1.25rem side padding; sections spaced 4rem (2.5rem under 600px); `h1` uses `var(--font-title)` at clamp(2rem, 6vw, 3.5rem); the primary action uses the hue as background; nothing wider than the viewport at 360px (`min-width: 0` on grid children, `overflow-x: auto` on `pre`).

- [ ] **Step 4: The route.** Read `node_modules/next/dist/docs/` for `generateStaticParams`, `dynamicParams` and `generateMetadata` in Next 16 first. `app/(product)/layout.tsx`:

```tsx
import { SkipNavContent } from 'nextra/components';
import type { PropsWithChildren } from 'react';
import Chrome from '../chrome';
import { sitePageMap } from '../page-maps';

/** The site's header and footer around a product page, without the docs sidebar. */
export default async function ProductLayout({ children }: PropsWithChildren) {
  return (
    <Chrome pageMap={await sitePageMap([])}>
      <SkipNavContent />
      {children}
    </Chrome>
  );
}
```

(If the home layout passes something else to hide the sidebar, mirror `app/(home)/layout.tsx` exactly instead.)

`app/(product)/[product]/page.tsx`:

```tsx
import { ProductPageView } from '../../../components/product/ProductPageView';
import {
  productJsonLd,
  productMetadata,
} from '../../../components/product/metadata';
import { regionCode } from '../../../components/product/region';
import { productBySlug, products } from '../../../components/product/registry';

export const dynamicParams = false;

export function generateStaticParams() {
  return products.map((p) => ({ product: p.slug }));
}

interface Props {
  params: Promise<{ product: string }>;
}

export async function generateMetadata({ params }: Props) {
  return productMetadata(productBySlug((await params).product));
}

export default async function Page({ params }: Props) {
  const page = productBySlug((await params).product);
  const code = regionCode(page.codeSample.file, page.codeSample.region);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd(page)),
        }}
      />
      <ProductPageView page={page} code={code} />
    </>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `cd apps/docs && npx vitest run components/product`
Expected: PASS (contract per product, view, primitives, scenes).

- [ ] **Step 6: Product routes in the link check (Review Focus 5).** In `tools/repo-checks/src/doc-links.test.ts`, load `apps/docs/components/product/product-slugs.mjs` the way the file loads `redirects.mjs` (dynamic import with `pathToFileURL`) and add each slug to `routes` as `/${slug}`. Add a test:

```ts
it('counts every product page as a route', async () => {
  const { productSlugs } = (await import(
    pathToFileURL(join(DOCS, 'components', 'product', 'product-slugs.mjs')).href
  )) as { productSlugs: string[] };
  expect(productSlugs).toContain('feature-flags');
});
```

Run: `cd tools/repo-checks && npx vitest run src/doc-links.test.ts` — Expected: PASS.

- [ ] **Step 7: Build and check the export**

Run: `npx nx run docs:build --skip-nx-cache && cd apps/docs && npm run postbuild`
Expected: exit 0; `apps/docs/out/feature-flags/index.html` exists, contains `"@type":"SoftwareSourceCode"` and `<link rel="canonical" href="https://libs.evanion.com/feature-flags/"`; `grep -c 'feature-flags' apps/docs/out/sitemap.xml` ≥ 1.

- [ ] **Step 8: Commit**

```bash
git add apps/docs/components/product apps/docs/app/'(product)' tools/repo-checks/src/doc-links.test.ts
git commit -m "feat(docs): render a product page from its definition at /feature-flags/"
```

---

### Task 9: Links into the page, and Gemma's copy

**Files:**

- Modify: `apps/docs/components/landing/sections.tsx` (`Pair`), `apps/docs/content/next/feature/index.mdx`, `apps/docs/components/product/pages/feature-flags.ts`
- Test: `apps/docs/components/landing/sections.test.tsx` (create if absent; else add a case)

**Interfaces:**

- Consumes: `productForGroup` (Task 1).

- [ ] **Step 1: Write the failing test** for the frontpage link:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pair } from './sections';

describe('a family section with a product page', () => {
  it('links its product page', () => {
    render(<Pair group="feature" />);
    expect(
      screen.getByRole('link', { name: /see what it does/i }),
    ).toHaveAttribute('href', '/feature-flags/');
  });
});
```

Run: `cd apps/docs && npx vitest run components/landing/sections.test.tsx` — Expected: FAIL (no such link).

- [ ] **Step 2: Implement.** In `Pair`, after the group's `line`, render `{product && <a className="landing-route__product" href={`/${product.slug}/`}>See what it does →</a>}` with `const product = productForGroup(id);`. Run the test: PASS.
- [ ] **Step 3: Docs overview link.** In `content/next/feature/index.mdx`, add after the opening paragraphs one sentence linking `[the feature flags page](/feature-flags/)` (Gemma words it in Step 4 with the rest). Run `cd tools/repo-checks && npx vitest run src/doc-links.test.ts` — Expected: PASS.
- [ ] **Step 4: Gemma's copy, in dialogue.** Write `docs/superpowers/scratch/feature-flags-copy.md` (not committed) containing: the reader's situation (first time on this page; wants to know what it is, whether it is worth it for their project, why choose it; fun and low-technical), the angle and the Global Constraints' copy rules, each scene's behaviour in one line, and the current copy from `pages/feature-flags.ts` (every field). Run `node /Volumes/projects/Personal/open-source/.git/governor-tools/gemma.mjs <file> --ask "<ask her to rewrite every field for that reader, keep the structure, return the fields as 'field: text' lines, and add a NOTES: line on what she changed and why>"`. Review her result at page level as a colleague; send one round of feedback if needed, letting her push back. Fact-fix only claims about the library that are wrong. Put her text into `pages/feature-flags.ts`, set `draft: false`, and reword the overview sentence from Step 3 with her in the same round.
- [ ] **Step 5: Run the contract, view and link tests**

Run: `cd apps/docs && npx vitest run components/product components/landing && cd ../../tools/repo-checks && npx vitest run src/doc-links.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/docs/components/landing apps/docs/content/next/feature/index.mdx apps/docs/components/product/pages/feature-flags.ts
git commit -m "feat(docs): link the feature flags page from the frontpage and the overview"
```

---

### Task 10: Cold read, verification and PR

**Files:** fixes only, as the cold read finds them.

- [ ] **Step 1: Full verification**

Run: `npx nx run-many -t test lint typecheck -p docs repo-checks --parallel=2 --skip-nx-cache`, then `npx nx run docs:build --skip-nx-cache && cd apps/docs && npm run postbuild`, then `npx prettier --check $(git diff --name-only origin/main)`.
Expected: all exit 0.

- [ ] **Step 2: Cold read.** Start `npx nx run docs:dev --port=3456` in the worktree (no build while it runs). Dispatch one fresh agent (Sonnet) using only the browser at http://localhost:3456/feature-flags/ at 1280px and at 360px, with the same brief as the earlier frontpage cold reads: first impression before touching anything; then every scene; report what the library is and why to pick it in their own words, which scene made it click, what confused them, and the three most useful changes.
- [ ] **Step 3: Rule on the findings.** Fix anything that makes a scene teach the wrong thing or breaks at 360px (each fix with a test where the behaviour is testable); ledger the rest as rulings or deferred minors.
- [ ] **Step 4: Push and open the PR** with auto-merge, body listing the scenes, the reuse structure, verification counts, the cold read summary and deferred minors.
