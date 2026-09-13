# Interactive examples across the documentation site

Status: proposed
Depends on: `2026-09-10-demo-apps.md` (the docs integration this extends),
`tools/doc-examples` (the region loader and the `// -> value` rewriter, shipped),
`2026-09-12-baize-ui.md` (the design system the probe chrome is built from)
Prior art: Zod's landing playground (evaluates, one page only), Radix docs
(react-live against the real packages), VitePress region imports, Rust's
`#[doc]` tests

## Why

The landing page has an editable JSON demo feeding `@evanion/react-widget`. It
was designed for that page: the input is data, the components are fixed, and
the editor is a `<textarea>` under a highlighted `<pre>` so that nothing but
the page's own CSS ships with it.

Extending it to the rest of the site breaks on two things.

The landing page edits data. Almost every other example on the site is code:
`Luhn.generate('foo')`, `URN.parse('urn:user:1337')`, `createToken().generate()`.
A JSON editor cannot make those interactive.

And the cost calculation inverts. CodeMirror 6 scoped to JSON measured 87–98 kB
gzipped and was rejected because the landing page's whole client chunk is
6.7 kB gzipped. Spread over 40 content pages plus the landing page it loads
once and caches, so that rejection does not carry over.

The thing that actually constrains the design is neither. Examples in this repo
are executed as tests. `libs/luhn`, `libs/urn` and `libs/token` wire
`docExamples()` into their Vitest config, the rewriter in
`tools/doc-examples/src/expect-comments.ts` turns `EXPR; // -> VALUE` into
`expect(EXPR).toEqual(VALUE)`, and `tools/repo-checks` fails the build when a
region marker is malformed or a referenced region is gone. That machinery exists
because documented values had drifted from the code and a check character in a
doc had been written by hand rather than computed.

An interactive example that is a second copy of a tested one drifts the same
way. Every decision below is downstream of that.

## Decisions

1. Interactive examples go on four packages, not eight: `luhn`, `token`, `urn`
   and `feature`. The other four keep static tested blocks.
2. Two mechanisms, picked by what the example is. A **probe** — fixed code, one
   editable input, the real function called on every keystroke — for the value
   packages. **react-live** for `@evanion/react-widget`, the only package whose
   examples define their own components.
3. No general-purpose code editor on package pages. CodeMirror and Sandpack are
   both rejected, with numbers in section 4.
4. Monaco is removed from `WidgetPlayground`. react-live's own `LiveEditor`
   replaces it: +4.0 kB gzipped, against a runtime fetch of Monaco from
   cdn.jsdelivr.net that the site currently makes.
5. A probe's initial input is the input from the README region the page already
   quotes, and a repo-check asserts the probe over that input produces the value
   the region claims. That is what makes the interactive example the tested one
   rather than a copy of it.
6. Probes are lazily-loaded islands, one module per package, loaded only on the
   pages that use one.
7. `@evanion/token` swaps `node:crypto`'s `randomBytes` for
   `globalThis.crypto.getRandomValues`. Prerequisite, and a library change, not
   a docs change.
8. The landing page's `DataDemo` stays as it is. It is the site's only data
   editor and it is on the critical path; nothing here replaces it.

Decision 1 is the one this spec exists to argue. Decision 7 is a real library
change made for a documentation reason, which is the one I am least comfortable
with. Decision 8 is the one most likely to be reversed later.

## 1. Three kinds of example

**Static, tested.** A fenced block in a README, run by doctest, pulled into a
docs page by `file=… region=…`. This is the default and stays the default. It is
already the best outcome available for most pages: the value in the doc is the
value the code produced on the last CI run.

**A probe.** The code is static and tested; one argument in it is an `<input>`.
Typing changes the argument, the real library function runs in the browser, and
the result appears. No transpiler, no `eval`, no editor.

````mdx
```ts file=libs/luhn/README.md region=generate

```

<Probe package="luhn" probe="generate" />
````

which renders roughly:

