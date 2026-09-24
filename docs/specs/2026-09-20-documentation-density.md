# Prose density, measured against Next.js and React Router

Status: proposed, and decision 1 is settled against this document.
`docs/specs/2026-09-21-reference-page-budget.md` was written a day later on the
same complaint and reaches the opposite answer for a reference page: a reference
page's length is set by the package's export count and not by its author, so a
word budget measures the wrong thing there. That document records the
measurement, `acl/api.mdx` at 1,637 words across 107 entries. Read decision 1
below as refuted and the rest as open. Decisions 2 to 10 speak about teaching
pages, which that document does not cover, and G8 still holds every page type to
the one 1,200-word budget.

This document was written on `docs/density-study`, without the five
`apps/docs/content/feature/*.mdx` edits that sat beside it on that branch. An
earlier revision of this paragraph said it reached `main` on 2026-09-24. It did
not: the commit sat on `docs/density-study` and then on `docs/prose-density-spec`
and `main` never carried the file. It reaches `main` through
`docs/documentation-standard-journey`, cherry-picked there on 2026-09-25 so that
`docs/specs/2026-09-25-documentation-standard.md` can cite decisions 2 to 10 at a
path that exists.

Depends on: `docs/specs/2026-09-16-documentation-standard.md` (§ 5 owns the
1,200-word prose budget and the page types; decisions 1 and 2 below replace one
budget with four), `tools/repo-checks/src/doc-prose-budget.ts` (the committed
counter, whose `proseWords` counts headings, tables and list items as prose and
so reports a larger number than this document's counter for the same page),
`tools/repo-checks/src/doc-prose-budget.json` (the ratchet, which lists only
pages already over 1,200), `docs/specs/2026-09-20-public-documentation-guidance.md`
(sentence-level rules, none of which is a length rule; decision 19 there drops
the only one that was proposed), `docs/specs/2026-09-20-documentation-prose-craft.md`
(the fourteen sentence rules this document does not touch),
`apps/docs/content/acl/*.mdx` (the 26 pages measured in section 2)
Measured against: 13 public pages fetched as raw Markdown on 2026-09-20, and
the 26 files under `apps/docs/content/acl` in this worktree at branch point
`docs/prose-rewrite`. Both sets went through one counter, defined in section 1.
Every figure in section 2 is reproducible by running that counter over the URL
or the path in the same row.
Sources reached, each by appending `.md` to the documentation URL:
`nextjs.org/docs/app/api-reference/functions/{cookies,redirect,revalidatePath}`,
`nextjs.org/docs/app/getting-started/{caching,server-and-client-components,installation}`,
`reactrouter.com/api/hooks/useLoaderData`,
`reactrouter.com/api/components/Form`,
`reactrouter.com/api/data-routers/createBrowserRouter`,
`reactrouter.com/start/framework/{data-loading,route-module,installation}`,
`reactrouter.com/tutorials/address-book`.
Not reached: `reactrouter.com/llms.txt` answers 404, so React Router publishes
no machine-readable index at the path Next.js uses. Every `reactrouter.com`
documentation path answers a `.md` suffix with `text/markdown`, which is how
the six React Router pages were read. A plain `nextjs.org` documentation URL
answers 658 KB of HTML and is unusable for counting; the `.md` suffix answers
13 KB of Markdown for the same page.
Quotation: nothing from either site is quoted. Every claim below is a count or
a summary, with the page named so it can be opened and checked.

## What is actually wrong

`apps/docs/content/acl` carries 947 prose words on a median page and one budget,
1,200, that applies to all 26 of them. Next.js and React Router spend 452 and
464 prose words on a median API reference page. A reader of `security.mdx`
reads 276 words before the page names a symbol in backticks; a reader of
`cookies` reads none, because the first word of that page is the symbol.

Reformatting the opening closes none of this. The gap holds for the whole page,
in four counts this document measures and the structural standard does not:

- The lede, meaning prose before the first `##`. Ours runs 199 words on a median
  page. Next.js reference pages run 29 and React Router API pages run 0.
- The longest unbroken prose run, meaning consecutive sentences with no code,
  list, table or heading between them. Ours runs 12.5 on a median page and 17 on
  `nestjs.mdx`. Next.js and React Router reference pages run 7 and 8.
- Sentences before the first code fence. Ours runs 15 on a median page and 40 on
  `refusals.mdx`. Theirs runs 8 and 5.
- The share of non-code words carried by a table or a list. `cookies` carries
  55%. `security.mdx` and `pitfalls.mdx` carry 0%.

One page of ours carries no code at all. `security.mdx` has one fenced block and
it is a Mermaid diagram, so 1,136 prose words reach the reader with nothing
executable beside them. `resolution.mdx` is the same at 1,020 words.

## Decisions

Each decision names a number and the count that produced it. Section 2 is the
table every number comes from.

1. A reference page carries at most 500 prose words. The Next.js reference
   median is 452 and the React Router API median is 464. Seven of our pages are
   reference pages under the structural standard's § 6 and all seven are over.
   Section 3.
2. A guide or concept page carries at most 1,050 prose words, and a tutorial is
   exempt. Next.js `caching` runs 2,306, `server-and-client-components` runs
   1,232, React Router `route-module` runs 863 and `data-loading` runs 314; the
   median is 1,047. The React Router address book tutorial runs 4,423 and is the
   only page in the sample above 2,500. Section 3.
3. The lede is at most 40 words. The four-part brief averages 142 words across
   the 17 pages that carry one and is deleted. What survives is the first part,
   compressed to one or two sentences that say what the symbol is. Next.js
   `cookies` opens on 29 words; React Router API pages open on 0 and go straight
   to `## Summary`. Section 5.
4. `Why you want it` is deleted as a page part. Across 13 public pages, two
   sections motivate anything. One asks when to use Server and Client
   Components, at 145 words, of which 109 are two criteria lists. The other asks
   why `redirect` uses 307 and 308, at 246 words. Both explain behaviour a
   reader can already observe.
   Neither argues that the reader should want the feature. Our 17 briefs spend a
   median of 43 words each on that argument. Section 5.
5. No prose run exceeds 8 sentences. Next.js reference pages peak at 9, React
   Router API pages at 8, guide pages at 7.5. Our median is 12.5. The break is a
   code fence, a table, a list or a heading, and the fix for a long run is
   usually a table. Section 4.
6. The first code fence arrives within 8 sentences. Next.js reference median is
   8, React Router API median is 5, ours is 15. A Mermaid diagram does not count
   as the first fence, because a diagram carries no symbol a reader can copy and
   the site's own `AGENTS.md` already says a diagram is never the only place a
   fact is written. Section 4.
7. A reader reaches the first backticked symbol within 25 prose words. Eleven of
   the 13 public pages do it in 13 words or fewer. Six of our 26 pages take more
   than 50, and `security.mdx` takes 276. Section 3.
8. A repeated member surface goes in a table or in one `###` per member, never in
   paragraphs. `cookies` puts six methods in one table of six rows and eleven
   options in a second, and spends 328 prose words on the whole page. React
   Router `Form` puts thirteen props in thirteen `###` sections at 36 words each.
   Section 4.
9. An `##` section carries at most 250 prose words and an `###` at most 140. The
   public `##` figures run 55 to 308 with a median of 97 on reference pages; the
   `###` figures run 36 to 136. Ours run 15 to 225 per `##`, and 86 to 1,209 per
   `###`. Section 6.
10. The 1,200-word budget in the structural standard's § 5 is replaced by
    decisions 1 and 2, and `doc-prose-budget.json` is re-ratcheted against the
    new counter. The committed `proseWords` counts a table cell and a heading as
    prose, so a page that moves facts out of paragraphs and into a table scores
    no better under it. That is the exact rewrite this document asks for, and
    the current counter cannot see it. Section 1.

Decisions 1, 2 and 9 are the expensive ones, because every page in
`apps/docs/content/acl` fails at least one. Decisions 3 and 4 are the cheapest
large win: deleting the four-part brief removes a median of 142 words from 17
pages with no fact lost, because section 5 shows the brief restates what the
page's first `##` then says.

## 1. The counter

One script produced every number in section 2, over both the fetched `.md` files
and our `.mdx` files. It is not committed, and decision 10's testing note says
what committing it would take. Its rules, in order:

1. Remove YAML front matter, HTML comments, MDX expression comments, `import`
   and `export` lines, React Router's `[MODES: …]` marker, and the three
   boilerplate lines Next.js appends pointing at `llms.txt` and `sitemap.md`.
2. Split the remainder into blocks. A fenced block is `code`. A line starting
   `|` is `table`. A line starting `#` is `heading`. A line starting `-`, `*`,
   `+` or a digit and a period is `list`. A line that is nothing but a JSX tag
   is dropped. Everything else is `prose`.
3. In a non-code block, replace `](url)` with `]`, strip JSX tags, and strip
   Markdown emphasis markers. A word is a whitespace-delimited token containing
   at least one letter or digit.
4. Prose words are the words in `prose` blocks only. A heading, a table cell and
   a list item are counted, and counted separately.
5. Symbol density is inline backtick spans in `prose` blocks per 100 prose words.
6. Words to first symbol is the prose words read before the first inline
   backtick span anywhere in the document order, headings and lists included.
7. A sentence boundary is `.`, `!` or `?` followed by whitespace and a capital,
   a backtick or an opening quote. A backticked span is replaced with one token
   first, so `cookies()` does not split a sentence.

Rule 4 is where this counter and the committed `proseWords` disagree.
`proseWords` reports 1,456 for `pitfalls.mdx` where this counter reports 1,287,
and 1,404 for `resolution.mdx` where this counter reports 1,020, because
`resolution.mdx` carries an 8% table share that `proseWords` charges to prose.

## 2. The measurements

`Prose` is prose words. `Lede` is prose words before the first `##`. `To symbol`
is prose words before the first backticked span. `Density` is backticked spans
per 100 prose words. `Run` is the longest unbroken prose run in sentences.
`Sentence` is the mean prose sentence length in words. `To code` is sentences
before the first fenced block. `Structured` is the percentage of non-code words
carried by a table or a list. `Per H2` is prose words divided by `##` count.

| Page                        | Type        | Prose | Lede | To symbol | Density | Run | Sentence | To code | Structured | Per H2 |
| --------------------------- | ----------- | ----- | ---- | --------- | ------- | --- | -------- | ------- | ---------- | ------ |
| `next-caching.md`           | Next guide  | 2306  | 61   | 10        | 3.8     | 13  | 17.5     | 4       | 14         | 210    |
| `next-server-client.md`     | Next guide  | 1232  | 98   | 129       | 3.7     | 8   | 15.4     | 21      | 13         | 308    |
| `next-redirect.md`          | Next ref    | 483   | 93   | 1         | 9.7     | 7   | 17.2     | 8       | 28         | 97     |
| `next-revalidatePath.md`    | Next ref    | 452   | 12   | 0         | 5.1     | 9   | 13.3     | 10      | 30         | 65     |
| `next-cookies.md`           | Next ref    | 328   | 29   | 0         | 5.5     | 4   | 14.0     | 1       | 55         | 55     |
| `next-installation.md`      | Next start  | 862   | 9    | 9         | 7.1     | 6   | 12.4     | 5       | 16         | 78     |
| `rr-route-module.md`        | RR guide    | 863   | 0    | 4         | 5.2     | 7   | 13.4     | 1       | 9          | 58     |
| `rr-data-loading.md`        | RR guide    | 314   | 0    | 8         | 4.5     | 6   | 15.0     | 8       | 2          | 63     |
| `rr-createBrowserRouter.md` | RR ref      | 1181  | 0    | 13        | 5.7     | 19  | 17.4     | 5       | 1          | 295    |
| `rr-Form.md`                | RR ref      | 464   | 0    | 6         | 6.2     | 8   | 14.2     | 8       | 4          | 232    |
| `rr-useLoaderData.md`       | RR ref      | 22    | 0    | 9         | 18.2    | 2   | 7.3      | 2       | 0          | 7      |
| `rr-installation.md`        | RR start    | 72    | 0    | 32        | 1.4     | 3   | 9.0      | 2       | 0          | 72     |
| `rr-address-book.md`        | RR tutorial | 4423  | 97   | 150       | 4.5     | 17  | 13.4     | 8       | 3          | 138    |
| `pitfalls.mdx`              | acl         | 1287  | 117  | 8         | 5.2     | 8   | 16.4     | 8       | 0          | 214    |
| `intermediate.mdx`          | acl         | 1209  | 217  | 9         | 5.2     | 14  | 12.2     | 12      | 7          | 173    |
| `writing.mdx`               | acl         | 1198  | 241  | 22        | 8.1     | 15  | 15.1     | 15      | 13         | 171    |
| `security.mdx`              | acl         | 1136  | 110  | 276       | 2.6     | 11  | 16.2     | 8       | 0          | 114    |
| `nestjs.mdx`                | acl         | 1106  | 212  | 0         | 9.2     | 17  | 14.9     | 22      | 3          | 123    |
| `api.mdx`                   | acl         | 1077  | 20   | 3         | 10.8    | 4   | 9.9      | 4       | 0          | 15     |
| `federation.mdx`            | acl         | 1064  | 174  | 9         | 5.8     | 14  | 14.6     | 19      | 2          | 133    |
| `next-rsc.mdx`              | acl         | 1021  | 235  | 0         | 5.9     | 15  | 15.9     | 18      | 6          | 128    |
| `platforms.mdx`             | acl         | 1021  | 162  | 84        | 5.0     | 9   | 16.4     | 20      | 7          | 146    |
| `resolution.mdx`            | acl         | 1020  | 141  | 53        | 3.1     | 11  | 17.0     | 20      | 18         | 146    |
| `asking.mdx`                | acl         | 1005  | 217  | 122       | 7.4     | 14  | 13.5     | 14      | 5          | 168    |
| `react-router.mdx`          | acl         | 978   | 211  | 0         | 7.5     | 15  | 15.5     | 17      | 7          | 109    |
| `express.mdx`               | acl         | 968   | 199  | 21        | 5.7     | 16  | 14.6     | 20      | 3          | 121    |
| `adopting.mdx`              | acl         | 927   | 258  | 126       | 4.5     | 15  | 15.9     | 15      | 8          | 154    |
| `interface.mdx`             | acl         | 921   | 229  | 9         | 4.6     | 16  | 16.7     | 20      | 6          | 154    |
| `fields.mdx`                | acl         | 899   | 173  | 23        | 5.5     | 12  | 18.8     | 4       | 6          | 225    |
| `matrix.mdx`                | acl         | 848   | 69   | 34        | 7.1     | 8   | 16.7     | 2       | 8          | 141    |
| `advanced.mdx`              | acl         | 841   | 255  | 9         | 5.6     | 10  | 15.3     | 7       | 4          | 140    |
| `refusals.mdx`              | acl         | 838   | 354  | 51        | 7.9     | 14  | 13.9     | 40      | 16         | 210    |
| `authoring.mdx`             | acl         | 827   | 144  | 0         | 7.6     | 9   | 18.7     | 4       | 20         | 118    |
| `decisions.mdx`             | acl         | 808   | 160  | 7         | 6.2     | 6   | 14.1     | 2       | 15         | 202    |
| `publishing.mdx`            | acl         | 776   | 208  | 8         | 2.4     | 14  | 16.7     | 20      | 3          | 129    |
| `capabilities.mdx`          | acl         | 679   | 199  | 72        | 5.3     | 13  | 14.4     | 13      | 6          | 170    |
| `index.mdx`                 | acl         | 676   | 397  | 16        | 3.3     | 12  | 10.2     | 12      | 37         | 169    |
| `simple.mdx`                | acl         | 668   | 171  | 122       | 4.8     | 12  | 11.1     | 19      | 13         | 111    |
| `register.mdx`              | acl         | 237   | 54   | 6         | 3.4     | 6   | 14.6     | 16      | 72         | 47     |

The medians, by page type:

| Type             | n   | Prose | Lede | To symbol | Density | Run  | To code | Per H2 |
| ---------------- | --- | ----- | ---- | --------- | ------- | ---- | ------- | ------ |
| Next reference   | 3   | 452   | 29   | 0         | 5.5     | 7    | 8       | 65     |
| React Router API | 3   | 464   | 0    | 9         | 6.2     | 8    | 5       | 232    |
| Guide or concept | 4   | 1047  | 30   | 9         | 4.2     | 7.5  | 6       | 137    |
| Getting started  | 3   | 862   | 9    | 32        | 4.5     | 6    | 5       | 78     |
| `acl`            | 26  | 947   | 199  | 12.5      | 5.5     | 12.5 | 15      | 143    |

Symbol density is the one metric where we already pass. Our median is 5.5 and
the public medians run 4.2 to 6.2. Our pages name symbols at the same rate and
then write four times as much prose around each one, so density alone will not
find the pages that need cutting. `security.mdx` at 2.6 and `publishing.mdx` at
2.4 are the two pages it does find.

## 3. The prose budget of a reference page

500 words, from decision 1. The evidence is the three Next.js function pages at
328, 452 and 483, and React Router `Form` at 464. Two pages in the sample sit
outside that range in opposite directions and both are instructive.

`rr-useLoaderData.md` carries 22 prose words. The page is a title, a one-sentence
summary, a 10-line example, a signature fence and a one-sentence `## Returns`.
React Router generates it from the JSDoc on `hooks.tsx`, so its floor is whatever
the source comment says. A reference page can be 22 words when the symbol takes
no arguments.

`rr-createBrowserRouter.md` carries 1,181 prose words and is the worst-behaved
public page in the sample: a 19-sentence prose run, 17.4 words per sentence, 295
prose words per `##`. It documents a router factory with a large options object
and it documents each option in prose under four `##` headings. It is the shape
our pages have. One page of the thirteen has it, and the other twelve do not.

Guide pages run wider. Next.js `caching` at 2,306 words is a Cache Components
tour with 15 fences and 154 prose words between fences. `rr-data-loading.md`
covers three loading modes in 314 words and six fences, at 52 prose words per
fence. Decision 2 takes the median of the four at 1,047 and rounds it, which
leaves our worst guide page, `pitfalls.mdx` at 1,287, needing a cut of about
240 words. Nothing on that page needs restructuring.

Words to the first symbol is the cheapest diagnostic in the set. Eleven of 13
public pages reach a backticked symbol in 13 prose words or fewer. The two that
do not are `next-server-client.md` at 129 and `rr-address-book.md` at 150, a
concept page and a tutorial, and both spend those words defining the domain
before any symbol exists to name. Six of our pages take more than 50 words, and
four of those six are reference or platform pages where a symbol exists in the
first sentence and the page declines to write it.

## 4. What carries the facts

Both sites take a repeated member surface out of paragraphs. They disagree on
where they put it, and the disagreement is worth copying in both directions.

| Page                        | Members               | Form                 | Prose words | Structured share |
| --------------------------- | --------------------- | -------------------- | ----------- | ---------------- |
| `next-cookies.md`           | 6 methods, 11 options | Two tables           | 328         | 55%              |
| `next-revalidatePath.md`    | 2 parameters          | Table plus list      | 452         | 30%              |
| `next-redirect.md`          | 2 parameters          | Table plus list      | 483         | 28%              |
| `rr-Form.md`                | 13 props              | 13 `###` at 36 words | 464         | 4%               |
| `rr-createBrowserRouter.md` | 9 options             | 9 `###` at 131 words | 1181        | 1%               |
| `refusals.mdx`              | 7 refusal reasons     | Table plus prose     | 838         | 16%              |
| `security.mdx`              | 3 tiers, 5 threats    | Prose                | 1136        | 0%               |
| `pitfalls.mdx`              | 15 pitfalls           | 15 `###` at 86 words | 1287        | 0%               |

Next.js puts a member in a table row. A row is three cells: the name, the type,
and one sentence. `cookies` describes its entire method surface that way and
spends the 328 prose words it saved on five `##` sections of gotchas and worked
examples. The structured share of 55% is the highest in the sample and the prose
count is the lowest of any full reference page.

React Router puts a member in its own `###`, with a signature fence and one or
two sentences. `Form` runs 36 prose words per prop. That form survives a prop
whose explanation needs a code example, which a table cell cannot hold.

`pitfalls.mdx` already has React Router's shape, at 15 `###` sections and 86
words each. It needs nothing structural. `security.mdx` has neither, and its
three tiers and five named threats are all in running paragraphs at 0%
structured share.

The rule decision 8 states: a member whose explanation fits one sentence goes in
a table row; a member that needs a code example goes in its own `###` under 140
words. A member described in a paragraph inside a larger section is the defect.

Two counts support decision 5 and decision 6 separately from the member
question. Next.js keeps 154 prose words between code fences on its longest page
and 20 on `cookies`. Our `security.mdx` and `resolution.mdx` have one fence
each, and in both cases that fence is a Mermaid diagram, so the figure is
undefined and the reader sees 1,136 and 1,020 prose words with no code. Three
more of our pages, `interface.mdx`, `publishing.mdx` and `refusals.mdx`, carry
one non-diagram fence apiece.

## 5. How they handle why

They mostly do not. Two sections across 13 pages motivate anything.

Next.js `server-and-client-components` carries `When to use Server and Client
Components?` at 145 words. Two sentences of prose set up the split and the other
109 words are two bullet lists of criteria, each item naming an API. The section
answers which to pick, and it does that with a checklist.

Next.js `redirect` carries `Why does redirect use 307 and 308?` at 246 words,
all prose, and it is the longest continuous argument in the sample. It explains
why the status code a reader will see in the network tab is not the one they
expected. The subject is an observable fact, and the page is answering a
question a reader already has.

Next.js `caching` opens on one 33-word sentence defining what caching is and
goes straight to `## Enabling Cache Components`. It makes no case for caching.
React Router API pages open with no lede at all and put `## Summary` first.

Against that, 17 of our 26 pages carry a four-part brief averaging 142 words,
of which a median of 43 is `Why you want it`. `refusals.mdx` opens on a
354-word lede: a support ticket, a customer, a greyed-out button, and an
argument that treating every refusal as forbidden creates support load. The
page's first `##` then says the same thing with the field names in it. The
scene is not carrying a fact the rest of the page lacks.

Decision 4 deletes the part. Decision 3 keeps the first part of the brief at
one or two sentences, which is what Next.js `cookies` and `caching` both do.
The case for using the package belongs on `index.mdx`, once.

## 6. Section size

| Scope                  | Public range | Public median | `acl` range | `acl` median |
| ---------------------- | ------------ | ------------- | ----------- | ------------ |
| Reference `##`         | 55 to 295    | 97            | 15 to 225   | 143          |
| Guide `##`             | 58 to 308    | 137           | 15 to 225   | 143          |
| `###` where present    | 36 to 136    | 97            | 86 to 1209  | 355          |
| Lede before first `##` | 0 to 98      | 9             | 20 to 397   | 199          |

The `##` row is the one where we are closest. Our median of 143 prose words per
`##` sits inside the public range, and `api.mdx` at 15 is a generated page with
74 headings.

The `###` row is where we are furthest. Eight of our pages carry `###` headings
and five of those spend more than 350 prose words under each one, up to 1,209 on
`intermediate.mdx`. A public `###` is a member, a parameter or a single named
behaviour at 36 to 136 words. Ours is a second-level topic with paragraphs under
it. Decision 9 sets 140 as the ceiling, matching React Router
`createBrowserRouter` at 131, which is the largest well-formed public `###` in
the sample.

## 7. What they do not have

Counted absences, over all 13 pages:

- No analogy and no metaphor. One occurrence of `like a` in `rr-address-book.md`
  and one in `next-server-client.md`. Both name a shape inside software, and
  neither reaches outside it. Our 26 pages carry five, which is the one axis
  where we already match them.
- No named domain outside the product. `cookies` uses cookies, `redirect` uses
  `/users` and `/people`, `revalidatePath` uses a blog post. React Router's
  tutorial uses a contacts app and names it `address book` in the URL. No page
  carries a fictional company, a character or a scenario with people in it.
- No first-person plural outside the tutorial. `we` appears 113 times in
  `rr-address-book.md`, 14 times in `rr-createBrowserRouter.md`, and zero or one
  time in the other eleven. Our 26 pages carry zero, which is stricter than
  either site.
- No running example across pages. Each Next.js page invents the smallest
  example that shows its own symbol and drops it. The one running example in the
  sample is the address book tutorial, which is the only page over 2,500 words.
- No difficulty label, no read-time estimate, no prerequisite list in the body.
  Next.js carries `prerequisites` and `related` in YAML front matter, rendered
  as navigation. React Router carries a `[MODES: …]` marker and nothing else.
  Our `PageSheet` component puts `difficulty`, `read`, `hands`, `requires` and
  `unlocks` in the page body above the first paragraph.

The absence that matters most for a rewrite is the fourth. A page of theirs
carries only the example its own symbol needs, which is why a 328-word page can
hold eight worked snippets. Our pages carry a scenario that has to be set up
before the symbol appears, and the setup is the lede that decision 3 cuts.

## 8. Where we are worst

Six targets, each with the measurement that names it:

1. `security.mdx`. 276 prose words before the first backticked symbol, against a
   public median of 0 to 9. 2.6 symbols per 100 prose words, the second-lowest
   on our site. 0% structured share with three tiers and five named threats in
   running paragraphs. One fenced block, and it is a diagram. Fix decisions 7, 8
   and 6 here first.
2. `refusals.mdx`. A 354-word lede, the largest on the site, and 40 sentences
   before the first fence against a public median of 8. The seven reasons are
   already in a table; the lede is the whole defect.
3. `index.mdx`. A 397-word lede on a 676-word page, so 59% of the page's prose
   arrives before the first `##`.
4. `nestjs.mdx`. A 17-sentence unbroken prose run, the site maximum, and 22
   sentences before the first fence on a page with 12 fences and 10 verified
   regions available to break it.
5. `intermediate.mdx`, `asking.mdx`, `platforms.mdx` and `adopting.mdx`. 1,209,
   1,005, 1,021 and 927 prose words per `###` topic or per page, with ledes of
   217, 217, 162 and 258. These are the four where decision 3 alone removes over
   200 words each.
6. `resolution.mdx` and `publishing.mdx`. 1,020 and 776 prose words with one
   non-diagram fence between them. `publishing.mdx` at 2.4 symbols per 100 words
   is the lowest density on the site.

`pitfalls.mdx` is the counterexample worth keeping. It is our longest page at
1,287 prose words and it already has React Router's `###` shape at 86 words per
pitfall and an 8-sentence maximum run. It needs 240 words cut and no
restructuring.

## Testing

Nothing here needs code before a rewrite starts. What a rewrite needs:

- The counter from section 1 committed under `tools/repo-checks/src`, as
  `doc-density.ts`, exporting the block classifier. The existing `proseWords`
  becomes one caller of it, and the ratchet re-baselines. Without this, decision
  10 cannot be checked and a page that moves facts into a table scores worse
  under the current counter than the paragraphs it replaced.
- A guard on decision 5, the 8-sentence run. It is syntactic: split on blocks,
  count sentences between them. It is the single number that separates our pages
  from theirs on every page type.
- A guard on decision 3, the 40-word lede. Prose words before the first `##`
  needs no judgement.
- One page rewritten against all ten decisions before any guard lands, so the
  numbers get tested against a real page. `security.mdx` is the candidate: it
  fails decisions 1, 5, 6, 7 and 8 and it is a page whose content a reader
  actually needs.
- Decision 6's Mermaid exclusion needs the fence classifier to read the info
  string, which `diagram-captions.test.ts` already parses.

## The evidence, and what it does not cover

Measured, by running the section 1 counter:

- Every figure in section 2's two tables, over the 13 URLs listed at the top and
  the 26 files in `apps/docs/content/acl` at branch point `docs/prose-rewrite`.
- The four-part brief figures in section 5, by extracting each `**The concept.**`
  through `**How the library gets you there.**` block from the 17 pages carrying
  one. Median brief 142 words; `Why you want it` median 43, maximum 84 on
  `advanced.mdx`.
- The two motivation sections in section 5, at 145 and 246 words, by extracting
  the section between its heading and the next heading.
- The fence composition in sections 3, 4 and 8, by counting fence info strings
  in each `.mdx`: `security.mdx` and `resolution.mdx` carry one fence each and
  both are `mermaid`; `interface.mdx`, `publishing.mdx` and `refusals.mdx` carry
  one non-diagram fence each.
- The absence counts in section 7, by case-insensitive grep for `imagine`,
  `think of`, `analogy`, `picture a`, `suppose`, `like a` and for `we` as a
  whole word.
- The disagreement between this counter and `proseWords` in section 1, by
  reading `doc-prose-budget.json` for `pitfalls.mdx` (1,456) and
  `resolution.mdx` (1,404) against this counter's 1,287 and 1,020.

Asserted, and not measured:

- That 500 words is the right ceiling for our reference pages. It is the median
  of six public reference pages. Nobody has rewritten one of ours to 500 words
  to find out what stops fitting. The obvious risk is `interface.mdx`, which
  documents a six-member interface and would have to lose most of what is
  currently paragraph explanation.
- That deleting `Why you want it` loses nothing. The argument is that two public
  sections in 13 pages motivate, and neither motivates a feature. Our briefs may
  be carrying a fact that appears nowhere else on the page, and section 5 checked
  that on one page, `refusals.mdx`, not on all 17.
- That 8 sentences is the right run cap. The public reference maximum is 9 on
  `next-revalidatePath.md` and the public overall maximum is 19 on
  `rr-createBrowserRouter.md`, which section 3 calls their worst page. The cap
  takes the reference median and ignores the two guide pages above it.
- That a Mermaid diagram should not count as a first fence. No public page in
  the sample carries a diagram at all, so nothing was measured about how a
  diagram affects the first-fence distance. The argument is from `apps/docs/AGENTS.md`.
- That the sample is representative. Six reference pages, four guides, two
  getting-started pages and one tutorial. Next.js publishes roughly 200 pages
  and React Router roughly 100, and neither site was sampled at random.
- That Next.js code share is comparable to ours at all. Next.js emits each
  example twice, once as TypeScript and once as JavaScript, marked `switcher`:
  16 such fences on `cookies` and 30 on `server-and-client-components`. So the
  `pct_code` figures behind section 2 overstate Next.js code roughly twofold,
  which is why no code-share column appears in the table.

## Where I am guessing

- That react.dev would agree with these numbers. The owner named it and no
  react.dev page was fetched for this document. It is the site the prose-craft
  spec already measured at 57% reader-addressing on `useState`, so it behaves
  differently from these two on at least one axis, and its reference pages are
  the closest public analogue to ours.
- That the lede number transfers to teaching pages. Decision 3's 40 words comes
  from reference and getting-started pages. `simple.mdx` and `intermediate.mdx`
  are teaching pages in a sequence, and the structural standard's fading rule
  gives their openings a job the public pages do not have.
- That `api.mdx` should be exempt. It is generated, 74 `##` sections, 15 prose
  words each, 49% code by word count. Nothing in decisions 1 through 9 fits it,
  and no decision here says so explicitly.
- That the owner wants the length cut and not the structure changed. Decisions 1
  through 4 and 9 cut words. Decisions 5, 6 and 8 move facts from paragraphs
  into tables and `###` sections, which changes total length very little and
  changes what a skimming reader gets. Section 4 argues the second is what
  produced Next.js's 328-word `cookies` page, so a cut alone will not reach
  these numbers.
