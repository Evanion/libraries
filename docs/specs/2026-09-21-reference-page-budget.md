# The word budget on a reference page

Status: proposed. Nothing is implemented. G8 reports today and fails nothing, so
adopting or rejecting this changes a report rather than a build.
Packages: none. This is a repository guard and a documentation standard
amendment.
Depends on: `tools/repo-checks/src/doc-prose-budget.test.ts` (G8, the guard),
`tools/repo-checks/src/doc-prose-budget.ts` (`proseCounts` and `proseWords`),
`tools/repo-checks/src/doc-prose-budget.json` (the recorded allowance),
`tools/repo-checks/src/doc-floor.test.ts` (`missingRoles`, which is where a
page's role is already decided by its filename),
`docs/specs/2026-09-16-documentation-standard.md` § 5 (what the budget is for)
and § 12 (G8's definition, and its own statement that G8 is the least valuable
of the nine guards), decision 8 of the same document (one `##` heading per
export).
Measured against: `main` at `d474dc8`. Every count below was produced by running
`proseCounts()` and `proseWords()` and by counting `##` headings in this tree
during this session.

## What is actually being asked

The owner's words: reference pages should not have limits. The trigger was
`apps/docs/content/acl/api.mdx` crossing the 1,200-word guideline after eighteen
entries were added for `@evanion/acl/testing`, and the agent that added them
recording the new total in `doc-prose-budget.json` rather than splitting the
page.

This document set out to propose a per-entry budget instead of an exemption, on
the theory that a reference page can still turn into an essay and that a
blanket exemption would stop noticing. The measurement that was supposed to
support that theory refuted it. § 2 records what happened, because the reasoning
is the useful part.

## Decisions

1. A reference page's length is set by the package's export count and not by
   the author, so a fixed per-page budget measures the wrong thing on one.
   Measured: `acl/api.mdx` is 1,637 words across 107 entries, which is 15 words
   an entry. § 1.
2. The repository holds no instance of the failure a per-entry budget would
   catch. The one candidate, `react-widget/api.mdx` at an apparent 123 words an
   entry, turned out to be a counting artifact: three of its nine `##` headings
   are not exports, and its six export entries average 82 words and read well.
   § 2.
3. Reference pages are therefore exempt from G8, with no replacement
   comparison. This is what the owner asked for, and the case built against it
   did not survive being measured. § 3.
4. A reference page is identified by filename, `api.mdx`, which is how
   `doc-floor.test.ts` already decides that a section has an API reference
   (`missingRoles`, via `pageExists(slug, 'api')`). No new metadata and no nav
   file is read. § 4.
5. The nav band is the wrong unit. The `acl` section's Reference band holds nine
   pages and seven are arguments rather than catalogues, and those seven are
   where the budget still earns its place. § 5.
6. `register.mdx` is the repository's other catalogue and is not exempted here,
   because it is under the budget today and a rule written for no case is a rule
   nobody can check. § 6.
7. `doc-prose-budget.json` loses its `acl/api.mdx` entry and keeps its purpose
   for every other page. § 7.
8. Migration guides on an API reference page are what actually inflated the one
   page examined here, by 133 words, and a 416-word `Types` section inflated it
   further. Both are observations about page composition rather than about the
   budget, and neither is this document's business. Recorded in § 8 so the next
   person measuring that page does not repeat § 2's mistake.

Decision 3 is the conclusion. Decision 2 is the one worth reading, because it is
where this document changed its mind.

## 1. Why the fixed budget measures the wrong thing here

§ 5 of the documentation standard gives the budget one job: a page over it is
often two reader questions sharing a URL, so the search result and the table of
contents both point at the wrong half.

A reference page is one reader question, and the question is "what does this
package export". Decision 8 of the same document fixes the answer's shape: one
`##` heading per export, so a reader who already knows the symbol gets an
anchor, a table of contents entry and something to search for. Splitting the
page to satisfy the budget removes the property decision 8 exists to provide.

Measured, `acl/api.mdx` carries 107 headings and 1,637 words. That is 15 words
an entry, which is a signature fence and a sentence. There is no bloat to cut.
The page is long because `@evanion/acl` exports a lot, and the number the guard
reports is a fact about the package.

The count also drifts for a reason no author controls.
`doc-prose-budget.json` recorded 1,547 and the page now measures 1,637, because
entries were added. Every future export moves the number and obliges an edit to
a file that exists to record a deliberate exception. That churn is the clearest
sign the rule is attached to the wrong quantity.

## 2. The case against an exemption, and why it failed

The argument was that a reference page can grow an essay around its entries, so
a reader who arrived for a signature reads six paragraphs to reach it. A
blanket exemption would stop reporting that, and a per-entry budget would catch
it while letting a large package have a long page.

Across the eleven `api.mdx` pages, one looked like the instance:
`react-widget/api.mdx` at 1,109 words against 9 `##` headings, which is 123
words a heading and eight times the density of the page that triggered this
document.

Measuring the page section by section dissolved it:

| Section                                  | Words |
| ---------------------------------------- | ----: |
| `createWidgets(config)`                  |    71 |
| `<Widgets>`                              |    90 |
| `validateItems(items, known, required?)` |   128 |
| `DefaultWrapper`                         |    58 |
| `DefaultItem`                            |    85 |
| `ERROR_MESSAGES`                         |    59 |
| Types                                    |   416 |
| Migrating from 0.2.x                     |    92 |
| Migrating from 0.1.x                     |    41 |

Three of the nine headings are not exports. The six that are total 491 words and
average 82, which is ordinary reference prose. `Types` alone is 416 words and
the two migration guides are 133 between them, and those three account for 549
of the page's 1,109.

Reading the entries confirms the arithmetic. `validateItems`, the densest at
128, spends its words saying that the export is re-exported unchanged, that two
entry points reach it, and that `props` is checked by the type system rather
than by this function. A reader looking for the signature is sent to the core's
entry in the first sentence. Nothing there is padding.

So the failure a per-entry budget would catch has no instance in this
repository, and the figure that suggested otherwise was an artifact of counting
non-export sections as entries. A rule invented to catch a case nobody has
produced is a rule that will first fire on a page that is fine.

## 3. The exemption

For a page named `api.mdx`, G8 does not compare and does not report. No
per-entry figure replaces the page total.

This is decision 3 and it is what the owner asked for. The argument in § 2 is
recorded rather than acted on, and the reason to keep it in this document is
that somebody will propose the per-entry rule again, and the measurement that
refutes it is worth having written down.

**What is given up.** If a reference page does grow an essay, nothing reports
it and a reviewer catches it by reading. Given that G8 fails nothing today, a
reviewer reading the page was always the mechanism that caught it; the guard
only decided whether a line appeared in a report somebody may not read.

## 4. Identifying a reference page

`doc-floor.test.ts` decides that a section has an API reference by testing for
`content/<slug>/api.mdx` (`missingRoles`, via `pageExists(entry.slug, 'api')`).
The same test identifies the page here. A file named `api.mdx` under a section
is that section's reference.

This adds no metadata to any page, reads no nav file, and cannot disagree with
the floor guard about what a reference page is, because both ask one question of
the filesystem.

## 5. Why the nav band is the wrong unit

`apps/docs/content/acl/_meta.ts` puts nine pages in the Reference band:
`pitfalls`, `matrix`, `authoring`, `decisions`, `resolution`, `fields`,
`security`, `register` and `api`.

Two of those enumerate something outside the author's control. `api` has one
entry per export, and `register` has one per `SEC-` identifier in
`libs/acl/SECURITY.md`. The other seven are arguments: `resolution` works
through a seven-step precedence order, `security` states a threat model,
`pitfalls` collects cases. Each is one reader question and each could genuinely
become two, which is the condition § 5 of the standard describes. Measured,
`pitfalls` is the closest of them to the budget at 1,171.

Exempting the band would exempt the seven pages the budget is most useful on, to
reach the one page it is useless on.

## 6. `register.mdx`, and why it waits

`register` is the repository's other catalogue and is the natural second member
of any rule written here. It is under the budget today, so exempting it now
would be a rule with no case behind it, and the repository's own history is
against that: `2026-09-17-acl-no-cascade.md` § 4 declined to specify a lint
partly because nothing in the repository declared the pairs it would check.

When `register.mdx` crosses 1,200, extend decision 4's filename test to it and
record the measurement that prompted it.

## 7. What happens to the allowance file

`doc-prose-budget.json` holds one entry today, `apps/docs/content/acl/api.mdx`
at 1,547, and that entry is already stale against a measured 1,637.

Under decision 3 the entry is removed, because the page is no longer compared
against anything. The file keeps its shape, its purpose and its ratchet
behaviour for every non-reference page.

## 8. Two observations about page composition, not about the budget

Both come out of § 2 and neither is acted on here.

`react-widget/api.mdx` carries two migration guides totalling 133 words. A
migration guide answers "how do I move from the version I have", which is a
different reader question from "what does this package export". Whether it
belongs on the reference page is a question for the documentation standard's
page-role rules rather than for a word count.

The same page's `Types` section is 416 words under one heading, which is 38% of
the page. That is a catalogue inside a catalogue, and decision 8's
anchor-per-export property does not reach the names inside it. Whether each type
deserves its own `##` is the same question G10 asks about export coverage, and
`tools/repo-checks/src/doc-export-coverage.test.ts` already answers it for
`@evanion/react-widget`: the package has 18 undocumented type names recorded in
the allowance, which is consistent with them sitting inside that section rather
than carrying headings.

## Testing

The guard is a test, so the change is a change to a test. Three cases hold it:

- `acl/api.mdx` is not reported, because it is a reference page.
- A non-reference page over 1,200 is still reported, which needs a fixture
  rather than a real page, because no real page is over today apart from the one
  being exempted.
- The allowance still reports a stale entry for a non-reference page, which is
  the existing ratchet behaviour and must not change.

## The evidence, and what it does not cover

### Measured

- `proseCounts()` over `apps/docs/content` on `main` at `d474dc8`. One page
  exceeds 1,200: `acl/api.mdx` at 1,637. The next four are `acl/pitfalls.mdx`
  at 1,171, `acl/react-router.mdx` at 1,157, `acl/next-rsc.mdx` at 1,152 and
  `acl/intermediate.mdx` at 1,145.
- `##` heading counts across the eleven `api.mdx` pages: `acl` 107, `compose`
  11, `widget` 11, `react-acl` 10, `react-widget` 9, `feature` 6,
  `nestjs-correlation-id` 6, `luhn` 5, `token` 5, `urn` 5, `astro-widget` 4.
- `proseWords()` per section of `react-widget/api.mdx`, tabled in § 2. Six
  export entries total 491 words; `Types` is 416; the two migration guides are 133.
- `doc-prose-budget.json` records `acl/api.mdx` at 1,547 against a current
  measurement of 1,637.

### Read here, and not run

- `doc-floor.test.ts`'s `missingRoles` and `pageExists`, for how a page's role
  is already decided.
- § 5 and § 12 of the documentation standard, and decision 8, for what the
  budget is for and what a reference page's headings are.
- The six export entries of `react-widget/api.mdx`, read to check whether the
  arithmetic in § 2 matched the prose. It did.

### Asserted here and not measured

- That splitting `acl/api.mdx` would cost the anchor-per-export property. This
  follows from decision 8 rather than from an experiment; nobody has split the
  page to see what it costs a reader.
- That no reference page in the repository has grown an essay. Six of the eleven
  `api.mdx` pages were not read section by section, only counted.

### Where I am guessing

Whether the exemption should be permanent or should expire. A repository with
eleven reference pages and no instance of the failure is weak evidence that the
failure will not appear, and the honest position is that § 2's measurement
describes today. If a reference page does grow an essay later, this document's
§ 2 is the thing to reread, and the per-entry rule it rejected is the thing to
propose again with a real case attached.