```
  phrase  [ foo            ]

  Luhn.generate('foo')
  → { phrase: 'foo', checksum: '5', filtered: 0 }
```

**Live code.** react-live: the reader edits arbitrary JSX, it is transpiled by
sucrase and evaluated against a fixed scope object. This already exists as
`apps/docs/components/WidgetPlayground.tsx` and stays on the React Widget pages.

The rule for choosing: if the reader's question is "what does this return for my
input", it is a probe. If the reader's question is "what happens when I supply my
own component", it is live code. If the reader's question is answered by reading,
it stays static.

## 2. The per-package verdict

| Package                 | Verdict            | Why                                                                                                                                    |
| ----------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `luhn`                  | probe              | The check character changing as you retype the phrase is the documentation. Filtering and case folding are visible in the same output. |
| `token`                 | probe, two of them | `validate` over a typed code shows `check-failed` and `outside-alphabet` separately; `generate` needs a button, not an input.          |
| `urn`                   | probe              | RFC 8141 component splitting is the hardest thing in the package to hold in your head, and `parse` shows it in one call.               |
| `feature`               | probe              | `inRollout(userId, 10, flagKey)` over a typed id is the only way to show a 10% rollout is stable per user rather than random.          |
| `react-widget`          | live code (exists) | Its examples define components. Nothing but evaluation demonstrates that.                                                              |
| `astro-widget`          | no                 | `.astro` components compile at build time. There is no browser runtime for one, and no bundler in scope will produce one.              |
| `compose`               | no                 | Its value is in the types. The runtime result of composing three functions is not surprising, and a type error is not renderable.      |
| `nestjs-correlation-id` | no                 | Needs an HTTP request, a DI container and `AsyncLocalStorage` across it. The demonstrable unit is a running server.                    |

Four yes, four no, and the split is not arbitrary: the four yeses are the four
packages whose public API is a pure function from a string to a value.

Two of the noes deserve more than a table row.

`compose` is the case where interactivity would actively mislead. The package's
whole claim is that `compose(a, b, c)` type-checks the seam between each pair,
and `content/compose/type-checking.mdx` is where that is argued. An editable
example that evaluates would let a reader write a mismatched pair and see it run
fine, because at runtime it does. Showing the type error needs `tsc` in the
browser — the TypeScript compiler is roughly 7 MB minified, and Monaco's worker
is how sites that do this pay for it. Not for one page.

`astro-widget` has an interactive example already, and it is a deployed app:
`apps/storefront`. Linking to it costs nothing and shows more than a playground
would.

## 3. The probe, and why it is not an editor

A probe is about 40 lines. It imports the package, holds one string in state,
calls the function, and renders the result or the thrown error.

```tsx
// apps/docs/components/probes/luhn.ts
import { Luhn } from '@evanion/luhn';

export const generate = {
  // The same call the README region makes, with the argument named.
  call: (phrase: string) => Luhn.generate(phrase),
  source: (phrase: string) => `Luhn.generate(${JSON.stringify(phrase)})`,
  label: 'phrase',
  // Read back out of libs/luhn/README.md by the test in section 5.
  region: { file: 'libs/luhn/README.md', name: 'generate' },
};
```

The properties that follow from this shape, each of which is a thing react-live
or CodeMirror would have cost:

- Nothing is transpiled, so no sucrase. Measured below: 47.7 kB gzipped saved.
- Nothing is evaluated, so section 7 is short.
- The function is the package's own export, reached through the same specifier a
  consumer writes, so there is no mock to keep in step.
- It renders on the server as its initial state and hydrates. A static export
  serves a page that already shows the documented value to a reader with JS off.

What it cannot do is let a reader change the call. Somebody who wants to know
what `Luhn.generate` does with a custom dictionary has to read the dictionaries
page. I think that is the right trade for a library whose API is four functions;
it is the decision to revisit first if it turns out to be wrong.

## 4. Mechanism comparison

