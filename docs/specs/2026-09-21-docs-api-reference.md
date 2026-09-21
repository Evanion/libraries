# A searchable API reference, generated from the declarations

Status: proposed, and revised twice. The first draft asked whether the complaint
was page length; the owner answered that it is not, and named four requirements
(§ "What is actually being asked"). The second draft proposed truncating the
docblock to its first paragraph; the owner answered that the whole docblock
stays, available on expand. § 3.4's measurement makes that free, and § 5.1.1
turned up that Twoslash's hover has been rendering the full docblock into the
page all along, where the search index cannot see it.
Packages: `@evanion/docs` (`apps/docs`), and one new entry point in
`tools/doc-examples` beside the region loader. No published package changes.
`libs/acl` gains nothing and loses nothing.
Depends on: `apps/docs/content/acl/api.mdx` (107 `##` headings, 105
`signature` fences, 1 `twoslash` fence, 1,426 lines),
`apps/docs/next.config.ts:9-11` (`search: { codeblocks: false }`, which § 3
turns on) and `:63` (`output: 'export'`),
`tools/doc-examples/src/mdx-region-loader.mjs:57-126` (`expandRegions`, the
shape § 5 recommends copying),
`tools/doc-examples/src/mdx-region-loader.mjs:24-31` (the comment fixing
`twoslash` as the only meta a region block may carry, which § 2 depends on),
`tools/repo-checks/src/doc-exports.test.ts:29-35` (G5's own statement that a
`signature` fence's body is not read),
`tools/repo-checks/src/doc-export-coverage.test.ts:25-36` (G10's two rules),
`:176-196` (the alias resolution and callability test § 5.1 reuses),
`:208-260` (`commentText` and `internalMark`, the working precedent for pulling
JSDoc through the TypeScript API), and `:300-338` (`executableCode`, whose
written-versus-expanded rule § 5.2 depends on and which this document got wrong
once),
`tools/repo-checks/src/doc-twoslash.test.ts:26-31` (Twoslash's defaults, and
why the libraries build before the docs app),
`libs/acl/src/index.ts:1-20` (the module docblock, and the `ruleId` paragraph
§ 5.2 ends on),
`docs/specs/2026-09-16-documentation-standard.md` § 5 (the `signature` tag),
§ 12 (G5's scope and the gap it names), decision 21 at `:185-189`, and the
evaluation at `:1039-1103` that considered a generator and declined every
candidate.
Measured against: this worktree at `d474dc8`, Nextra 4.6.1, Next 16.3.4,
TypeScript from the workspace root, Node v24.16.0, macOS 26.6.2, Apple M1 Pro.
Every count, timing and compiler result below was produced by running something
in this tree during this session, and the evidence sections say which.
Prior art: TypeDoc, Microsoft's api-extractor with api-documenter, Rustdoc and
`pkg.go.dev`, fetched from their own documentation on 2026-09-21 and worked in
§ 12. The one that attacks drift rather than rendering around it is
api-extractor, and its answer is a committed file a human reviews, not a page a
build emits.
Reads beside this: PR #256, `docs/specs/2026-09-21-reference-page-budget.md`,
which exempts a page named `api.mdx` from the word budget and measures
`acl/api.mdx` at 1,637 words across 107 entries. § 6 uses that number and § 0
records why length is settled.

## What is actually being asked

The owner asked for a better API reference component: searchable, and using
Twoslash so a reader gets real TypeScript hover information on signatures. The
first draft of this document raised one question, whether the complaint was
about page length, and the owner has answered it. Four requirements now stand:

1. The component displays the **JSDoc data**, not only the signature, with the
   full docblock available on expand and nothing dropped.
2. It carries a **Twoslash usage example** showing how to call the export.
3. It has **a search function of its own**.
4. Its output is **also indexed by Nextra's search**.

Length is not the subject and a page split is refused. Two measurements say so
independently. `doc-prose-budget.ts:14` skips fenced blocks, so generating every
signature on `acl/api.mdx` moves the recorded word count by exactly zero. And PR
#256 exempts a page named `api.mdx` from the budget outright, which takes length
off the table before this document starts. Every design below is free to add
words to the page.

Two premises in the original brief did turn over on measurement, and both stay
in this document because they decide the design.

`nextra/tsdoc` appears in no file of this repository. A grep for `tsdoc` outside
`node_modules` and `.git` returns two lines, both of them prose inside
`docs/specs/2026-09-16-documentation-standard.md`. The package is installed
because Nextra 4.6.1 ships it, and nothing here has ever called it.

The site's search already finds every export on `acl/api.mdx` by name. Pagefind
records 107 anchors for `/acl/api/`, one per `##` heading, and 3,463 indexed
words. What search cannot reach is the inside of a signature block, because
`next.config.ts:9-11` sets `search: { codeblocks: false }`, which puts
`data-pagefind-ignore="all"` on every `<pre>` the page renders. The built page
carries 106 of those attributes. § 3 measures the gap at 43 identifiers.

## Decisions

1. `nextra/tsdoc` is not imported anywhere in this repository. `generateDefinition`
   and `<TSDoc>` have never run against any package here. § 1.
2. `generateDefinition` takes one export at a time and enumerates nothing. Its
   input is a TypeScript source string plus an `exportName` (`base.js:19-23`),
   so documenting `@evanion/acl` means composing 88 code strings and making 88
   calls. § 1.1.
3. `generateDefinition` renders the wrong thing for 20 of the 88
   `@evanion/acl` exports and refuses 5 more, measured. A string-literal union
   resolves to `String`, so `FieldReason` produces 52 rows beginning
   `toString`, `charAt`, `charCodeAt`, `concat`. `CRUD_ACTIONS` produces the
   36 members of `Array`. Nothing in the output marks any of this as wrong.
   § 1.2.
4. The 25 exports `generateDefinition` refuses or mangles are the set
   Twoslash's `^?` handles correctly, measured: 9 of the 10 sampled emit their
   full member list or their index signature, and the tenth is generic in three
   parameters. The two mechanisms fail where the other works. § 1.3.
5. `<TSDoc>` renders a table and never a fence (`tsdoc.js:117-176`), so no
   output of that component can carry a Twoslash hover, and no configuration of
   it changes that. § 2.1.
6. The Twoslash hover path runs over the MDX AST during compile, reaching only
   a fence whose meta is exactly `twoslash` (`rehype-twoslash-popup.js:39-42`).
   A generated signature reaches a hover only by being written into the MDX
   source as a fence before Nextra's loader runs, which is the position the
   region loader already occupies. § 2.2.
7. A `twoslash` fence carrying `^?` over an import emits the page's
   hand-written block verbatim and cannot go stale. Measured, the query over
   `import { hydratePolicy } from '@evanion/acl'` returns
   `(alias) function hydratePolicy<Sub = Subject, R = AnyObjects, Keys extends string = string>(matrix: Matrix, options?: AccessOptions): Access<Sub, R, Keys>`,
   which is the content of `api.mdx:17-23` with different line breaks. § 2.3.
8. Today's `signature` fences cannot be re-tagged `twoslash`. Measured, the body
   of `api.mdx:17-23` throws under `createTwoslasher`, because a function
   declaration with no implementation is a type error. § 2.3.
9. A client component's markup is indexed by Pagefind on this static export,
   measured. `urn-probe.tsx` carries `'use client'` at line 1, and the string
   `WeatherURN.parse('urn:example:weather?=lat=39#today')` that it computes
   appears in the `/urn/components/` Pagefind fragment. Requirement 4 therefore
   does not by itself refuse a component, and the rule it imposes is narrower:
   whatever the component renders **with its initial state** is what gets
   indexed. § 3.4.
10. Nothing is dropped. The full docblock renders into the page and collapses;
    the first paragraph is the open view. The length objection was about what a
    reader scrolls past, and § 3.4's measurement answers it without deleting a
    word: Pagefind indexes an element carrying `hidden`, one carrying
    `display: none`, and a closed `<details>`, all measured. So the collapsed
    5,939 words are invisible to a scanning reader and present in the search
    index at the same time. § 5.1.
11. Twoslash's hover already carries the full docblock today, measured, and it
    is invisible to search. The `twoslash-popup-docs` element on
    `/acl/api/`'s one existing `twoslash` fence holds `assertAllowed`'s and
    `fixtureClock`'s docblocks as rendered markdown paragraphs, prerendered
    into the static HTML and absent from the MDX source. Two of three probe
    sentences are in `apps/docs/out/acl/api/index.html` and none of the three
    is in that page's Pagefind fragment, because the popup sits inside the
    `<pre>` that carries `data-pagefind-ignore="all"`. So the expand is not
    what makes the docblock available. It is what makes the docblock reachable
    without a pointer and findable by search. § 5.1.1.
12. A disclosure the reader opens, not a hover, as the primary. A hover is
    unreachable on a touch device and needs deliberate work to be keyboard
    reachable, and a 301-word docblock is material somebody reads slowly. Use a
    native `<details>`: it is keyboard reachable with no code, it stays open,
    it needs no JavaScript on a static export, and § 3.4 measured its closed
    content indexed. No component in `internal/baize-ui/src/index.ts` or
    `apps/docs/components` does this today, so a button-toggled region would be
    a new client component earning nothing. § 5.1.2.
13. Read the JSDoc through the TypeScript API the way
    `doc-export-coverage.test.ts:176-196` already does: resolve the alias when
    the symbol is one, then `getDocumentationComment(checker)` and
    `getJsDocTags(checker)`. That file also carries `commentText` at `:208-218`
    for a comment that arrives as nodes rather than a string, which happens as
    soon as the block holds a `{@link}`. Reuse it rather than writing a second
    one. § 5.1.
14. `@example` is not the source for the usage example. Measured, one of
    `@evanion/acl`'s 88 exports carries an `@example` tag, and 8 tags exist
    across every `libs/` package. Adopting `@example` means writing 87 examples
    into library source, and the repository's rule is that an example comes from
    a run. § 5.2.
15. The usage example is a **README region**, referenced by name from the page,
    through the loader that already exists. `libs/acl/README.md` carries 36
    regions and the packages' own tests run them. The API reference entry names
    one; it does not invent one. § 5.2.
16. An export with no example gets no example block, and that is the common case
    for a type. Measured under `content/acl/`, 43 of 88 exports are named in an
    executable fence and 33 of 34 callables are. The 45 with none are almost all
    types, which is the same reason G10 exempts a type from its exercised rule
    (`doc-export-coverage.test.ts:33-36`). § 5.2.
17. The component's own search and Nextra's search solve different problems and
    both ship, in that order of confidence. Pagefind answers the reader who
    arrives from outside knowing a name, and it already does (107 anchors). A
    filter answers the reader already on the page who does not know the name and
    is scrolling 107 entries. Neither substitutes for the other. § 9.
18. The filter renders every entry on first paint and hides on input. Hiding is
    safe and not rendering is fatal, both measured: Pagefind indexes an element
    carrying `hidden` and one carrying `display: none`, and it indexes nothing
    that reaches the DOM only after hydration. So the filter is a client
    component wrapping server-rendered children, and it never holds the entry
    list as data. § 9.2.
19. The entry stays authored in outline and generated in substance. The heading
    and the editorial prose are authored; the summary, the collapsed docblock,
    the signature fence and the example fence are all emitted by the loader from
    a source a test or the compiler already holds. § 6.
20. `search.codeblocks` stays `false`. Flipping it would index every fence on
    the site, including the 242 unexplained ones the allowance records and every
    `anti-example`, so a reader searching `denyRules` could land on a block the
    page is telling them not to write. § 3.2.
21. The 43 identifiers that live only inside a fence are fixed per entry by the
    generated JSDoc, not by a search-config change. A `@param` line names its
    parameter in prose, and prose is indexed. § 9.1 says how much of the 43 that
    reaches and admits it is not all of them.
22. Build a loader and not a runtime component for everything except the filter.
    Decision 21 of the documentation standard named that shape at `:1071-1076`.
    The filter is the one piece that has to be a client component, because it
    responds to typing. § 5, § 9.2.
23. G5 survives and gets stronger; G10's first rule stays the guard that
    matters. Under the loader a heading naming no export fails `next build`
    before G5 runs, and G5 keeps catching the `import` lines in every other
    fence on the site. G10's "every export has a heading" points the other way
    and nothing here answers it. § 7.
24. The loader serves every package and `@evanion/acl` goes first, because it is
    the only package with no entry in `doc-export-coverage-allowance.json`. The
    other nine carry 115 undocumented names between them. § 8.
25. Ship the loader with all four emissions, put `acl/api.mdx` on it, then stop
    and read the page. The filter lands second, behind a rendered page to filter.
    § 11.
26. The page is a component list and not a card grid. `CardGrid`'s track is
    `minmax(17rem, 1fr)` (`layout.tsx:13-14`) and the `hydratePolicy` signature
    is 154 characters on one line, so a card would wrap it about six times. An
    entry is a list item separated by a `rule` hairline, with no card radius and
    no card elevation. § 13.2.
27. The export name carries a hue from a new token family, and the chip beside
    it keeps saying the kind in words. Colour cannot carry meaning alone, and
    `global.css:300-302` already pins a non-platform chip inside an identity
    subtree to `lichen`, so the chip needs no new rule to stay the text channel.
    § 13.4.
28. Neither `categorical` nor `mechanism` can carry the kind, so the family is
    new. `categorical` is spent one hue per package with `docs-navigation.test.ts`
    failing on a repeat, and `mechanism` is the board-game vocabulary
    `categorical.ts:33-35` says the scales exist apart to avoid, "describing a
    URN library as engine building". `Title`'s refusal of a mechanism prop
    (`typography.tsx:47-49`) does not reach this case: it refuses a taxonomy laid
    over a thing from outside, and an export's kind is what the thing is. § 13.4.
29. Six members, derived by classifying all 376 exports of the 15 TypeScript
    entry points in `libs/` and `internal/`: `interface` 103, `typeAlias` 99,
    `function` 83, `constant` 49, `error` 38, `class` 4. An error is its own
    kind rather than a class, on 38 against 4 and on every package having an
    `errors.mdx`. No enum and no namespace appears in any export list, so
    neither gets a token. § 13.4.
30. Both grounds ship in the first commit, and the token test measures both and
    asserts the halves carry the same keys, which is what PR #260 landed for
    `availability`. Measured, the six dark values laid on paper reach 1.40:1 to
    1.51:1 against a 4.5:1 floor, which is the same defect arriving the same
    way. § 13.4.
31. The family binds `--baize-kind` and not `--baize-hue`, and this is forced
    rather than chosen. `global.css:275-277` paints the package hue onto every
    `h2` border in an identity subtree through `--baize-hue`, so a kind class
    binding that property on the `h2` would take the heading's rule with it and
    the package would lose the channel. § 13.4.
32. The filter is sticky, hides with `hidden`, never unmounts, and is absent
    rather than inert without JavaScript. Its empty state names the query and
    the kinds that were on, and offers a button that clears them. Escape clears
    the query. Every entry heading takes `scroll-margin-top` so the sticky row
    does not cover what a reader tabs or links to. § 13.5.
33. Motion is spent on the disclosure opening and nowhere else, at the kit's own
    120ms and easing, joining the existing `prefers-reduced-motion` block. No
    eyebrow, no `01 / 02 / 03`, no arrow after link text, no per-entry hover.
    § 13.6, § 13.7.

Decision 11 is the one that changes what the rest of the work is for, and it
came from a measurement nobody asked for. Decision 16 means a reader of a type
entry gets no example, and the page has to say so rather than look unfinished.
Decision 18 is the constraint that would break the filter if somebody
implemented it the obvious way. Decision 21 is the weakest claim here, and § 9.1
measures how weak. Decision 27 reverses what the previous draft of § 13.4 concluded, and that
section keeps the earlier reasoning rather than deleting it, because two of its
three arguments still hold and only the `Title` precedent turned out not to
reach. Decision 31 is the one that would otherwise be found the hard way.

## 0. Length is settled and is not the subject

The first draft's leading guess was that the owner wanted a shorter page. It is
wrong, and two things in the tree say so without needing the owner's answer.

`doc-prose-budget.ts:14` is explicit that the budget counts prose and not fenced
blocks. Every signature on `acl/api.mdx` is already inside a fence, so moving
those fences from hand-written to generated changes the recorded count by zero.
A reader of the first draft could have concluded that generation buys page
length. It buys none.

PR #256 removes the question entirely by exempting a page named `api.mdx` from
the budget, and it measures `acl/api.mdx` at 1,637 words across 107 entries, 15
words an entry. The 1,547 in `doc-prose-budget.json:2` is a stale allowance.
This document uses 1,637.

So signature drift and hover information are the point, the page may grow, and
nothing below is constrained by a word count.

## 1. What `nextra/tsdoc` actually does

The package exports three things (`dist/server/tsdoc/index.d.ts:1-3`):
`generateDefinition`, the `TSDoc` component, and `generateTsFromZod`. The third
is for Zod schemas and has no use here.

`generateDefinition` builds one `ts-morph` `Project` at module scope
(`base.js:7-15`) with `tsConfigFilePath: './tsconfig.json'` resolved against the
process working directory and `skipAddingFilesFromTsConfig: true`. Each call
writes the caller's code into a virtual file named `$.ts`, overwriting the
previous one, and reads the exported declarations out of it (`base.js:24-33`).

Three behaviours matter and none of them is documented on the component's own
page.

**It resolves re-exports and reports where the declaration really lives.**
`getExportedDeclarations()` follows the chain, and `filePath` is the declaration
file relative to the process working directory. Measured from `apps/docs`,
`hydratePolicy` resolves to `../../libs/acl/dist/hydrate-policy.d.ts`. That is
build output rather than source, because `apps/docs/tsconfig.json:29` sets
`customConditions: []` with a comment saying why: the docs app consumes
`@evanion/*` the way a published consumer does.

**It reads TSDoc and hands the prose to MDX.** The description is
`getDocumentationComment`, tags are `getJsDocTags`, an entry carrying
`@internal` is dropped (`base.js:56`), `@default` and `@defaultValue` fill the
table's third column, `@remarks` beginning with a backticked name overrides the
rendered type, and `@inline` expands a type alias in place. `{@link X}` is
replaced by the bare text `X` (`base.js:281`), so a doc link becomes prose and
never a link.

**It has two output shapes and picks between them on call signatures alone**
(`base.js:47-49`). A declaration whose type has call signatures returns
`signatures`; everything else returns `entries`, the property list. The second
branch is where it goes wrong.

### 1.1 One export per call

`BaseArgs` is `{ code, exportName, flattened }` (`types.d.ts:41-63`). There is
no module argument, no glob, and no list. Documenting `@evanion/acl` means
composing 88 source strings of the form
`import type { X } from '@evanion/acl'; export default X` and making 88 calls.
Enumerating the exports to compose those strings is a separate program, and
`doc-export-coverage.test.ts:141-196` already contains it.

Timed from `apps/docs` against the built `libs/acl/dist`, the first call costs
226 ms and seven subsequent calls cost a mean of 7.7 ms. Eighty-eight exports is
therefore under a second, so cost is no objection. Enumeration is the objection,
and it is a small one.

A second obstacle is mechanical. `import { generateDefinition } from 'nextra/tsdoc'`
fails under plain Node: the entry point pulls in the `TSDoc` component, which
imports `nextra/dist/client/icons/arrow-right` with no extension, and Node
refuses it. Every measurement in this document imports
`nextra/dist/server/tsdoc/base.js` by relative path instead. Inside a Turbopack
build the extensionless specifier resolves, so this bears on a standalone
generator script and not on a component in a page.

### 1.2 What it renders for the 88 exports of `@evanion/acl`

Every export was passed through `generateDefinition` from `apps/docs` against
the built declarations. The tally:

| Outcome                                   | Count |
| ----------------------------------------- | ----- |
| A function, rendered as a signature       | 10    |
| An object type, rendered as a table       | 53    |
| A built-in prototype, rendered as a table | 20    |
| Threw                                     | 5     |

The 20 are the damaging class, because the output looks like every other table
and is wrong. A type alias whose declared type is a string-literal union
resolves to `String`, and `getProperties()` on `String` returns its 52 members.
`FieldReason`, `Reason`, `Action`, `Visibility`, `FieldState`, `FieldType`,
`BaseFieldType`, `SerializeMode`, `GrantedCause`, `WithdrawnCause`,
`UndeterminedCause`, `ActionOf`, `KeysOf`, `Paths`, `PermissionKeys`,
`VocabularyOf`, `Valid` and `ObjectKey` each produce a 52-row table beginning
`toString`, `charAt`, `charCodeAt`, `concat`. `CRUD_ACTIONS`, a readonly tuple
of four strings, produces the 36 members of `Array`. `Instant` produces three
members of `Date`.

The five that threw all carry `No properties found, check if your type "…"
exist.`: `AnyObjects`, `Subject`, `DenyOverlay`, `Operand` and `FieldConfig`.
Four of them are index-signature types with no named property, and `Operand` is
generic in three parameters. The check that raises it is `base.js:58-67`, which
treats an empty property list as a caller error.

One more result, quieter. `InvalidConditionError` renders seven rows: `key`,
`field` and `where`, which the class declares, then `name`, `message`, `stack`
and `cause`, which it inherits from `Error`. `generateDefinition` reads
`getCallSignatures()` and never `getConstructSignatures()`, so a class never
gets a constructor table. A reader looking for what to pass
`new InvalidConditionError(...)` gets the instance fields of `Error` instead.

### 1.3 Where Twoslash succeeds and `generateDefinition` fails

The same ten exports were put through `createTwoslasher` as
`import type { X } from '@evanion/acl'; type T = X;` with a `^?` query on the
alias. Nine returned the full type:

| Export         | `generateDefinition` | Twoslash `^?`                                                                                                           |
| -------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Reason`       | 52 rows of `String`  | `"allow" \| "no-rule-matched" \| "denied" \| "unknown-action" \| "unevaluable" \| "unusable-clock" \| "stale-contract"` |
| `Action`       | 52 rows of `String`  | `"create" \| "read" \| "update" \| "delete"`                                                                            |
| `Visibility`   | 52 rows of `String`  | `"public" \| "internal"`                                                                                                |
| `Instant`      | 3 rows of `Date`     | `string \| number \| Date`                                                                                              |
| `Subject`      | threw                | `{ [x: string]: unknown; }`                                                                                             |
| `AnyObjects`   | threw                | `{ [x: string]: Record<string, unknown>; }`                                                                             |
| `DenyOverlay`  | threw                | `{ readonly [x: string]: readonly Rule[]; }`                                                                            |
| `FieldConfig`  | threw                | `{ targets: readonly unknown[]; } \| { transitions: Record<string, readonly unknown[]>; }`                              |
| `CRUD_ACTIONS` | 36 rows of `Array`   | `readonly ["create", "read", "update", "delete"]`                                                                       |
| `Operand`      | threw                | threw; it is `Operand<B, Sub, Obj>` (`libs/acl/src/authoring.ts:36`) and a query has to supply arguments                |

The failure directions are opposite. `generateDefinition` reads properties, so
it is right about an interface and wrong about everything without properties.
Twoslash prints the resolved type, so it is right about a union and an index
signature, and says only `type D = Decision` for an interface alias, which tells
a reader nothing. Measured: the `^?` over `type D = Decision` returns exactly
`type D = Decision`.

That pairing is what § 9 builds on.

## 2. How Twoslash is wired, and what it can reach

### 2.1 The component path never produces a fence

`<TSDoc>` renders a `<table>` for `entries`, and for a function renders the
strings `Parameters:` and `Returns:` above one or two tables
(`tsdoc.js:56-176`). A type appears through `linkify`, which splits the type
string on word boundaries and wraps a chunk in a link when `typeLinkMap` has a
key for it (`tsdoc.js:250-270`), and otherwise puts it in an inline `<Code>`.
`typeLinkMap` is a plain `Record<string, string>` the caller supplies, so every
cross-link is a hand-maintained entry that drifts the way a hand-written
signature does.

There is no heading. A page using `<TSDoc>` still writes its own `##` above each
call, which is why decision 23 can keep G5's heading rule.

### 2.2 The fence path runs before React exists

Two pieces do the work. `nextra/dist/server/loader.js:2` imports
`transformerTwoslash` from `@shikijs/twoslash` and passes `twoslashRenderer()`
as its renderer, so Shiki attaches the compiler's hover data while highlighting.
`rehype-twoslash-popup.js:39-42` then walks the rehype AST for a `code` node
whose `data.meta` is the exact string `twoslash`, and on finding one unshifts an
import of `Popup` from `nextra/components` into the document.

The exact-string match is the constraint the region loader already works around.
`mdx-region-loader.mjs:24-31` records it: the loader strips `file=` and `region=`
before Nextra reads the info string, so the fence arrives as plain `twoslash`,
and any word the loader does not consume blocks the import and makes the page
throw on a `Popup` it never imported.

A generated signature therefore reaches a hover under one condition: it is
written into the MDX source as a fence whose final meta is exactly `twoslash`,
before Nextra's loader runs. The region loader is already in that position, and
`next.config.ts:38-46` orders it first of the three `*.mdx` loaders.

### 2.3 What the fence has to contain

Measured through `createTwoslasher` at the version `package.json:83` pins,
`twoslash@0.3.9`:

The body of `api.mdx:17-23`, which is what a reader sees on the site today,
throws. A `function` declaration with no implementation is a type error, and
Twoslash refuses errors the fence has not declared. So no existing `signature`
fence becomes a `twoslash` fence by editing its info string.

An import with a query works and produces the same information:

```
import { hydratePolicy } from '@evanion/acl';
//       ^?
```

returns
`(alias) function hydratePolicy<Sub = Subject, R = AnyObjects, Keys extends string = string>(matrix: Matrix, options?: AccessOptions): Access<Sub, R, Keys>`.
Compare `api.mdx:17-23`, which spells the same thing across seven lines. The
compiler already writes the page's block.

A `declare function` body also compiles with no error and carries hovers on
every identifier in it, with no `^?` needed. That form is the one a generator
would emit for a function whose full signature should be visible without the
reader hovering, and it costs the reader a `declare` keyword that the source
does not have.

`doc-twoslash.test.ts:26-31` states what these fences compile against:
Twoslash's own defaults, `strict`, ESNext module and target, resolving
`@evanion/*` through each package's published `exports` against the `dist/` its
build emits. `nx.json` orders the libraries' builds ahead of the docs app's for
that reason. A generated fence inherits all of it and needs no new
configuration.

## 3. What search does today

### 3.1 Measured, not assumed

`apps/docs/package.json:16` runs `pagefind --site out --output-path out/_pagefind`
as a `postbuild`. The theme sets `data-pagefind-body` on `<main>` when the
page's `searchable` metadata is not `false`
(`nextra-theme-docs/dist/mdx-components/index.js:69`).

Running Pagefind over the `out/` this session's build produced: 81 pages, 3,748
words, one language. The fragment for `/acl/api/` carries `word_count: 3463` and
107 anchors, the first of which are
`{"element":"h2","id":"hydratepolicy","text":"hydratePolicy"}`, `parseMatrix`,
`policy`, `Policy`, `PolicyOptions`, `AccessOptions`. Pagefind returns a
sub-result per anchor, so a reader searching `capabilities` already gets a link
to that export's heading rather than to the top of the page.

The indexed content string carries the headings, the prose and every table cell.
It carries no fence body. The built page has 106 `data-pagefind-ignore="all"`
attributes, one per fence, placed by `rehype.js:71` under
`search: { codeblocks: false }`.

To measure the size of the gap rather than assert it, every identifier inside a
fence on `acl/api.mdx` was compared with that fragment's content. 344
identifiers appear in a fence. 43 of them appear nowhere in the index, including
`denyRules`, `pinnedVersion`, `fetchedVersion`, `operand`, `granted`,
`withdrawn`, `undetermined`, `denies` and `mode`. The other 301 are reachable
because the prose or a heading names them too.

So the reference is searchable by export name today, and 43 names stated only in
a signature are the defect.

### 3.2 Why not flip the flag

`search: { codeblocks: true }` would index all of it in one line. It would also
index every other fence on the site. `doc-fence-allowance.json` records 242
unexplained fences across nine sections, 29 of them in `acl`, and § 5 of the
documentation standard reserves `anti-example` for a block that is deliberately
wrong and `fails-type-check` for one that compiles nowhere. Indexing those puts
a search result on the page's counter-example, and Pagefind's sub-result anchors
it to the heading above, which reads as the page endorsing it.

The narrower fix is per entry: put the names a reader searches for outside the
`<pre>`. The `token/api.mdx` page demonstrates it already: its option tables are
in the Pagefind fragment, `Option`, `Type`, `Default`, `Meaning` and every row
under them, at 487 indexed words with no fence indexed at all. § 9.1 applies the
same move to the generated JSDoc.

### 3.3 The static export constrains the renderer

`next.config.ts:63` sets `output: 'export'` and `:69`
`images: { unoptimized: true }`. Pagefind runs over the emitted HTML after the
build, so every word that reaches the index has to be in the prerendered markup.
`<TSDoc>` is a server component (its own docblock says so, `tsdoc.d.ts:71-75`),
and `generateDefinition` lives under `dist/server`, so both run at build time
and both land in the HTML.

### 3.4 A client component is indexed, and the rule that follows

Requirement 4 looked at first like a refusal of any component with its own
state. It is not, measured.

`apps/docs/components/probes/urn-probe.tsx:1` is `'use client'`. The page
`content/urn/components.mdx:26` mounts it as
`<Probe package="urn" probe="components" />`. The string
`WeatherURN.parse('urn:example:weather?=lat=39#today')` and the object it
returns come from `apps/docs/components/probes/urn.ts:28-29`, appear in
`apps/docs/out/urn/components/index.html`, and appear in that page's Pagefind
fragment, which carries 658 words.

A client component is rendered on the server during the static export, so its
initial markup is in the HTML and Pagefind reads it. What Pagefind never sees is
anything that appears only after hydration.

Visibility is a separate question from presence, and it is the one a filter
turns on. A fixture page carrying a `<div hidden>` and a
`<div style="display:none">` was built and indexed: Pagefind put both words in
the fragment, alongside the visible one, at a word count of 4.

So the rule decision 18 states is about the markup and not about what the reader
can see. Whatever the component renders with its **initial state** is indexed,
whether or not it is visible. A filter whose empty query renders every entry and
then hides the non-matching ones keeps all 107 in the index. A filter that
renders nothing until the reader types deletes 107 entries from the index, and
the page would still look correct in a browser.

## 4. The two halves of the brief pull against each other

A Twoslash hover exists on a token inside a `<pre>` that Shiki highlighted.
Pagefind excludes every `<pre>` on this site. So the same bytes cannot both
carry a hover and be searchable, under the current configuration, and § 3.2
declines to change the configuration.

Three ways out exist and the third is the one § 9 takes.

Index the fences. Refused in decision 20, for the reason § 3.2 gives.

Duplicate the content, once in a fence and once in prose. That is the second
copy the whole exercise exists to remove, and it drifts in the direction that
reads as authoritative.

Put different content on each side. The signature and the example go in fences,
where a hover lives. The JSDoc summary and the parameter names go in prose,
where the index lives. Requirement 1 and requirement 4 turn out to be the same
requirement, because the JSDoc is the indexable half, and § 9.1 measures how
much of § 3.1's 43-identifier gap it closes.

## 5. What to build

One loader, in `tools/doc-examples`, beside `mdx-region-loader.mjs` and
configured the same way in `next.config.ts` under `turbopack.rules`.

The page writes one directive per entry:

```md
## `hydratePolicy`

<!-- reference @evanion/acl#hydratePolicy example=quick-start -->

Prose the author writes, which the loader never touches.
```

The loader replaces the comment with four things: the docblock's first
paragraph as a summary, the rest of the docblock inside a collapsed
`<details>`, a `twoslash` signature fence, and a `twoslash` example fence
filled from the named README region. It
strips its own syntax before Nextra sees any info string, exactly as the region
loader strips `file=` and `region=` (`mdx-region-loader.mjs:105-110`), so each
fence arrives as plain `twoslash` and the `Popup` import lands.

Three reasons for the loader position rather than a component.

`mdx-region-loader.mjs:34-42` already argues it: Nextra hands
`mdxOptions.remarkPlugins` straight to unified, which requires plugin functions,
and Next 16 requires every loader option to be serializable. A loader satisfies
both, runs inside `next build`, and needs no npm lifecycle hook.

A loader emits a fence, and § 2.2 establishes that a fence is the only thing
that can carry a hover.

A missing export fails the build. The region loader already throws on a missing
file or region so that `next build` fails rather than deploying a page with an
empty code block, and the same rule applied to a symbol is what decision 23
turns into a structural guarantee.

### 5.1 The JSDoc, and how much of it

Requirement 1 asks for the JSDoc data. There is a lot of it.

Measured across five entry points by resolving each export's alias and calling
`getDocumentationComment(checker)`:

| Entry point            | Exports | With a docblock | Mean words | Total words | With `@example` |
| ---------------------- | ------- | --------------- | ---------- | ----------- | --------------- |
| `@evanion/acl`         | 88      | 86              | 69         | 5,939       | 1               |
| `@evanion/acl/testing` | 18      | 16              | 55         | 885         | 0               |
| `@evanion/react-acl`   | 26      | 25              | 58         | 1,452       | 1               |
| `@evanion/token`       | 20      | 18              | 32         | 578         | 1               |
| `@evanion/urn`         | 9       | 9               | 55         | 493         | 5               |

Coverage is excellent and volume is the thing to place. `@evanion/acl`'s
docblocks come to 5,939 words against a page whose entire prose is 1,637 (§ 0).

The documentation standard measured the same volume from the other end at
`:1054-1060`: `libs/acl/dist/hydrate-policy.d.ts` spells `Access` in 47 lines, 22
of which are `readsObject`'s TSDoc comment restating what `acl/decisions`
already teaches. `applyDenyOverlay`'s docblock is 301 words. A reader scanning
107 entries for the one they need does not want 301 words of reasoning at the
third of them.

That is an objection about what a reader scrolls past, and § 3.4 answers it
without deleting anything. Pagefind indexes an element carrying `hidden`, one
carrying `display: none`, and a closed `<details>`, each measured on a fixture.
So the full docblock can be in the markup, collapsed, and in the search index at
the same time. Truncating it would lose text and buy nothing that collapsing
does not buy.

So the loader emits the whole docblock, in two parts.

**The first paragraph**, as the entry's summary, rendered as prose under the
heading and always visible. That is what the author wrote as the one-sentence
answer, and it is the unit `pkg.go.dev` indexes as a package synopsis (§ 12).
Measured on the sample in § "Measured", the first paragraph of `hydratePolicy`
is "The evaluator over a matrix document." and of `contractDrift` is "What
changed between the contract a consumer pinned and the one its producer
publishes now." Both are usable as written.

**Everything after it**, inside a collapsed disclosure, rendered as markdown.
The block tags come with it: `@param`, `@returns`, `@default`, `@deprecated`,
`@see`. Each names an identifier in prose, which is what § 9.1 needs, and the
naming tags should render above the collapsed prose rather than inside it, since
a parameter list is what a reader checks quickly.

An export whose docblock is one paragraph renders no disclosure at all. Measured
across `@evanion/acl`, the mean docblock is 69 words, so a substantial share of
the 86 will be in that position, and the count was not taken.

#### 5.1.1 Which hover gives what

Requirement 1 asks for the JSDoc and the brief asks for hover information, and
those are two different hovers. Measured, one of them already does more than
expected.

`createTwoslasher` attaches a `docs` field to a hover node, carrying the
symbol's full docblock. `applyDenyOverlay` returns all 301 words; `hydratePolicy`
returns 107; `Decision` returns "One action-level decision.". The text arrives
whether or not the fence carries a `^?`.

Nextra renders it. `/acl/api/` has one `twoslash` fence today
(`api.mdx:921-927`) and the built page carries nine `twoslash-popup`
occurrences, three of them `twoslash-popup-docs` elements holding
`assertAllowed`'s, `assertNoContractDrift`'s and `fixtureClock`'s docblocks as
markdown paragraphs. None of that text is in `api.mdx`, so the build produced
it.

And none of it is searchable. Two of three probe sentences were found in
`apps/docs/out/acl/api/index.html` and none of the three in that page's Pagefind
fragment, because the popup sits inside the `<pre>` that carries
`data-pagefind-ignore="all"` (§ 3.1).

Three consequences.

A reader with a pointer, on a `twoslash` fence, can already hover a symbol and
get its full docblock. That is not nothing and the page never advertises it.

The hover the brief asked for gives the **resolved type** and, on a symbol with
a docblock, the docblock as well. So a page should not promise the docblock via
a hover on a type alias: `type D = Decision` carries a three-word docblock and
nothing else (§ 1.3).

The disclosure earns its place on two grounds that the hover cannot cover.
Reachability, because a hover needs a pointer (§ 5.1.2). And search, because a
popup inside a `<pre>` is excluded and a `<details>` in the prose is not. The
second is the stronger one and it is the reason this does not collapse into
"twoslash already does it".

#### 5.1.2 A disclosure, and which one

Use a native `<details>` with a `<summary>`.

It is keyboard reachable with no code, it stays open until the reader closes it,
it needs no JavaScript, and it survives a static export with no hydration. § 3.4
measured its closed content fully indexed by Pagefind, so the choice between
`<details>`, `[hidden]` and `display: none` is about interaction and not about
search.

A button-toggled region is the alternative and it buys nothing here. Nothing in
`internal/baize-ui/src/index.ts` or `apps/docs/components` is a disclosure
today, so it would be a new client component, and § 9.2 already introduces one
client component to the page. Two is worse than one for the same reason the
filter is deferred to fifth in § 11.

The one thing `<details>` costs is styling: it comes with the browser's marker
and needs the site's own type scale applied. That is CSS in the docs app and it
is the whole of the implementation.

**How to read the docblock.** `doc-export-coverage.test.ts:176-196` already does the hard
part: it resolves `ts.SymbolFlags.Alias` through `checker.getAliasedSymbol`
before asking anything, which is what makes a re-export answer for its target.
`:208-218` is `commentText`, which handles a comment arriving as a
`ts.NodeArray<ts.JSDocComment>` rather than a string, which happens as soon as
the block contains a `{@link}`. `:220-260` is `internalMark`, which walks a
declaration and its two enclosing nodes because `export const x` and
`export { x } from './x.js'` put a tag in different places. All three are needed
here and all three exist. Lift them into `tools/doc-examples` and have the test
import them, rather than writing a second copy.

Two exports on `@evanion/acl` carry no docblock at all, `AccessOptions` and
`DiffFinding`, and both are types with a heading on the page today. The loader
emits no summary for them and the authored prose carries the entry, which is
exactly what happens now.

### 5.2 The usage example

Requirement 2 asks for a Twoslash example per export. Three sources were
considered and two are refused.

**Inventing one per export is refused.** The repository's convention is that
every example comes from a run: `doc-regions.test.ts`, the region loader, and
G10's definition of an executable fence all rest on it. Eighty-eight invented
snippets are 88 claims nothing checks.

**`@example` is refused, measured.** One of `@evanion/acl`'s 88 exports carries
an `@example` tag (`libs/acl/src/authoring.ts:545`). Across every `libs/`
package there are 8, in `compose`, `nestjs-correlation-id`, `widget`, `feature`,
`luhn`, `token` and `urn`. Adopting `@example` means writing 87 new examples
into library source, where no test runs them, which is the failure
`doc-twoslash.test.ts:32-36` was written to close for READMEs.

**A README region is the source.** `libs/acl/README.md` carries 36 regions and
the package's own tests run them. `apps/docs/content/acl/` already references
them 57 times through `file=`. The reference entry names one:
`example=quick-start`. The loader resolves it through `readRegion` the way
`expandRegions` does (`mdx-region-loader.mjs:96-104`), throwing when the region
does not exist, and emits it as a `twoslash` fence with the README's preamble in
front of it behind a `// ---cut---`, which is what `withPreamble` already does
at `:106-108`.

**What happens for an export with no example.** Measured under
`content/acl/`: 95 executable fences, and 43 of the 88 exports are named in at
least one. Of the 34 callables, 33 are covered; the one my scan did not find is
`ruleId`, which `libs/acl/src/index.ts:16-19` exports as an aid to writing a test
assertion. The 45 with no fence are almost all types.

That is the right shape, and the entry simply carries no example block. G10
already reasons this way for its exercised rule: a type is exempt, because a
fence naming `FieldReason` would be naming it to satisfy the guard
(`doc-export-coverage.test.ts:33-36`). A reference entry for `Reason` shows its
seven members through the `^?` of § 1.3, and there is nothing to call.

The one thing the page owes a reader is to not look unfinished. An entry with no
example renders the summary and the signature and stops. It does not render an
empty block or a "no example" notice, on the same reasoning `doc-fence-allowance`
uses: an absence somebody chose reads better than a placeholder nobody filled.

A second consequence, and it is a gain. A region named by a reference entry is a
region under `doc-regions.test.ts`, so renaming it fails a test rather than the
build only. The example cannot rot in either direction.

### 5.3 Where the declaration comes from

`ts-morph` or the TypeScript compiler API over the entry point the package's
`exports` map names. Two conditions are available and they answer different
questions. `@evanion/source` resolves to the package's own `src/`, which is what
`tsconfig.base.json:43` sets workspace wide and what
`doc-export-coverage.test.ts:152` uses. The default conditions resolve to
`dist/`, which is what `apps/docs/tsconfig.json:29` deliberately chooses and
what a reader installing the package gets.

The loader should take `dist/`, for the reason the docs app already gives: the
site documents the published surface. `nx.json` already orders the libraries'
builds ahead of the docs app's, so nothing new is needed.

One cost, stated because it is permanent. A declaration read from `dist/` cannot
link a reader to a line of `src/`, and TypeDoc and `pkg.go.dev` both offer that
link (§ 12). Resolving twice would buy it and this document did not cost that.

## 6. What stays hand-written

The heading, the editorial prose, and every table that explains a type
parameter.

`api.mdx:59-65` is the example that settles this. Under `## \`policy\``sits a
five-row table saying what`Sub`, `Objects`, `Vocabs`, `Action`and`VocabularyOf`are, and the`Action`row says "the vocabulary a kind`Vocabs`
omits gets, carrying no wildcard member" and cites the spec that records why. No
declaration carries that sentence. A TSDoc comment that carried it would put it
in the library's source, where § 5.1 measured that it joins 5,939 words nobody
scans.

So an entry has three parts and two sources:

| Part            | Source                         | Can it drift       |
| --------------- | ------------------------------ | ------------------ |
| `##` heading    | authored                       | G5 and G10 hold it |
| Summary         | the docblock's first paragraph | no                 |
| Collapsed rest  | the rest of the docblock       | no                 |
| Signature fence | the declaration                | no                 |
| Example fence   | a README region a test runs    | no                 |
| Editorial prose | authored                       | yes, uncaught      |

The last row is the only one that can drift, and it is the trade decision 19
states. § 13 is how the five parts are set on the page. `pkg.go.dev` has run the same
arrangement across a large corpus for a decade (§ 12), which is evidence it is
workable and no evidence the prose stays right.

## 7. G5 and G10

**G5 gets stronger and keeps its job.** `doc-exports.test.ts:29-35` states its
own gap: what a `signature` fence says inside the block is not read, because
separating a package type from a TypeScript built-in needs a list of every
built-in, which goes stale toward false failures. Under the loader that gap
closes from the other side. The fence has no body in the source, so there is
nothing to read; the body arrives from the compiler, so it cannot name a type
the compiler does not have.

G5 does not become redundant. It checks three things
(`doc-exports.test.ts:22-27`) and the signature heading is one. The named
bindings of every `@evanion/…` import in every other fence on the site, and the
package references in a `mermaid` fence, are untouched by this document.

**The heading rule becomes structural for a page on the loader.** The loader
resolves `@evanion/acl#hydratePolicy` or throws. A heading naming no export
fails `next build`, which is earlier and louder than a test. G5 keeps checking
the same heading and on a loader-backed page will never be the thing that fails
first. That is a guard becoming a second opinion rather than a guard being
deleted, and deleting it would leave the ten pages not on the loader unguarded.

**G10's first rule is the one to watch.** "Every export has a `##` heading"
(`doc-export-coverage.test.ts:25-28`) points the other way from G5: it catches
an export with no entry, which is how `diffMatrix` shipped undocumented. The
loader does not answer it, because a page that omits a heading omits the
directive with it. G10 survives unchanged and stays the guard that matters.

**G10's second rule gains a partial answer.** Exercised is every callable export
reached by an executable fence (`:30-42`, `:270`). An example fence emitted by
the loader is a `twoslash` fence in the page after expansion, so an entry naming
a region satisfies the exercised rule for that export on the reference page
itself, rather than relying on a fence somewhere else in the section. That
changes where the coverage comes from and not whether it exists, and the type
exemption should stay for the reason § 5.2 gives.

**One trap, and it is the one this document fell into.**
`doc-export-coverage.test.ts:300-338` reads executability off the page as
written and the body off the page as expanded, because `expandRegions` strips
`file=` from the info string and an expanded fence no longer looks executable. A
first attempt to measure § 5.2's coverage here read both off the expanded page
and reported 22 of 88 instead of 43 of 88. Any test written against the new
loader has the same trap waiting, and `:302-311` is the comment that explains
it.

## 8. One reference per package, and which one goes first

The loader is package-neutral. `reference @evanion/urn#parse` works the same way
as `reference @evanion/acl#hydratePolicy`, so nothing about it is `acl`-specific
and nothing should be made so.

Adoption order is decided by a number already in the tree.
`doc-export-coverage-allowance.json` records undocumented names per package:
`@evanion/feature` 32, `@evanion/token` 19, `@evanion/react-widget` 18,
`@evanion/react-acl` 17, `@evanion/luhn` 10, `@evanion/urn` 8,
`@evanion/astro-widget` 7, `@evanion/nestjs-correlation-id` 4, and
`@evanion/widget` 0 undocumented with 2 unexercised. 115 names in total have no
heading. `@evanion/acl` has no entry at all, which means every one of its 88
exports plus the 18 on `@evanion/acl/testing` already has one.

A generator that fills in a signature, a summary and an example is worth having
on a page where every entry exists and is worth nothing on a page missing 32 of
them. So `acl` goes first because it is finished.

`react-acl` is the interesting second, and not for its size. Its 26 exports
carry 1,452 words of docblock across 25 of them, and its hooks are generic over
the consumer's subject and object map, which is the case where a hover tells a
reader more than a rendered string does.

## 9. Two search surfaces

Requirement 3 and requirement 4 name different things and both ship.

### 9.1 Nextra's search, and what the JSDoc adds to it

Pagefind already answers the reader arriving from outside who knows a name: 107
anchors on `/acl/api/`, one per heading, returned as sub-results (§ 3.1).
Nothing needs building for that.

The measured defect is the 43 identifiers that appear only inside a fence. The
summary, the collapsed docblock and the naming tags of § 5.1 are all prose, so
they land outside the `<pre>` and Pagefind indexes them, on the same mechanism
that puts `token/api.mdx`'s option tables in its fragment (§ 3.2) and on the
`<details>` measurement in § 3.4.

The collapsed half is what does most of this work, and § 5.1.1 is why. Twoslash
already renders the full docblock into the page, inside the popup, where the
index cannot see it. Moving the same text into a `<details>` in the prose adds
roughly 4,300 words of `@evanion/acl` documentation to the search index that are
in the markup today and unfindable. That is the largest single gain in this
document and it was not the reason the disclosure was proposed.

How much of the 43 that recovers is not measured and this document does not
claim all of them. `denyRules` and `operand` are parameter names, so a `@param`
naming them would close those. `pinnedVersion` and `fetchedVersion` are fields
of an options type, so they close only if a docblock happens to name them or the
type's own entry renders its members in prose, which § 4's split does not do.
That residue is real and § 10 declines to chase it.

### 9.2 The component's own search

A text input above the entries, narrowing 107 of them as the reader types. It
answers the reader already on the page who does not know the name, which
Pagefind does not serve, because Pagefind's input is the site's and its results
navigate away.

Decision 18 is the whole of its design constraint, and § 3.4 is the evidence
for it. The filter is a client component that **wraps server-rendered children**
and hides them on input. It does not hold the entry list as data, does not
fetch, and does not render a different tree after hydration. Every entry is in
the prerendered HTML, so Pagefind indexes all 107 and a reader with no
JavaScript sees the full page, which is the rule `apps/docs/AGENTS.md` already
states for diagrams.

Hiding is `el.hidden` or a class, over the children the loader emitted, and
§ 3.4 measured that neither removes the text from the index. What the filter
matches on is the heading text, which is in the DOM.

It ships second (§ 11). There is nothing to filter until the generated page
exists, and how a page of 107 generated entries reads is the question § 11 stops
to answer.

## 10. What not to build

**An abridging rule for the signature.** § 5.3 declines it and the documentation
standard's evaluation at `:1054-1060` is why: a generator that abridges is
making the editorial decision the hand-written block already makes, and it will
make it worse. A page wanting an abridged interface keeps a hand-written block.

**A button-toggled disclosure.** § 5.1.2. A native `<details>` is keyboard
reachable, stays open, needs no JavaScript, and § 3.4 measured it indexed while
closed. A custom one would be a second client component on a page that already
gains one for the filter.

**Truncating the docblock.** An earlier draft of this document proposed emitting
the first paragraph and dropping the rest. § 3.4's measurement removes the
reason: collapsed text is indexed, so nothing is bought by deleting it.

**A `typeLinkMap`.** `<TSDoc>`'s cross-linking needs a hand-maintained map from
type name to href (`tsdoc.js:250-270`), which drifts the way a hand-written
signature does. TypeDoc and Rustdoc both cross-link and both compute the map
from the same compiler pass that produced the signature (§ 12). Build the whole
thing or none of it.

**Changing `search.codeblocks`.** Decision 20.

**Chasing the residue of § 9.1's 43 identifiers.** An options type whose members
are searchable needs its members in prose, which is a `<TSDoc>` table beside the
fence, which is a second renderer on the page. Worth doing if somebody reports
failing to find one; not worth doing first.

**Replacing `api.mdx`.** The documentation standard evaluated TypeDoc's markdown
plugin and api-documenter at `:1047-1053` and found that both own the page:
their unit of output is a file per module or per API item, and neither has a
mode that emits one symbol's block into a position an author chose. § 12
confirms that reading against their current documentation.

**A second entry point for the other ten packages.** § 8.

## 11. Sequencing

1. **Lift `commentText`, `internalMark` and the alias resolution out of
   `doc-export-coverage.test.ts` into `tools/doc-examples`**, and have the test
   import them. No behaviour change, and it is the precondition for § 5.1.
2. **The loader**, with the four emissions of § 5 and the `dist/` resolution of
   § 5.3, and a test compiling every fence it emits.
3. **`acl/api.mdx` onto it.** 105 `signature` fences become 105 directives.
   Expect the `doc-fence-allowance.json` entry for `acl` to move, because a
   `twoslash` fence is not an unexplained fence. Expect the page's prose count
   to rise by roughly 5,939 words, and expect the budget exemption from PR #256
   to be what absorbs it.
4. **The export-kind token family**, in `internal/baize-ui`: both halves, the
   `--baize-kind` classes, the generated custom properties, and the token test
   measuring both grounds and asserting matching keys. It lands before the page
   needs it and it is the only change outside `apps/docs` and
   `tools/doc-examples`. § 13.4.
5. **The `<details>` styling and the kind binding**, in the docs app's CSS.
   § 5.1.2, § 13.4.
6. **Stop and read the page**, against the four entries § 13.8 names. Whether an
   emitted `declare` signature plus a one-paragraph summary over a collapsed
   docblock reads as well as the hand-written entry, and whether six coloured
   names read as information, are the two questions this document cannot answer
   from the tree.
7. **The filter**, under decision 18.
8. Everything else waits: the other ten pages, the cross-links, the residue of
   § 9.1.

Steps 1 through 6 are the proposal.

The full docblock costs almost nothing over the truncated one, which is the
coordinator's expectation and it holds. The loader already resolves the symbol,
already holds the whole comment string from `getDocumentationComment`, and
already renders markdown; emitting a second block instead of discarding the tail
is a split on the first blank line and one more template. The disclosure is
markup, not a data source, so it adds no resolution, no compile and no new
failure mode. Step 4 is new and it is CSS.

One thing does grow. The page's indexed word count rises by roughly 4,300 beyond
what truncation would have produced, which is § 9.1's gain and also more text for
Pagefind to hold. The whole site indexes 3,748 words today, so `acl/api.mdx`
alone would roughly double the index. Nothing measured says that is a problem
and nothing measured says it is not.

## 12. The landscape, read for this document

Fetched from each tool's own documentation on 2026-09-21, with the page named
beside each claim. The question asked of each was where the reference content
comes from, what stops a documented signature disagreeing with the real one, and
how a reader searches it.

**TypeDoc.** Runs the TypeScript compiler, finds `tsconfig.json`, and emits HTML
or a serialized project model (`typedoc.org/documents/Overview.html`).
Signatures are compiler output, so a signature cannot disagree with its
declaration. Prose can: a `@param` naming a parameter that no longer exists is a
warning. Search is a build-time Lunr index written as `window.searchData` and
loaded by the client (`src/lib/output/plugins/JavascriptIndexPlugin.ts` and
`src/frontend/typedoc/components/Search.ts` on GitHub). `searchInComments` and
`searchInDocuments` both warn that enabling them can grow the index by up to an
order of magnitude (`typedoc.org/documents/Options.Output.html`). Type names in
signatures are click-through links, computed from the same pass. No hover.
`typedoc-plugin-markdown` swaps the HTML output for CommonMark, GFM or MDX
(`typedoc-plugin-markdown.org/docs`) and says nothing about search, because the
index plugin belongs to the HTML theme.

The part relevant here: the search index is built from the same model that
produced the signature, so the index knows a parameter name. Pagefind reads
rendered HTML and knows only what the markup says, which is why § 3's 43
identifiers are missing and TypeDoc's would not be. § 9.1's fix is to put the
parameter name in the markup, which is the same answer reached from the other
side.

**api-extractor with api-documenter.** Traces every export from the package
entry point and emits three artifacts: an `.api.md` report, a `.d.ts` rollup and
a `.api.json` doc model holding extracted type signatures and doc comments
(`api-extractor.com/pages/overview/intro/`). This is the one that attacks drift
head on, and its answer sits at the review layer. The `.api.md` report is a
block of pseudocode summarizing the API signatures with release tags and
`(undocumented)` markers, committed to git. A local build rewrites it; a
production build does not and fails with an error telling the developer to
update it, which enables a branch policy requiring a stakeholder's approval on
any changeset touching a `.api.md` file
(`api-extractor.com/pages/overview/demo_api_report/`). api-documenter then emits
either basic markdown or DocFX YAML
(`api-extractor.com/pages/setup/generating_docs/`). Neither emitter ships a
search index.

The part relevant here: the committed report is the closest prior art to what
this repository already does with allowances, and it is a different answer to
drift than generation. It makes a signature change visible in a diff instead of
making the page follow the code. § 5 chooses generation because the page is the
thing being read, and `doc-export-coverage-allowance.json` already provides the
review-layer half.

**Rustdoc.** Calls `rustc`, takes over at HIR, and cleans it into a tree of items
(`rustc-dev-guide.rust-lang.org/rustdoc-internals.html`). Signatures are compiler
output. The search index is generated by `search_index.rs` and decoded by
`search.js`, stored as column-major parallel arrays with a custom VLQ hex
encoding that stays compressed in memory and Roaring Bitmaps for flag columns
(`rustc-dev-guide.rust-lang.org/rustdoc-internals/search.html`). Its query
surface is the richest of the four: fuzzy name matching scaled to name length,
tabs for names, parameters and return types, and type-signature search where
`usize -> vec` finds `Vec::with_capacity` and
`option<T>, (T -> bool) -> option<T>` finds `Option::filter`
(`doc.rust-lang.org/rustdoc/read-documentation/search.html`). No hover.

The part relevant here: rustdoc's in-page search is requirement 3's ambitious
form, and it is built from the model rather than from the DOM. § 9.2's filter is
the cheap version, and the gap between them is the honest cost of decision 18.
The documentation standard already borrowed rustdoc's exemption vocabulary for
the `signature` tag (`:1030`) and did not borrow the index.

**pkg.go.dev.** The weakest of the four on drift, and the closest to what § 6
proposes. `go/doc` extracts documentation from the AST, so a signature comes
from the declaration and the prose comes from free text the author wrote above
it (`pkg.go.dev/go/doc`). Nothing validates that a doc comment describes the
current signature (`go.dev/doc/comment`). Go 1.19 gave gofmt authority to
reformat doc comments and added doc links like `[io.EOF]`, which gofmt and
pkg.go.dev resolve, so a broken doc link is the one stale reference that
surfaces; a renamed parameter with a stale comment goes uncaught. Search is
server-side over a database, indexing the package name, path, synopsis and
README, with symbol search across all packages (`pkg.go.dev/search-help`). The
first sentence of the package comment is the indexed synopsis shown in results
(`pkg.go.dev/about`). Identifiers in signatures link to declarations and to the
repository source. No hover.

The part relevant here: the synopsis is decision 11. Go indexes and displays the
first sentence of a doc comment and holds the rest for the reader who opens the
symbol, which is the same judgement § 5.1 makes about 5,939 words, reached by
somebody with a much larger corpus.

**Twoslash.** A Shiki transformer providing inline type hover inside code
blocks, running on Node and relying on the local system to resolve TypeScript
and the types for the imports (`shiki.style/packages/twoslash`). It builds a
TypeScript language service over a virtual file system, and `createTwoslasher`
caches language servers keyed by a hash of the compiler options
(`twoslash.netlify.app/refs/api`). It needs the code to type-check, and that is
its enforcement: by default it throws on any error the fence did not declare.
`errors`, `noErrors`, `noErrorsCutted` and `noErrorValidation` are the escapes
(`twoslash.netlify.app/refs/options`). Notations include `^?` for the type of
the identifier above, `^|` for completions, `// ---cut---` for trimming the
displayed code while keeping the compilation context, and `@filename:` for
multi-file samples (`twoslash.netlify.app/refs/notations`).

None of the four reference tools renders a Twoslash-style hover. Twoslash is a
separate mechanism over source, which is why § 4's tension exists at all: the
four tools render a reference as structured data and Twoslash renders one as
compiled source, and Pagefind reads the first and ignores the second.

### Not reached

- `twoslash.netlify.app/refs/results` and `/refs/nodes` both returned 404, so
  the `TwoslashReturn` node shape is asserted nowhere above from first-party
  documentation. Every claim about node types in this document comes from
  running `createTwoslasher` in this tree and reading what it returned.
- `api-extractor.com/pages/setup/configure_api_report/` and
  `/pages/setup/invoking/` both loaded and neither documents the `--local`
  semantics or the CI failure text. That detail comes from the demo page named
  above.
- TypeDoc's `Search.ts` at the path the docs link has moved; the file was read
  from `raw.githubusercontent.com` at `src/frontend/typedoc/components/Search.ts`.
- Nextra's own documentation for `generateDefinition` and `<TSDoc>` was not
  fetched. Every claim about them above comes from reading the installed 4.6.1
  source and running it.

## 13. The design

`internal/baize-ui` is a board-game shop's kit, and the documentation site
already runs on it. `ground` is six chromatic values named for the table
(`ink`, `felt`, `rule`, `chalk`, `lichen`, `moss`), the families are Bricolage
Grotesque over Public Sans, and `ground.ts:8-10` says why the page is not tinted
black: the subject is baize.

So this section introduces no typeface, no radius and no spacing value, and one
new token family: six hues for what an export is, derived the way the kit's
other scales were and held to the same floor on both grounds (§ 13.4).
Everything else below is layout, interaction, and which existing vocabulary each
part of an entry takes. A new palette would make the reference the one page on
the site that came from somewhere else; a new scale inside the existing system
is what the kit already does four times.

### 13.1 What the page is

A component list. The sheet in a game box that tells a reader what is inside,
scanned by name, ordered by role.

That is what `acl/api.mdx` already is and the design should stop fighting it.
107 entries, one heading each, read by somebody who arrived knowing a name or is
looking for one.

### 13.2 Why not `CardGrid`

`CardGrid` is the obvious reach and it is wrong here, for three measured
reasons.

Its track is `minmax(17rem, 1fr)` (`layout.tsx:13-14`). The signature the page
renders for `hydratePolicy` is 154 characters on one line. At 17rem it wraps
about six times or scrolls inside a column narrower than the fence.

A card carries `radius.card` at 12px and `elevation.card`, which is a black
elevation plus a tinted glow (`geometry.ts:35-39`). 107 of those is 107 raised
surfaces on one page, and a raised surface means "this is a thing you pick",
which an entry in a list is not.

Grid rows align their cells' feet (`layout.tsx:56-59`). The entries have no
comparable height: measured, a docblock runs from 3 words (`Decision`) to 301
(`applyDenyOverlay`), and 45 of 88 exports carry no example. A row of three
would be one tall cell and two mostly empty ones.

So an entry is a list item. No card radius, no card elevation. What separates
two entries is one `rule` hairline and `space.6`, which is the same pair the
kit uses between sections.

### 13.3 The entry

Single column, left aligned, in this order:

```
┌─────────────────────────────────────────────────────────┐
│  hydratePolicy    ⟨function⟩                            │
│  The evaluator over a matrix document.                  │
│                                                         │
│  ▸ Full documentation                                   │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ declare function hydratePolicy<Sub = Subject, …   │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ const access = hydratePolicy(matrix)              │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  parseMatrix      ⟨function⟩                            │
```

**The name** is `Title` with `as="h2"` and `size="sm"`, and no `complexity`.
Bricolage Grotesque, `tracking.snug`, `ground.chalk`.

`typography.tsx:47-49` is the precedent and it is explicit: `Title` takes no
mechanism prop, because "a game's title must not be coloured by its category".
An export's name must not be coloured by its kind, for the same reason and with
the same result. The name is the thing being identified, so it is the one
colour every entry shares.

Longest name measured across the two entry points:
`TargetsTransitionsConflictError`, 31 characters. It sits on one line at
`text.md`.

**The kind chip** sits on the name's line, after it. `Chip` with no props but
its children. § 13.4 argues the colour.

**The summary** is `Text` with `tone="lichen"`, `size="base"`, `measured`. The
kit's measure is `64ch` (`geometry.ts:32`), so that is the line length rather
than the 80 characters a general rule would give. Held to one paragraph by
construction (§ 5.1).

**The disclosure** follows the summary, because it continues the same sentence.
A reader who wants more of the prose finds it under the prose. § 13.6 covers
the interaction.

**The two fences** close the entry: signature, then example. They sit outside
the measure at the page's full column width, since neither is prose and
wrapping a signature to 64 characters would hide its shape. Each scrolls inside
its own container at narrow widths, which is what the site already does.

The fences come last together rather than being split by the disclosure,
because a reader who has stopped at an entry reads the two as a pair: what it
takes, then what a call looks like.

### 13.4 Colour: a scale for what an export is

The name carries the hue. A new token family supplies it, and the chip beside
the name keeps saying the kind in words.

An earlier draft of this section concluded that the chip should carry no colour
at all. Two of its three arguments survive and the third does not, so the
reasoning is worth keeping rather than replacing.

**The two that survive.** `categorical` is spent: nine hues, and
`apps/docs/app/navigation.ts:159-163` gives one to each package with
`docs-navigation.test.ts` failing on a repeat. And `mechanism` would be
`categorical.ts:33-35`'s own warning happening, since that comment says the
scales are kept apart so nothing "has to describe a URN library as engine
building". Neither scale can carry an export's kind.

**The one that does not.** `typography.tsx:47-49` refuses a `mechanism` prop on
`Title`, and the reason it gives is that "a game's title must not be coloured by
its category". A mechanism is a taxonomy laid over a game from outside: the same
game could be filed differently, and two shops would file it differently. An
export's kind is not laid over it. `hydratePolicy` is a function in the same
sense that it has a name, and no editorial judgement produces the answer. So the
precedent refuses a foreign taxonomy and this is not one, and a third scale is
the right answer rather than no colour.

#### The family, derived from the export lists

Every export of all 15 TypeScript entry points in `libs/` and `internal/` was
classified by the kind of its first declaration, with an alias resolved first.
376 exports:

| Kind        | Count | Where the extremes are                                     |
| ----------- | ----: | ---------------------------------------------------------- |
| `interface` |   103 | 26 on `@evanion/acl`, 18 on `@evanion/baize-ui`            |
| `typeAlias` |    99 | 27 on `@evanion/acl`, 17 on `@evanion/baize-ui/tokens`     |
| `function`  |    83 | 18 on `@evanion/baize-ui`, 10 on `@evanion/acl`            |
| `constant`  |    49 | 31 on `@evanion/baize-ui/tokens`, 5 on `@evanion/token`    |
| `error`     |    38 | 24 on `@evanion/acl`, 4 on `@evanion/feature`              |
| `class`     |     4 | 3 on `@evanion/nestjs-correlation-id`, 1 on `@evanion/urn` |

Six members, and the list decides three things the design was going to guess.

**An error is its own kind, not a class.** 38 against 4. Every package with more
than one class has them because it throws, `libs/acl` has 24 errors and no plain
class, and every documented package carries an `errors.mdx` page, so "what can
throw" is already a question the site answers separately. Folding errors into
classes would give the scale one member at 42 and one at nothing.

**A plain class stays, at four members.** `CorrelationIdMiddleware`,
`CorrelationService`, one more on `@evanion/nestjs-correlation-id`, and `URN`. A
kind with four members across the repository is still a kind, and a reader of
`/urn/api/` meets it on the page's most important entry.

**No enum and no namespace.** Neither appears in any export list, so neither
gets a token. `CRUD_ACTIONS`' own docblock says why for the first: an enum is
nominal and a runtime artifact, and the actions in a matrix are plain strings.

`interface` and `typeAlias` stay apart rather than collapsing to one `type`.
They are the same split § 1.2 and § 1.3 measured on the emission side: an
interface has properties and renders as a shape, an alias usually resolves to a
union and renders through `^?`. A reader who has learned that an alias entry
shows its members and an interface entry shows its fields is reading the colour
for something real.

#### The hues

Warm for what exists at runtime, cool for what the compiler erases. That is the
first thing a TypeScript reader wants from an export list, because it decides
whether the name can be imported without `import type`, and it falls out of the
six members without being imposed on them.

Derived the way `categoricalOnLight` and, since PR #260, `availabilityOnLight`
were: a hue angle and a chroma held, and lightness walked until the ratio clears
4.5:1 against the ground that half is laid on. Chroma is capped at 0.13, which
is the top of `categorical`'s own range (0.037 to 0.136), so the new family
reads as part of the kit rather than louder than it.

| Kind        | Angle | Dark      | On `felt` | Light     | On paper |
| ----------- | ----: | --------- | --------: | --------- | -------: |
| `error`     |   22° | `#FFA09C` |    8.17:1 | `#933235` |   5.90:1 |
| `class`     |   58° | `#FCA864` |    8.30:1 | `#9A5200` |   4.52:1 |
| `function`  |   92° | `#DCBB50` |    8.56:1 | `#7A6200` |   4.53:1 |
| `constant`  |  128° | `#A5CE6F` |    8.86:1 | `#4C6E00` |   4.58:1 |
| `interface` |  235° | `#68CAFF` |    8.72:1 | `#016A95` |   4.63:1 |
| `typeAlias` |  300° | `#C9ACFF` |    8.23:1 | `#644395` |   5.83:1 |

The dark half sits at `L = 0.80` in OKLCH, which is `categorical`'s own mean
(0.789 across its nine). The light half sits between 0.46 and 0.51, against
`categoricalOnLight`'s 0.50.

**Both halves ship in the first commit**, and the reason is PR #260. Measured,
these six dark values laid on paper reach 1.40:1 to 1.51:1, against a 4.5:1
floor. That is the same defect the availability scale shipped with, worse than
the 1.77:1 that PR found, and it would arrive the same way: a value that is
right on one ground and unreadable on the other, with nothing measuring the
second.

**The lightness was chosen against the entry, not in the abstract.** On `felt`,
`chalk` is 13.67:1, `lichen` is 6.17:1 and `moss` is 3.15:1. An earlier pass put
the scale at `L = 0.73`, which lands at 6.32:1 to 6.92:1. That is `lichen`'s
brightness, and `lichen` is the summary line under the name, so the name would
have read at the weight of its own subtitle. At `L = 0.80` the scale sits between `lichen`
and `chalk`, so an entry reads name, then summary, in that order.

#### It binds its own property, and this is not optional

`global.css:275-277` paints the package hue onto every `h2` and `h3` in an
identity subtree as a **border colour**:

```css
.docs-identity :where(h2, h3):not([class*='baize-']) {
  border-color: color-mix(in oklab, var(--baize-hue) 45%, transparent);
}
```

A kind class binding `--baize-hue` on the `h2` itself would win inside that
element and take the rule under the heading with it. Every entry's hairline
would become its kind's colour and the package would lose the channel.

So the family binds `--baize-kind`, with `baize-kind-*` classes and a
`--baize-kind-on-light` counterpart, and the light swap goes on the element that
carries the class, which is the shape `global.css:255-257` already uses for a
platform chip rather than the subtree shape at `:248-250`.

#### What a reader sees, and why the page is still one system

This is the question a second scale has to answer, and the stylesheet answers it
already.

The package hue reaches three places inside `.docs-identity`
(`global.css:266-290`): the `h1`'s colour, the `h2`/`h3` border, and a card's
top edge. Its own comment states the rule it follows: "on the type and the
hairlines, never as a background wash".

So on `/acl/api/` a reader sees one coral `h1` at the top of the page, then 107
headings, each with a muted coral hairline and a name coloured by what the
export is. The package hue is constant down the page and carries no per-entry
information, which is what makes it read as the page's own colour rather than as
a competing signal. The kind hue varies per entry and is the only thing on the
page that does.

Two channels, one per scale: the package owns the rules and the page title, the
kind owns the export names. Neither takes the other's.

**The one page to look at is `/feature/api/`.** `@evanion/feature` is `amber`,
whose angle is 80°, and `function` is at 92°: measured, 16 apart in sRGB. There
the `h1` and the function names are near neighbours, and both are type. Nothing
else in the two scales is closer than 24. If that page reads badly, the fix is
to move `function`'s angle. The warm band is crowded, with `amber` at 80°,
`stone` at 84° and `citron` at 106° already in it, so the honest options are a
shift into the gap near 55° with `class` moving down, or accepting it.
§ 13.8 says which I would look at first.

#### The chip stays, and it is what says the kind

Colour cannot carry meaning on its own, so something has to say `function` in
words. The chip is that something, and it needs no new rule, because
`global.css:300-302` already pins a non-platform chip inside an identity subtree
to `lichen`, with a comment giving exactly the reason this design needs: a card
that binds the package hue to its chip "says 'amber' twice meaning two different
things, the package and its release state".

So the entry reads: a name in the kind's colour, a grey chip saying the kind, a
summary. The colour is a second channel on a fact the text already carries,
which is where colour belongs. A reader who cannot see the hue loses nothing,
and the filter's toggles carry the same six words.

`AvailabilityPill` is still the right form for `@deprecated`, which is a state
and not a kind, and PR #260 has now given `availability` both grounds. The token
family is still the shop's stock vocabulary, so a docs-side state value is the
honest addition rather than calling a deprecated export out of print. Nothing in
`libs/acl` carries `@deprecated` today.

#### The token test

Copy what PR #260 landed. `tokens.test.ts` now measures availability against
both grounds and asserts the two halves carry the same keys, and that is the
pattern: one test per member per ground, and one test that the dark and light
records have identical keys, so a kind added to one and not the other fails
rather than shipping a name nothing checked.

The floor is 4.5:1 and not the 3:1 large-text allowance. An export name renders
at `text.md` (1.125rem, 18px) in a regular weight, which is under the 24px
threshold the allowance needs.

### 13.5 The filter

Sticky to the top of the list. A text input and four kind toggles on one row.

It is the only client component on the page, and decision 18 is its whole
constraint: it wraps the server-rendered entries, hides non-matching ones with
`hidden`, and never unmounts one. § 3.4 measured that a hidden element stays in
the Pagefind index, so hiding costs the page nothing.

The toggles are `<button aria-pressed>` on the chip's geometry rather than
checkboxes, because they carry the same four words the entries carry and a
reader should recognise the pair. Pressed is the chip's tint raised; unpressed
is the hairline alone.

**The count is the filter's feedback**, not a results header. `107 exports`
with an empty filter, `12 of 107` with one. It sits at the end of the filter
row and changes in place.

**When nothing matches**, the page says what to do rather than what failed:

> Nothing matches `fooba` in **function** or **type**.
> [Clear the filter]

The button is a button, it says what it does, and pressing it returns the count
to `107 exports`. The message names the query and the kinds that were on,
because those are the two things the reader can change, and it names no others.

**Without JavaScript** the filter is absent rather than inert. The wrapper
renders the row with `hidden` set and clears it on mount, so a reader with no
JavaScript gets all 107 entries and no control that does nothing. The cost is a
control that appears a frame late, which is the right trade for a page whose
main job is to be readable as text.

**Keyboard.** The input sits before the list in document order, so Tab reaches
it first. The toggles are buttons and answer Space and Enter. Escape in the
input clears the query, which is the one behaviour a reader expects from a
filter and does not get for free. The kit's global rule already draws focus:
`2px solid var(--baize-chalk)` at `2px` offset (`styles.css:34-37`), and
nothing here overrides it.

A sticky row covers whatever a reader tabs to underneath it, so every entry
heading takes `scroll-margin-top` equal to the row's height. That is also what
makes Pagefind's anchor links land correctly, since § 3.1 measured 107 of them.

### 13.6 Motion, in one place

The disclosure opening, and nowhere else. `motion.duration` is 120ms and
`motion.easing` is `cubic-bezier(0.2, 0.8, 0.3, 1)` (`geometry.ts:55-58`), and
`geometry.ts:52-54` already states the rule this follows: motion is
interaction-only, spent on hover and focus and on nothing that moves by itself.

An opening disclosure is the one thing on this page where something changed and
a reader needs to see what. Everything else is still.

`styles.css:897-903` is the reduced-motion block and the new rule joins it.

One implementation note, because it decides whether this is worth doing at all:
a `<details>` does not animate its own open. The height transition needs an
inner wrapper on `grid-template-rows: 0fr` to `1fr`, or `::details-content`
where it is supported. If neither is clean, the disclosure opens instantly and
the page loses nothing it had.

### 13.7 What this refuses

**No eyebrow above the name.** The chip is the label and it sits beside the
name, where it costs no line and no vertical rhythm.

**No `01 / 02 / 03`.** The page orders by role: the three constructors, then the
types each returns, then the remaining callables beside their option types
(`documentation-standard.md:1100-1103`). That is a grouping, and a reader
arrives at one entry from a search result rather than walking from the first.
Numbering would assert a sequence that is not there.

**No arrow after link text.** The entry's links go to other pages on the site
and read as prose.

**No per-entry hover transition.** 107 entries that lift or tint under the
pointer is motion carrying no information, and it would spend the budget
`geometry.ts:52-54` reserves.

**No monospace for the kind label.** The kit sets data in Public Sans, and the
two fences already carry the code face. A third face on the line would make the
chip compete with the signature underneath it.

**No second typeface, no new radius, no new spacing step.** The one new thing
is the kind scale, and § 13.4 derives it inside the kit's own constraints rather
than beside them.

### 13.8 Where the design is uncertain

**Whether six coloured names down a long page read as information or as a
fruit salad.** Every ratio in § 13.4 is computed and no page has been rendered.
The scale is capped at `categorical`'s own top chroma for this reason, and the
one that would push it over is `error` at 38 members on `acl`, where a quarter
of the page is one warm colour.

**Whether `function` at 92 degrees survives next to `amber` at 80.** Measured,
16 apart in sRGB, and `@evanion/feature` is the amber package. Nothing else
across the two scales is closer than 24. This is the first thing to look at, and
§ 13.4 names the two ways out.

**Whether `class` earns a token at four members.** It is a real kind and it is
1% of the repository's exports. Folding it into `error` would be wrong, and
folding both into one `class` token would bury the question every reader of an
`errors.mdx` page arrives with.

**Whether the disclosure is discoverable.** A `<summary>` reading "Full
documentation" sitting under a one-line summary may read as an entry footer
rather than as more of the same prose. The alternative is a label naming the
size of what is inside, and I do not know which reads better without seeing it.

**Whether entries need a hairline or only space.** `space.6` alone may be
enough separation given that each entry opens with a bright name in the title
face, and a hairline every 107 entries is a lot of hairline.

**Whether the sticky row earns its cost.** It occupies vertical space on every
screen of a long page, and a reader who has scrolled to an entry is reading
rather than filtering.

**What I would want rendered before committing.** One page carrying three
entries at their extremes, plus the filter in its empty state:

- `hydratePolicy`, a 107-word docblock, a 154-character signature and an
  example. The longest normal entry.
- `Reason`, a union with a 7-word docblock, no example, and its members shown
  through `^?`. The shortest entry, and the one that tests whether an entry with
  no example looks finished.
- `TargetsTransitionsConflictError`, the longest name at 31 characters, in the
  `error` kind. Tests the name and chip on one line.
- The filter with a query matching nothing, at a narrow width.

Those four settle § 13.3's order, § 13.4's chip, § 13.8's first three
questions and the mobile case, and they are one page of markup against
already-generated content.

## Testing

**The loader's own test**, in `tools/doc-examples`, over a fixture package: an
export that resolves, one that does not, a specifier the `exports` map does not
carry, a named region that is missing, and an entry with no example at all.

**The JSDoc readers get the test that already covers them.** Step 1 of § 11
moves `commentText` and `internalMark` and has `doc-export-coverage.test.ts`
import them, so their existing coverage follows them.

**`doc-twoslash.test.ts` covers the emitted fences, or nearly.** It reads pages
through `expandRegions` (`:100-107`) and compiles every fence whose info matches
`/\btwoslash\b/`. A fence the new loader fills is not filled by `expandRegions`,
so `twoslashFences()` would see an empty body and compile nothing. Composing the
two expansions is the fix and it is the first thing to check when step 2 lands.

**`doc-twoslash.test.ts:205-215` is the trap.** It already refuses a fence whose
meta after the language is anything but `twoslash`, because
`rehype-twoslash-popup.js` matches the exact string. The loader has to strip its
own syntax before the test reads the page, which is the same ordering problem
the region loader solved and the same place to solve it.

**The written-versus-expanded trap of § 7.** Any test counting the loader's
output has to read executability off the page as written. This document produced
a wrong number once by not doing so.

**One assertion for the filter, and it is about markup.** Render the page's HTML
with an empty query and assert every entry heading is present. That is decision
17 as a test, and it is what keeps a future refactor from deleting 107 entries
from the search index invisibly.

**One assertion for the disclosure.** Assert that an export whose docblock runs
past one paragraph renders a `<details>` holding the rest, and that an export
whose docblock is one paragraph renders none. That is decision 10 as a test.

**No new test for drift.** The build is the test: an export or a region the
loader cannot resolve fails `next build`.

## The evidence, and what it does not cover

### Measured

By running throwaway scripts in this worktree at `d474dc8`, Node v24.16.0,
macOS 26.6.2, Apple M1 Pro:

- The export counts per entry point, through `ts.createProgram` over each
  package's `@evanion/source` entry with the same options
  `doc-export-coverage.test.ts:146-156` uses: `@evanion/acl` 88, 34 with call or
  construct signatures, 53 types, 5 types with no properties;
  `@evanion/acl/testing` 18; `@evanion/react-acl` 26; `@evanion/urn` 9;
  `@evanion/token` 20; `@evanion/feature` 30.
- Every `generateDefinition` result in § 1.2 and § 1.3, run from `apps/docs`
  against `libs/acl/dist` after `npx nx build @evanion/acl`, importing
  `nextra/dist/server/tsdoc/base.js` by relative path. The tally 10 / 53 / 20 /
  5, the five thrown messages, the 52-row and 36-row outputs, and the seven rows
  of `InvalidConditionError`.
- The timings in § 1.1: 226 ms for the first call and 28.5, 6.1, 4.7, 4.6, 3.6,
  3.4, 2.9 ms for seven more, mean 7.7 ms.
- That `import { generateDefinition } from 'nextra/tsdoc'` fails under Node with
  `ERR_MODULE_NOT_FOUND` on `nextra/dist/client/icons/arrow-right`.
- Every Twoslash result in § 1.3 and § 2.3, through `createTwoslasher` from
  `twoslash@0.3.9`: the `hydratePolicy` query text quoted in full, the nine
  resolved types, `Operand` throwing, `type D = Decision` returning itself, and
  the body of `api.mdx:17-23` throwing.
- The JSDoc table in § 5.1, by resolving each export's alias through
  `checker.getAliasedSymbol` and calling `getDocumentationComment(checker)` and
  `getJsDocTags(checker)`, which is what `doc-export-coverage.test.ts:176-196`
  does. Including the two `@evanion/acl` exports with no docblock,
  `AccessOptions` and `DiffFinding`, and the longest at 301 words,
  `applyDenyOverlay`.
- The `@example` counts: 1 on `@evanion/acl`, 8 across every `libs/` package.
- The first paragraphs quoted in § 5.1, read off the `generateDefinition`
  `description` for `hydratePolicy` and `contractDrift`.
- § 5.2's coverage, over 162 executable fences on the site and 95 under
  `content/acl/`: 43 of 88 exports named in one, 33 of 34 callables, mean 3.9
  fences per covered export, maximum 36. And the first, wrong, run of the same
  script reporting 22 of 88 because it read executability off the expanded page.
- The 36 `#region` markers in `libs/acl/README.md` and the 57 `file=libs/acl`
  references under `apps/docs/content/acl/`.
- The Pagefind figures in § 3.1. `npx pagefind --site out --output-path out/_pagefind`
  over the `out/` this session's `nx run-many -t build` produced: 81 pages, 3,748
  words. The `/acl/api/` fragment at 3,463 words and 107 anchors, with the first
  six anchors quoted. The `/token/api/` fragment at 487 words with its table
  cells in the content string.
- § 3.4's client-component result: `urn-probe.tsx:1` is `'use client'`, and the
  `/urn/components/` fragment carries 658 words including
  `WeatherURN.parse('urn:example:weather?=lat=39#today')` and the object it
  returns, which `apps/docs/components/probes/urn.ts:28-29` computes.
- § 3.4's visibility result, over a throwaway one-page fixture carrying a
  `<div hidden>` and a `<div style="display:none">` inside a
  `<main data-pagefind-body>`. Pagefind indexed the page at 4 words with the
  content string `Alpha. visibleword. hiddenword. styledword.`, so neither form
  of hiding removes text from the index.
- The same fixture with a closed `<details><summary>More</summary>` around the
  probe word: indexed at 4 words, content `Beta. summaryword. More collapsedword.`
  So a collapsed disclosure is fully indexed.
- § 5.1.1's hover result. `createTwoslasher` attaches `docs` to a hover node
  carrying the symbol's whole docblock, with or without a `^?`: 301 words for
  `applyDenyOverlay`, 107 for `hydratePolicy`, and "One action-level decision."
  for `Decision`.
- § 5.1.1's rendered result. `apps/docs/out/acl/api/index.html` carries nine
  `twoslash-popup` occurrences from the single `twoslash` fence at
  `api.mdx:921-927`, three of them `twoslash-popup-docs` elements holding
  `assertAllowed`'s, `assertNoContractDrift`'s and `fixtureClock`'s docblocks as
  markdown paragraphs. Two of three probe sentences were found in that HTML and
  none of the three in the `/acl/api/` Pagefind fragment or in `api.mdx` itself.
- That no component in `internal/baize-ui/src/index.ts` or
  `apps/docs/components` is a disclosure today.
- § 13.4's kind distribution, by reading each export's first declaration kind
  through the TypeScript API over both `@evanion/acl` entry points:
  `@evanion/acl` is 10 function declarations, 26 interfaces, 27 type aliases, 1
  variable and 24 classes whose name ends `Error`; `@evanion/acl/testing` is 9,
  6, 1, 0 and 2. The longest export name is `TargetsTransitionsConflictError` at
  31 characters.
- That the `hydratePolicy` signature Twoslash returns is 154 characters on one
  line, against `CardGrid`'s `minmax(17rem, 1fr)` track.
- § 13.4's kind census, over all 15 TypeScript entry points in `libs/` and
  `internal/`, classifying each export's first declaration with an alias
  resolved first: 376 exports as 103 interfaces, 99 type aliases, 83 functions,
  49 constants, 38 error classes and 4 plain classes, with no enum and no
  namespace. The per-entry-point breakdown in that section's table comes from
  the same run.
- § 13.4's palette. Hue angle and chroma held, chroma capped at 0.13, lightness
  walked until the ratio clears 4.5:1, computed in OKLCH against `#142521` and
  `#E5E2D8`: the twelve hexes and their twelve ratios as tabulated, 8.17:1 to
  8.86:1 dark and 4.52:1 to 5.90:1 light.
- That `categorical`'s nine dark values span `L` 0.728 to 0.850 with a mean of
  0.789 and chroma 0.037 to 0.136, and that `categoricalOnLight`'s `amber` and
  `citron` sit at `L` 0.505 and 0.497. The new scale was placed against those.
- That the six dark values laid on paper reach 1.40:1 to 1.51:1, which is the
  defect PR #260 fixed for `availability` at 1.77:1.
- The hierarchy check: on `felt`, `chalk` is 13.67:1, `lichen` 6.17:1 and `moss`
  3.15:1, and an earlier pass of the scale at `L = 0.73` landed at 6.32:1 to
  6.92:1, indistinguishable in weight from the summary line under the name.
- The nine `categorical` hue angles (`coral` 31, `amber` 80, `stone` 84,
  `citron` 106, `mint` 148, `teal` 179, `sky` 232, `periwinkle` 273, `orchid` 317) and the closest approach between the two scales: `function` to `amber` at
  16 in sRGB, with nothing else under 24. The closest pair inside the kind scale
  is `class` to `function` at 42.
- The 106 `data-pagefind-ignore="all"` attributes and the 2 `data-pagefind-body`
  in `apps/docs/out/acl/api/index.html`.
- The 344 fence identifiers on `acl/api.mdx` and the 43 absent from its Pagefind
  fragment, by set difference between the fence bodies and the indexed content
  string.
- The page shape: 107 `##` headings, 105 ` ```ts signature ` fences, 1
  ` ```ts twoslash ` fence, 1,426 lines.
- That `npx prettier --check .` and
  `npx nx run-many -t lint test build typecheck check` both pass on this branch.

### Read here, and not run

- `base.js` and `tsdoc.js` in full, for `generateDefinition`'s branching and
  `<TSDoc>`'s table output, `linkify` and `typeLinkMap`.
- `rehype-twoslash-popup.js:39-42`, the exact-string meta match.
- `rehype.js:46-77`, where `data-pagefind-ignore` is attached.
- `nextra-theme-docs/dist/mdx-components/index.js:69`, `data-pagefind-body` on
  `<main>`.
- `mdx-region-loader.mjs` in full, for the loader position argument, the
  meta-stripping rule, `readRegion` and `withPreamble`.
- `doc-exports.test.ts:12-52`, `doc-export-coverage.test.ts:12-50`, `:176-260`
  and `:300-338`.
- `doc-twoslash.test.ts:12-36` and `:197-220`.
- `apps/docs/tsconfig.json:15-31`, the `customConditions: []` comment.
- `libs/acl/src/index.ts:1-20`, the module docblock and the `ruleId` paragraph.
- `internal/baize-ui/src/tokens/`: `ground.ts` (the six values and why they are
  chromatic), `type.ts` (the two families and the scale), `geometry.ts` (radii,
  the eight-step space scale, `measure` at `64ch`, `elevation`, and the
  interaction-only motion rule at `:52-58`), `mechanism.ts:31-41`,
  `categorical.ts:22-49`, `availability.ts:9-26`, and `class-names.ts:46-81`
  for `hueClass`, `categoricalClass` and the shared `--baize-hue` property.
- `internal/baize-ui/src/components/`: `tags.tsx` in full for `Chip`,
  `MechanismTag` and `AvailabilityPill`, `typography.tsx:8-64` for `Title` and
  its refusal of a mechanism prop, `layout.tsx:1-59` for `CardGrid`.
- `internal/baize-ui/src/styles.css:34-37` (the global focus ring),
  `:478-494` (the chip and its `--baize-hue` fallback), and `:896-903` (the
  reduced-motion block).
- `apps/docs/app/navigation.ts:155-165` and the hue of each package, and
  `apps/docs/components/landing/sections.tsx:32`, where a package's hue is
  bound.
- `apps/docs/app/[...mdxPath]/page.tsx:62`, which puts `docs-identity` and the
  package's categorical class on every MDX page, so `/acl/api/` carries coral.
- `apps/docs/app/global.css:238-302`: the light swap for an identity subtree at
  `:248-250`, the separate swap for a platform chip at `:255-257`, where the hue
  lands at `:266-290` including the `h2`/`h3` border rule § 13.4 depends on, and
  the rule pinning a non-platform chip to `lichen` at `:293-302` with the
  "says amber twice" comment.
- `apps/docs/app/global.css:60-105`, where the docs site rebinds the ground
  tokens per theme, which is why a hue scale needs its own on-light half and the
  ground tokens do not.
- PR #260's description and `internal/baize-ui/src/tokens/tokens.test.ts:206-215`,
  for the both-grounds test shape § 13.4 copies.
- PR #256's description, for the 1,637-word measurement and the exemption.
- `docs/specs/2026-09-16-documentation-standard.md` § 5's exemption table,
  § 12's G5 section, decision 21, and the step-12 evaluation at `:1039-1103`.

### Quoted from a source outside this repository

Each fetched on 2026-09-21, with the page named in § 12: TypeDoc's overview and
output options, its index plugin and search component from GitHub, the markdown
plugin's docs; api-extractor's intro, demo API report and generating-docs pages;
the rustc dev guide's rustdoc-internals and search pages and the rustdoc search
manual; `pkg.go.dev/go/doc`, `/about`, `/search-help` and `go.dev/doc/comment`;
Shiki's twoslash package page and Twoslash's api, options and notations
references.

### Asserted here and not measured

- That the first paragraph of a docblock is a usable summary for all 86. Two
  were read and both are. Nobody has read the other 84, and a docblock whose
  first paragraph is "See below." would render an entry that says nothing.
- That the `@param` lines close a useful share of § 9.1's 43 identifiers. The
  two parameter names among them would close; the options-type fields would not.
  The exact recovery was not computed, because it depends on how many `@param`
  tags exist, and that was not counted.
- That an emitted `declare` signature plus a one-paragraph summary reads as well
  as the hand-written entry. § 2.3 measured one function compiling and carrying
  hovers. Nobody has looked at a page of 105.
- That indexing every fence would put a search result on an `anti-example`.
  § 3.2's reasoning follows from `codeblocks: true` indexing all `<pre>`
  elements and from the allowance counts; the site was not built with the flag
  on.
- That Pagefind's sub-results are discoverable to a reader. § 9.1 rests on them
  and the search UI was not opened.
- Every claim about another tool is what that tool's own documentation says on
  the date recorded. Nothing in § 12 was installed or run.

## Where I am guessing

- That the first paragraph works as the open summary across all 86. Two were
  read and both do. This is weaker than it was in the previous draft and it has
  not gone away: under decision 10 a bad first paragraph is a bad summary with
  the good text one click below it, rather than a bad summary with the good text
  deleted, so the cost of being wrong is a reader who opens a disclosure they
  should not have needed. The remedy is to edit the docblock in the library
  source, which is where the sentence belongs and where the loader will pick the
  change up on the next build. Nothing in the repository enforces that a first
  paragraph is a summary, and this document does not propose a guard for it.
- That collapsing 5,939 words is better for a reader than truncating them. The
  index gains either way once the text is in the markup, so the argument is
  entirely about whether a reader who opens a disclosure is better served than a
  reader sent to `libs/acl/src`. I think obviously yes and I have not tested it.
- That roughly doubling the site's Pagefind index is harmless. The whole site
  indexes 3,748 words today and `acl/api.mdx` alone would add around 5,900. The
  bundle size of `_pagefind` was not measured before or after, and Pagefind
  chunks its index, so this is likely fine and is not established.
- That a README region is the right example unit. A region is task-shaped and an
  entry is export-shaped, and `libs/acl/README.md` has 36 regions for 88
  exports. Some entries will name a region that demonstrates them incidentally
  rather than one written for them, and which entries those are was not worked
  out. The alternative is a second region set written per export, which doubles
  the README.
- That 45 exports with no example is acceptable rather than a gap to fill. § 5.2
  argues it from G10's own type exemption. An owner who reads it as 45 unfinished
  entries wants something this document does not propose.
- That `dist/` is the right resolution. § 5.3 argues it from what
  `apps/docs/tsconfig.json` already chose, and the permanent cost is that no
  generated entry can link to a line of source. TypeDoc and `pkg.go.dev` both
  offer that link. I did not cost resolving twice.
- That the `declare` form is the right emission for a function. It compiles and
  carries hovers, measured. It also shows a reader a keyword the library's
  source does not have. I picked on compile cleanliness and did not test either
  form on a reader.
- That one rule per entry is enough. § 1.3's table has ten rows and the library
  has 88 exports. A generic type alias needs arguments supplied, which is why
  `Operand` threw, and where those arguments come from was not worked out. If
  several exports are in `Operand`'s position the loader needs a third form.
- That the filter is worth building at all once the page is generated and
  Pagefind indexes it. § 9.2 argues from a reader who is scrolling rather than
  searching, and no such reader has been observed. It is fifth in § 11 partly
  for that reason.
- That the two scales stay legible as two. § 13.4 argues it from the channels
  they occupy, the package on the page title and the heading rules and the kind
  on the heading type, and from the package hue being constant down the page
  while the kind varies. That is an argument from the stylesheet and not from a
  rendered page, and no version of this page has been rendered, so every
  judgement in § 13 about how it reads is a judgement about markup I have
  described and not seen.
- That warm-for-runtime and cool-for-erased is a distinction a reader picks up
  without being told. It is the split that decides whether a name needs
  `import type`, so it is real; whether anybody reads it off the colour is not
  something the palette can settle.
- That capping chroma at 0.13 is enough restraint for six saturated names per
  screen. `categorical` carries nine at that chroma and never shows more than a
  few at once, and a reference page shows dozens.
- That the disclosure can be animated cleanly. § 13.6 names the two mechanisms
  and neither was tried. If both are awkward the disclosure opens instantly,
  which removes the only motion in the design and costs the page nothing I can
  name.
- That a sticky filter is worth the vertical space on a page whose entries are
  fence-heavy. § 13.8 lists it as uncertain and § 11 puts the filter sixth
  partly so this can be decided against a real page.
- That nobody will want the enumerating version of the loader, which would emit
  a heading per export and make G10's first rule structural too. § 10 refuses it
  on the documentation standard's authority, and I am much less confident that
  the refusal holds once the loader exists than that it is currently right.