All sizes measured in this repo on 2026-09-13: `esbuild --bundle --minify
--format=esm`, `react` and `react-dom` external, `NODE_ENV=production`, gzip -9.
Versions are the installed ones: react-live 4.1.8, sucrase 3.35.1,
@monaco-editor/react 4.7.0, monaco-editor 0.56.0.

| Mechanism                               | gzipped                         | Lazy island | TypeScript                           | Is the edited code the tested code |
| --------------------------------------- | ------------------------------- | ----------- | ------------------------------------ | ---------------------------------- |
| Probe                                   | ~1 kB + the package             | yes         | irrelevant, no source is parsed      | yes, by construction (section 5)   |
| react-live, evaluation only             | 74.1 kB                         | yes         | types stripped by sucrase, unchecked | only via a test that evaluates it  |
| react-live + `LiveEditor`               | 78.1 kB                         | yes         | same                                 | same                               |
| CodeMirror 6, JSON mode (prior measure) | 87–98 kB                        | yes         | none, it does not evaluate           | no, it cannot run anything         |
| Sandpack                                | ~350 kB + an iframe + a bundler | yes         | full, via its own tsserver           | no                                 |

sucrase alone is 47.7 kB of react-live's 74.1 kB. That is the price of being able
to type JSX, and it buys nothing on a page where the example is
`URN.parse('urn:user:1337')`.

Sandpack is rejected on three counts and the size is the least of them. It runs
the example in a cross-origin iframe with its own module resolution, so the
package the reader edits against is whatever version the bundler fetched from
npm rather than the workspace source the doctest ran. It needs a network round
trip per example. And its TypeScript story — the one thing it genuinely wins on —
serves `compose`, which section 2 rules out for a different reason.

CodeMirror is rejected because it does not evaluate. The 87–98 kB buys
highlighting and editing of text that then has to be run by something else, so
the real comparison is CodeMirror + sucrase + a `new Function`, which is react-live
with more parts.

### Monaco goes

`WidgetPlayground` currently loads `@monaco-editor/react`. The wrapper is 5.2 kB
gzipped and Monaco itself is not in the bundle at all: `@monaco-editor/react`
fetches monaco-editor from cdn.jsdelivr.net unless `loader.config({ monaco })` is
called, and nothing in `apps/docs` calls it. So the site currently has a
third-party CDN in its runtime path, on a static export that otherwise has none.

It also costs the 60-line `handleEditorDidMount` in `WidgetPlayground.tsx`: a
hand-written subset of React's types, registered at
`file:///node_modules/@types/react/index.d.ts`, because Monaco resolves modules
inside its worker and cannot see the real `@types/react`. That subset is a fifth
place where React's types are written down, and it is already wrong in the
directions nobody has noticed.

react-live's `LiveEditor` is the replacement. It is prism-react-renderer-based,
already a transitive dependency, and it costs 4.0 kB gzipped on top of the
`LiveProvider`/`LivePreview`/`LiveError` trio the page already loads — measured by
differencing the two bundles above. What is lost is autocomplete and hover types
in the playground. For three snippets that fit on a screen, that is not much.

## 5. The relationship to doctest

This is the part worth getting right, and it is achievable.

A probe carries a `region` pointing at the README block the page already quotes.
A test in `tools/repo-checks` reads that region with `readRegion` — already
exported from `@evanion/doc-examples` — extracts the argument from it, and asserts
that the probe called with that argument produces the value the region claims.

```ts
// tools/repo-checks/src/probe-regions.test.ts, sketch
const { code } = readRegion(
  readFileSync(probe.region.file, 'utf8'),
  probe.region.file,
  probe.region.name,
);
// 'Luhn.generate(\'foo\'); // -> { phrase: \'foo\', checksum: \'5\', filtered: 0 }'
const [, arg, claimed] = code.match(/\((.*)\);\s*\/\/ -> (.*)$/m);
expect(probe.call(JSON.parse(arg.replace(/'/g, '"')))).toEqual(
  evaluate(claimed),
);
```

Three things then hold at once, and a change that breaks any one of them fails
CI rather than shipping:

- The README block is executed by Vitest, because it always was.
- The page renders that block, because the region loader fills it and a missing
  region fails `next build`.
- The probe's initial state is that block's input and output, because this test
  says so.

The reader's first sight of the probe is therefore the tested example verbatim.
Once they type, the output is computed rather than documented, so there is
nothing left to drift.

The cost is the regex above. It is reading the same `EXPR; // -> VALUE` form the
rewriter already parses, so the honest version of this reuses the rewriter's
scanner rather than writing a second one — `indexOfLineComment` and the `->`
handling in `expect-comments.ts` are already the parser for this, and should be
exported rather than reimplemented. I have not checked how much refactoring that
export needs; it looks like a signature change, not a rewrite.

Two of the four probe packages need region markers added first. `libs/urn`
already has five; `libs/luhn` and `libs/token` have doctested blocks and no
markers, and `libs/feature` has neither — nine, five and zero doctest fences
respectively. Adding markers is mechanical. Wiring `docExamples()` into
`libs/feature` is not, and is the reason its probe lands last.

For react-live the same guarantee is weaker and already in place:
`apps/docs/components/playground-examples.test.tsx` evaluates each shipped
snippet through react-live with the real scope and asserts on the DOM, and
asserts `playgroundScope.createWidgets === createWidgets`. The snippet is tested;
it is just not the README's snippet. Closing that gap means moving the three
playground examples into `libs/widget/README.md` as regions, which requires the
widget README to run under doctest — it currently has zero doctest fences, and
its examples render React, which the doctest setup does not do today. Out of
scope here; worth a line in the widget package's own backlog.

## 6. What a reader can break

The site is a static export on docs.evanion.com. No server, no session, no API
key on the page, no form that posts anywhere.

A probe evaluates nothing. It passes a string to a library function. The worst
input is one that makes the function throw, which the probe catches and renders,
or one that makes it slow — `URN.parse` on a 10 MB paste, say — which janks the
reader's own tab. The probe truncates its input at a few hundred characters and
that is the whole mitigation.

react-live is different in kind. It transpiles a string with sucrase and runs it
with `new Function` in the page's own origin. What that reaches:

- `localStorage` on docs.evanion.com, which holds the theme preference
  next-themes writes and nothing else.
- Cookies readable from docs.evanion.com. The site sets none. Anything ever set
  on `.evanion.com` would be readable here, which is the one exposure that could
  become real without anybody touching this repo.
- The DOM of the page, so a snippet can deface the page for the person who typed
  it.

There is no persistence and no sharing: react-live's code lives in React state,
not in the URL, so there is no link a reader can send that makes somebody else's
browser run their code. Keeping it that way is a decision — do not add
share-via-URL to the playground, and if that is ever wanted, the shared thing is
a named example id, not a code string.

Net: the exposure is a reader attacking their own tab, on an origin holding a
theme preference. It does not matter today. It is still a reason to keep
evaluation on the one package that needs it rather than putting it on 41 pages.

## 7. The landing page's editor

`DataDemo` stays, unchanged.

The argument for folding it in is that two editing surfaces is a maintenance
liability. That is true, and the count does not actually go up here: the site has
two today (the landing overlay and Monaco), and it has two after (the landing
overlay and `LiveEditor`), with the CDN dependency gone. Probes add no editor at
all.

The argument against folding is that they edit different things. `DataDemo` edits
JSON and its highlighter is a 6-line JSON tokenizer emitting the site's own token
classes; `LiveEditor` edits JSX and highlights with prism. Sharing a component
between them would mean one that takes a tokenizer as a prop, which is a shared
`<textarea>` wrapper and a comment explaining why it exists.

And the landing page is the one page where the 6.7 kB budget is real. It is the
first paint for every visitor, most of whom bounce. Loading react-live there to
avoid a 60-line component is the wrong direction.

If this is revisited, the thing to unify is the field chrome — label, focus ring,
error line — into `@evanion/baize-ui`, where the design system already lives. Not
the editors.

## 8. What it costs to not do this

Static tested examples are already good. They are accurate by construction,
they render with no JS, they work in a search index, and they are what a reader
copying into their editor actually wants. The failure this repo already fixed was
inaccuracy, not inertness.

So the honest accounting, per package:

- Doing nothing for `astro-widget`, `compose` and `nestjs-correlation-id` costs
  nothing. There is no interaction that would teach anything.
- Doing nothing for `react-widget` costs the playground that already exists, so
  the question there is only Monaco.
- Doing nothing for `luhn`, `token` and `urn` costs the one thing their docs
  cannot do in prose: showing that the check character depends on the input.
  `luhn`'s README explains filtering and case folding in four paragraphs; a probe
  shows both in one keystroke. This is the interactivity that earns its weight.
- `feature` is the marginal one. `bucketOf(value, seed)` returning the same
  number every time for a user id is genuinely counter-intuitive and a probe
  fixes it in one keystroke, but `libs/feature` is
  private, has no doctest wiring, and would need section 5's whole apparatus
  built for one control. If it gets cut, nothing else in this spec changes.

"Not worth it for four of eight, and for a fifth it is close" is the conclusion.

## 9. Sequencing

1. `libs/luhn` and `libs/token`: region markers around the blocks the docs pages
   already quote.
2. `tools/doc-examples`: export the value-claim scanner so the probe test can
   reuse it.
3. `apps/docs`: the `Probe` component, the `luhn` probe, the repo-check.
4. `urn` and `token` probes. Token needs decision 7 first.
5. `WidgetPlayground`: Monaco out, `LiveEditor` in.
6. `feature`, if it survives review.

Steps 1–3 are the ones that prove the design. Nothing after step 3 introduces a
mechanism.

## Testing

- The probe's initial input and output equal the region's, per package, read at
  test time from the README rather than duplicated in the test.
- Every probe's `call` is the package's own export, by identity — the assertion
  `playground-examples.test.tsx` already makes for `createWidgets`.
- A probe renders its documented output on the server, asserted on
  `renderToString`, so the static export is correct before hydration.
- A probe over an input that throws renders the error's message and keeps the
  last successful output, asserted for `Luhn.generate('')` (`EmptyInputError`)
  and `URN.parse('not a urn')`.
- Input longer than the truncation limit is truncated before the call, not after.
- `token`'s probe runs under the browser environment with no `node:crypto`
  available, which is what decision 7 is for and what would otherwise fail at
  build.
- Every page that mounts a probe still builds under `output: 'export'`, with the
  probe chunk absent from the landing page's chunk list.
- `WidgetPlayground` after decision 4 renders the same DOM for all three shipped
  examples as before, and `apps/docs` has no `@monaco-editor/react` import left.

## Where I am guessing

- That the region-to-probe extraction in section 5 reuses the rewriter's scanner
  with a signature change rather than a rewrite. I read `expect-comments.ts` and
  it looks right; I did not write it.
- The 4.0 kB for `LiveEditor` is a difference between two whole-package bundles.
  The real figure depends on how Turbopack splits it, and could be larger if it
  pulls a prism language pack the difference did not.
- That `globalThis.crypto.getRandomValues` is a clean swap for `randomBytes` in
  `libs/token/src/lib/token.ts:290`. It is one call site drawing `length - 1`
  bytes, so it looks like a two-line change, but it changes the library's runtime
  requirement and deserves its own review rather than being carried in on a docs
  spec.
- `feature`'s verdict. `bucketOf` and `inRollout` are exported from
  `libs/feature/src/index.ts` and take plain strings, so a probe over either is
  mechanically fine. Whether it is the example the page wants, rather than a flag
  set evaluated against a context, I have not read enough of the package to say.
