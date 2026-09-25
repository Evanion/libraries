# The documentation standard

Status: proposed. Replaces `docs/specs/2026-09-16-documentation-standard.md`,
which is marked superseded by this document and kept.

Supersedes: `docs/specs/2026-09-16-documentation-standard.md` in full. That
document's page types, runnable requirement, self-containment rules, domain rule,
ordering rules and guard definitions are carried forward here, renumbered, and
the carry-forward is stated per section so a reader can check that nothing was
dropped silently. Its decision 9, the 1,200-word prose budget, does not survive;
§ 14 records the retirement and the reason.

Built from: the owner's documentation meta-prompt, handed over on 2026-09-25 as
an untracked `docs_guidelines.md` in the repository root. That file is not
committed and no longer exists. Its rules are here, in § 1 to § 6; its procedure
is in `.claude/skills/docs-page/SKILL.md`; its per-article constraints are review
questions in `.claude/agents/docs-reviewer.md`. Where a requirement of it is
narrower than the prose around it, the requirement is quoted so the wording
survives the paraphrase.

Folds in: `docs/specs/2026-09-20-documentation-density.md` decisions 2 to 10,
which § 7 adopts, amends or declines one at a time with the reason beside each.
That document's decision 1 is refuted by
`docs/specs/2026-09-21-reference-page-budget.md` and is not resurrected here.

Depends on: `docs/specs/2026-09-20-public-documentation-guidance.md` (sentence
rules; nothing here overrides one, and its decisions 21 and 22 are what make § 5
enforceable by a reviewer), `docs/specs/2026-09-20-documentation-prose-craft.md`
(the reasoning behind those rules), `docs/specs/2026-09-21-reference-page-budget.md`
(a reference page's length is the package's export count),
`docs/specs/2026-09-16-diagrams.md` (the diagram mechanism, which this document
places on a page and does not define), `docs/specs/2026-09-13-interactive-examples.md`
(the probe and the three kinds of example), `docs/specs/2026-09-13-versioned-docs.md`
(the archive the page-presence guards must not fight), `tools/doc-examples` (the
region loader, and the `// -> value` rewriter that § 6 turns into a rule),
`tools/repo-checks/src` (the guards, one file per guard, inventoried in § 14),
`apps/docs/app/navigation.ts` (the per-section metadata every structural guard
reads), `apps/docs/content/*/_meta.ts` (the reading order).

Measured against: `main` at `eb085cc`, 84 `.mdx` pages under `apps/docs/content`,
12 documented sections. Every count in "What is actually wrong" and in § 6 was
produced in this tree during this session, and the method is stated beside the
number.

## What is actually wrong

The owner's complaint: the documentation is too jarring, too abstract and too
confusing for a new reader. Four things were diagnosed and each was checked
before it was acted on. Three held as stated and one held with a correction.

**`@evanion/acl` has no Setup article.** Verified. `apps/docs/content/acl/_meta.ts`
opens its Setup band on `simple`, titled "Rules that read the subject", which
teaches a concept rather than getting a reader running. `npm install @evanion/acl`
is written once across all 32 acl pages, at `simple.mdx:54`, below a
`WorkshopNotice`, a `PageSheet`, the four-part brief and two prose sections. No
acl page states prerequisites, a minimum configuration, or a first result. One
correction: `WorkshopNotice` prints `npm install @evanion/acl` itself, so
`simple.mdx` renders the command twice and neither rendering is the page's
subject.

**The four-part brief is on 30 pages of 84.** Verified exactly, by counting files
containing `**The concept.**`. The four parts are identical every time:
`**The concept.**`, `**What you get.**`, `**Why you want it.**`,
`**How the library gets you there.**`. A reader meets it on `acl/index.mdx` and
again on `acl/simple.mdx`, the next page. It also breaks the repository's own
prose rule that bold marks a term being defined, and the density study measured
it at a median of 142 words with a median of 43 spent on `Why you want it`.

**`acl/index.mdx` opens on repository metadata.** Verified. The page's first
element after the `# ` heading is a `WorkshopNotice` naming the unit suite, the
adversarial suite, `libs/acl/SECURITY.md` and a spec path under
`docs/superpowers/specs/`. A reader learns what the library is for in the brief
below it.

**The density study's numbers hold.** A median acl page carries 947 prose words
against 452 for Next.js and 464 for React Router reference pages; `security.mdx`
spends 276 prose words before naming a symbol in backticks; `acl/index.mdx`
spends 397 of its 676 prose words before its first `##`. Its decisions 2 to 10
are open and point the same way the meta-prompt does, which § 7 works through.

One thing the diagnosis did not name, and it is the largest of the five. The site
already has the mechanism for a reader to see a result: `tools/doc-examples`
rewrites a `// -> value` comment inside an executed region into an
`expect().toEqual()` that CI runs, so a page can show a call and the value it
produced with the build standing behind the value. Measured, 42 of the 84 pages
render at least one region carrying such a value, and `libs/acl/README.md`'s 36
regions all carry one. The strongest thing this site has is already built and
half-used, and no rule in the old standard asked for it. § 6 is that rule.

## Decisions

1. A section's pages are three stages a reader walks in order, and the stage
   decides what the page may contain. An **Overview** builds the mental model. A
   **Setup** article gets the reader to a first working result. A **Feature
   deep-dive** teaches one piece of the toolkit. § 1.
2. The Overview carries the hook, the mental model, the vocabulary and the
   capability map, and carries no install command and no configuration. It ends
   with a call to action into the Setup article. § 2.
3. Every documented section has a Setup article at `getting-started.mdx`,
   carrying prerequisites, the install command, the minimum configuration that
   runs, and one result the reader can see. It ends with a call to action into
   one named deep-dive. § 3.
4. A feature deep-dive opens on the implementation problem it solves, shows the
   code for the task, says why the code is shaped that way, and stops. § 4.
5. The four-part brief is deleted. Nothing fixed replaces it. What each stage
   owes instead is one sentence per stage, stated in § 5, and the sentence
   differs per stage on purpose, because a rubric a reader meets on thirty pages
   reads as furniture whatever its parts are.
6. A page whose reader builds something owes a success moment: a result the
   reader sees rather than a description of one. A page the reader enters to
   understand or to look something up owes nothing of the kind, and padding one
   in is the defect. The strongest form is a `// -> value` claim inside an
   executed region. § 6.
7. A reference page's length is the package's export count.
   `docs/specs/2026-09-21-reference-page-budget.md` settled that, and no
   per-page word budget applies to any page type. The density study's shape rules
   replace the budget, and § 7 says which of its ten decisions are adopted.
8. An API reference page has one heading per exported symbol, spelled as the
   symbol. Carried unchanged from the old standard's decision 8; three guards
   depend on it. § 8.
9. A code fence executes unless it carries one of five named exemption tags, and
   `file=… region=…` is the only way a TypeScript example reaches a page.
   Carried unchanged from the old standard's decisions 10 and 11. § 9.
10. A teaching page's prose, diagrams and fences stand complete with every
    interactive control removed. Carried unchanged from the old standard's
    decision 12. § 9.
11. Self-containment is a property of an H2 section rather than of a page, and
    the agent surface is a `.md` sibling per page. Carried unchanged from the old
    standard's decisions 3 and 14. § 10.
12. One domain across every section: the board game shop the demo apps already
    run. Carried unchanged from the old standard's decision 16. § 11.
13. Separators rather than folders, and every section directory has a `_meta.ts`
    naming every page in reading order. Carried unchanged from the old
    standard's decisions 18 and 19. § 12.
14. Eleven guards, of which nine are kept with their citations repointed, one is
    updated, one is retired, and two are new. The retired one is the prose
    budget. § 14.
15. Three pages are rewritten to this standard before any of the other 81 is
    touched, and the ratchets carry the rest. § 15.

Decision 5 is the one the owner judges, because the brief is what he was reading
when he called the documentation jarring. Decision 6 is the one that changes the
most pages for the least argument, because the mechanism already exists and 42
pages already use it. Decision 7 is the one most likely to be disputed, because
it deletes a number without putting a number back. Decision 3 is the cheapest
large win: one page per section, and `tools/repo-checks/src/doc-floor.test.ts`
has been asking for it since it was written.

## 1. The three stages

The old standard split a section's pages by what the reader arrives with:
someone learning, in sequence, against someone who already has the thing in mind.
That split is true and it is not enough, because it says nothing about what the
first page a reader ever opens should contain. The meta-prompt's split is
narrower and more useful, and it subsumes the old one.

Three stages, and a reader walks them in this order:

| Stage | Page                  | The reader arrives                        | The page's job         |
| ----- | --------------------- | ----------------------------------------- | ---------------------- |
| 1     | `index.mdx`           | knowing nothing, deciding whether to care | build the mental model |
| 2     | `getting-started.mdx` | having decided, wanting it running        | a first working result |
| 3     | a deep-dive           | running, with a task                      | teach one piece        |

Everything outside those three stages is entered sideways, by a reader who
arrived from a search result or an error message and may have read nothing else.
That is the old standard's reference-page arrival test and it still holds: an
API reference, a caveat list, a security contract and a decision record assume
nothing, because their reader assumed nothing.

The stages are cumulative and support fades. A Setup article may use what the
Overview established. A deep-dive may use what both established, and carries a
short reminder of what the page before it introduced, a shorter one after that,
and none thereafter. This is Carroll's fading and it is carried forward from the
old standard's § 2 unchanged; the old standard argues it at length and this
document does not repeat the argument.

What the stages change is the link rule, and the change is worth stating. On a
stage page a link out costs the reader the thread they are holding, so the page
carries what it needs and links only at its end. On a page entered sideways the
link is the point, and re-teaching a concept inline is the error. Both halves are
the old standard's and both survive.

## 2. Stage 1: the Overview

`index.mdx`. What it carries, in this order:

1. **The hook.** The first sentence names the problem the package solves, in the
   reader's terms rather than the library's. `docs/specs/2026-09-20-public-documentation-guidance.md`
   decision 21 already binds this: the first sentence names its subject and
   states what the subject does.
2. **The mental model.** How the package thinks. One diagram is the right shape
   for this where the model is spatial or temporal, under
   `docs/specs/2026-09-16-diagrams.md`.
3. **The vocabulary.** The internal terms a reader meets on every later page,
   each entering as the grammatical subject of its own defining sentence, under
   the public-guidance spec's decision 13.
4. **The capability map.** What the package can do, as a list or a table. Not as
   worked examples.
5. **The boundary.** What the package does not do. `acl/index.mdx` already does
   this well and the rewrite keeps it.
6. **The call to action.** A link into the Setup article, as the last thing on
   the page. The meta-prompt fixes the sentence: "Now that you understand how
   [Tool] works, let's get it set up." The sentence is not copied literally,
   because `docs/specs/2026-09-20-public-documentation-guidance.md` decision 1
   puts a sentence about what the reader does in the second person or the
   imperative and this repository carries no first-person plural outside a
   tutorial. What is kept is its two halves: the Overview's last section names
   what the reader now understands and links to the page that installs it.

What it does not carry: an install command, a configuration block, an API
detail, a version number. Those belong in the section, one stage down.

**The Overview and executable code, which is where the meta-prompt and this
repository meet head on.** The meta-prompt forbids copy-pasteable code blocks on
an Overview. This repository's decision 9 forbids a TypeScript fence that is not
an executed region. Read literally, together, they forbid an Overview from
showing any TypeScript at all.

The resolution: the prohibition binds on install and configuration, not on code.
An Overview's fence shows the shape of an answer, and a reader reads it rather
than running it. It is still an executed region, because a fence nobody ran is a
fence that will be wrong, and the meta-prompt's concern is that a reader tries to
follow an Overview as instructions before they have installed anything. A region
fence answers that concern better than a hand-written one does: it is short, it
is one call, and the reader has nothing to paste it into yet.

So an Overview carries at most one executed region, showing one call and what it
returns. `acl/index.mdx` already carries exactly that, the `quick-start` region,
and it is the best thing on the page. Deleting it to satisfy the meta-prompt
literally would make the page more abstract, which is the complaint.

## 3. Stage 2: the Setup article

`getting-started.mdx`, and the filename is not a choice. `tools/repo-checks/src/doc-floor.test.ts`
already requires it of every documented section and already records the three
sections that lack one. Naming the new page anything else would leave that
allowance entry standing and open a second mechanism for the same role.

What it carries, in this order:

1. **Prerequisites.** Runtime version, module format, peer dependencies, and
   anything that has to exist before the install. A list, not prose.
2. **The install command.** A shell fence, and the package managers the site
   supports. `apps/docs/content/react-widget/getting-started.mdx` is the model:
   three sibling `bash` fences under one `## Install`, then one line of prose
   naming the peer dependency, the Node version and the module format.
3. **The minimum configuration that runs.** Only the parameters the package
   needs to answer at all. An optional parameter is marked optional or is left
   for a deep-dive.
4. **The success moment.** One result the reader sees. § 6.
5. **The call to action.** A link into one named deep-dive, as the last thing on
   the page. One, not a list of seven. The meta-prompt's sentence is "Now that
   you have [Tool] running, let's learn how to perform your first [Core Task]",
   and the part that matters is that the page names the next task rather than
   handing the reader a menu. A reader who has just succeeded at one thing wants
   the second thing, not a choice.

What it does not carry: a second worked case, an advanced option, a performance
note, a comparison with another library. Each of those is a deep-dive. An
optional flag is marked "(Optional)" or it waits for the deep-dive that needs
it.

The Setup article is the one page on a section where brevity is the requirement
rather than a preference. A reader on this page has decided to try the package
and has not yet succeeded at anything, which is the only point in the journey
where they have spent effort and received nothing. React Router's installation
page carries 72 prose words. Next.js's carries 862. Neither carries an argument
for the library, because the reader already made that decision one page up.

## 4. Stage 3: the feature deep-dive

What it carries:

1. **The problem, at the implementation level.** When and why a developer
   reaches for this feature. One or two sentences, and the sentences name a
   mechanism rather than a feeling, under the public-guidance spec's decision 23.
2. **The code for the task.** An executed region, commented.
3. **Why the code is shaped that way.** The choices inside the block that a
   reader would otherwise have to guess at.
4. **The nuances, optionally.** A caveat, a pitfall, an advanced configuration,
   under one heading, and only where there is one.
5. **The success moment**, where the feature admits one. § 6.

Three kinds of deep-dive, from the meta-prompt, and they map onto bands this site
already has:

| Kind                       | Where it lives on this site                         |
| -------------------------- | --------------------------------------------------- |
| Core operations            | the Questions band: the task a reader arrived to do |
| Configuration and scaling  | the Setup band's later tiers                        |
| Integrations and ecosystem | the Platforms band: one guide per adapter           |

A staged sequence inside the Setup band is built only where a reader's prior
knowledge does not transfer, which is the old standard's decision 4 and is
carried forward. `acl` earns its three tiers because whether a condition reads
the object changes the meaning of the rest of the API and no library a reader has
used draws that line. A package whose API resembles things a reader knows gets no
tiers, and its Setup article is the whole of stage 2.

## 5. What replaces the four-part brief

Nothing fixed. That is the decision, and the reason is the complaint: the brief's
defect is not which four parts it has, it is that it is the same four parts on
thirty pages, so by the third page a reader skips the block and by the thirtieth
the block is furniture. A four-part rubric replaced by a three-part rubric fails
the same way one page later.

What each stage owes instead, one sentence each, and the sentences differ because
the stages differ:

- **An Overview** owes a first sentence that names the problem the package
  solves. Not what the package is. The problem.
- **A Setup article** owes a first sentence that says what the reader will have
  working by the end of the page.
- **A feature deep-dive** owes a first sentence that names the task and the call
  that performs it.
- **A page entered sideways** owes a first sentence that names its subject and
  states a fact about it, which is the public-guidance spec's decision 21 and
  needs nothing added here.

Four sentences, four different jobs, and no page carries a labelled block. The
public-guidance spec's decision 22 does the enforcement a rubric was doing
badly: a sentence carrying no symbol, no number and no named behaviour is cut
unless it is the one sentence of motivation a section gets. The brief's
`Why you want it` part is exactly the sentence that rule deletes, and the density
study measured it at a median of 43 words on 17 pages.

What is lost. The brief guaranteed that every page said what the feature was for
somewhere in its first hundred words. Deleting it means an author can open a page
on a mechanism with no statement of why anybody would want it. The answer is that
the case for the package belongs on the Overview, once, which is the density
study's decision 4 and this document adopts it. A deep-dive whose reader needs
convincing has a reader who skipped two stages.

### The meta-prompt's three style rules already have owners

Recorded here so that none of them reads as dropped, and so that this document
does not restate a rule another document owns.

- **Action-oriented, imperative verbs.**
  `docs/specs/2026-09-20-public-documentation-guidance.md` decisions 1 and 4: a
  sentence about what the reader does takes the second person or the imperative,
  and a step takes the imperative.
- **Conciseness, one sentence rather than three.** The same document's decision
  22: a sentence carrying no symbol, no number and no named behaviour is cut.
- **Consistency of terminology and variable names across articles.** The same
  document's decision 14, one name per concept and one concept per name, and
  § 11 of this document, which fixes the nouns every example draws from.

## 6. The success moment

The rule binds to what the reader does on the page. The owner's own sentence is
the clearest statement of it and the prose here follows his framing rather than
Diátaxis's action-and-cognition axis, which says the same thing in more words and
with a framework attached:

> if it's a article that walks the user through an integration, implementing a
> advanced topic, etc. something that has the user build SOMETHING, I think we
> should strive for giving the user a feeling success moment. A API reference, or
> an article explaining security pitfalls, doesn't really fit with a success
> moment

So: a page whose reader builds something owes them the moment it works. A page
whose reader reads to understand, or arrives to look one thing up, owes nothing
of the kind.

### What counts as one

A reader sees a result. A page that shows a call and then says in prose what it
returns has not given one; a page that shows a call and the value it produced
has.

The strongest form on this site is already built.
`tools/doc-examples/src/expect-comments.ts` rewrites

```
decision.allowed; // -> true
```

inside a fence marked `@import.meta.vitest` into
`expect(decision.allowed).toEqual(true)`, and Vitest runs it in the package's own
test suite. The page renders the readable form and CI holds the value. A success
moment written that way is a result the reader sees and the build proves, and a
writer reaching for one reaches for this.

Three things constrain where it can be written, and they are worth knowing before
planning a page:

- The claim only works inside a package README fence carrying
  `@import.meta.vitest`, or inside a JSDoc `@example` fence carrying the same
  marker. A `// #region` in a `.ts` or `.tsx` source cannot carry one:
  `rewriteJsDoc` only looks inside block comments, so a claim in a file's body is
  inert. Nobody has tried it; a grep of every `.ts`, `.tsx` and `.astro` file the
  site references by region finds zero `// ->` lines.
- The package has to wire `docExamples()` in its `vite.config.ts`. Seven do:
  `acl`, `astro-widget`, `feature`, `luhn`, `token`, `urn`, `widget`. Four do
  not: `compose`, `nestjs-correlation-id`, `react-acl`, `react-widget`. For those
  four, wiring is prerequisite work and not page work.
- A page whose example is a demo-app source rather than a README region gets no
  claim, which is why `acl/nestjs.mdx` and `acl/astro.mdx` are the two acl pages
  in the owing set with no success moment today.

**A rendered result counts, and a screenshot does not.** A page about a component
or a screen has a result that is not a value, and a control the reader operates
is a result they see. `AccessDemo`, `FieldWriteDemo` and `UnevaluableDemo` are
each one. A static image of a working thing is a description of a result, so it
does not count, and the old standard's decision 13 already refuses an image
anyway.

### Which pages owe one

Two roles carry the obligation and both are already decidable from data the
repository keeps:

- **`getting-started.mdx`**, the Setup article. Its whole job is a first working
  result.
- **The page `navigation.ts` names in its `demo` field.** That field exists to
  say which page is the section's demonstration, and `doc-floor.test.ts` and
  `doc-control.test.ts` both already read it.

Beyond those two, the obligation follows the band, and for `acl` it lands exactly
where the owner put it. Under the Setup, Platforms and Questions separators a
reader builds something and the page owes a result. Under the Reference separator
a reader reads to understand or looks something up, and the page owes nothing.
Checked against the owner's own list of nineteen acl pages, band membership agrees
on eighteen.

The two disagreements are worth recording rather than smoothing over:

- **`authoring`** sits in the Reference band and a reader writing a typed policy
  is building something. The band exempts it and the page carries a success
  moment anyway, through the `typed-authoring` and `rule-ids` regions. Nothing is
  lost, and moving it out of Reference is a nav question for another document.
- **`errors`** sits in the Questions band and is a catalogue of what each
  construction fault raises. A reader arrives to look one up. The band obliges it
  and the page satisfies the obligation anyway, through seven `errors-*` regions,
  so the disagreement costs nothing today. If it ever did, the escape in the next
  subsection is what it takes.

**`explorer`, which the owner flagged.** The band exempts it and the page carries
the strongest success moment on the site. A reader operates `/matrix-explorer`
with a document they brought and sees a report on their own rules. The
obligation should not bind it, and the reason is not that the page lacks a
result: the result comes from the reader's input rather than from an example the
page authored, so there is nothing for a guard to look at and nothing for a
writer to get wrong. A page better than the rule requires is not a case the rule
has to cover.

### Whether it is checked, and how hard

Checked, and it fails the build, on the two decidable roles only. That is
`tools/repo-checks/src/doc-success-moment.test.ts`, new in § 14.

The measurement is what settles the shape. Across 84 pages, 42 render at least
one region carrying an observed value. Restricted to the two obliged roles across
12 documented sections, four sections fail: `compose`,
`nestjs-correlation-id`, `react-acl` and `react-widget`. All four fail for the
same reason, that the package does not wire `docExamples()`, so the allowance is
four entries each naming that prerequisite. Four is a migration list somebody can
work down. Twenty-six, which is what obliging every non-reference page would
open, would mean the rule was wrong.

The band extension is specified here and not written. It needs a closed band-key
vocabulary across the site, and today only `acl/_meta.ts` carries separators at
all, with keys `group-setup`, `group-platforms`, `group-questions` and
`group-reference`. Writing a guard against keys that exist in one section of
twelve would be a rule derived from a sample of one. Until a second section earns
bands, the band half of this rule is a reviewer's, and
`.claude/agents/docs-reviewer.md` carries it.

The escape is `successExempt` on the `navigation.ts` entry, a string carrying the
reason, on the same pattern as `demoExempt` and `domainExempt`. A section may not
be both exempt and allowed, which is the three-way conflict test
`doc-control.test.ts`, `doc-domain.test.ts` and `doc-export-coverage.test.ts`
each already carry. No section takes the exemption today, which is deliberate:
an exemption written for no case is a rule nobody can check, and
`docs/specs/2026-09-21-reference-page-budget.md` § 6 makes the same argument
about `register.mdx`.

## 7. Shape, and the density study's decisions

The old standard's decision 9 put 1,200 prose words on every page.
`docs/specs/2026-09-21-reference-page-budget.md` refuted it for a reference page:
a reference page's length is the export count, `acl/api.mdx` is 1,637 words
across 107 entries, and 15 words an entry is a signature and a sentence. The
density study's decision 10 refutes it for every other page from the other
direction: the committed counter charges a table cell and a heading to prose, so
a page that moves facts out of paragraphs and into a table scores no better under
it, and that is the exact rewrite this standard asks for.

So the budget goes, and no number replaces it. What replaces it is shape, and the
shape rules come from the density study. Each of its decisions 2 to 10 is
adopted, amended or declined here, with the reason.

**Adopted as written.**

- **Decision 3, the lede is at most 40 words.** Prose before the first `##`.
  Our median is 199 and `acl/index.mdx` spends 397 of its 676 prose words there.
  This is the single rule that most directly answers "too jarring", because the
  lede is the whole of what a reader reads before anything is on screen.
- **Decision 4, `Why you want it` is deleted as a page part.** § 5 already
  deletes the whole brief, and this is why the case for the package lives on the
  Overview once.
- **Decision 5, no prose run exceeds 8 sentences.** A run is consecutive
  sentences with no code, list, table or heading between them. Our median is
  12.5 and `nestjs.mdx` runs 17. The break is usually a table.
- **Decision 6, the first code fence arrives within 8 sentences**, and a Mermaid
  diagram does not count as the first fence. Ours is 15 and `refusals.mdx` is 40.
  The diagram exclusion is right for the reason `apps/docs/AGENTS.md` already
  gives: a diagram is not verified and is invisible to search.
- **Decision 7, the first backticked symbol arrives within 25 prose words.**
  Eleven of thirteen public pages do it in 13 or fewer; `security.mdx` takes 276.
- **Decision 8, a repeated member surface goes in a table or in one `###` per
  member, never in paragraphs.** A member whose explanation fits one sentence
  takes a table row; a member needing a code example takes its own `###`.
- **Decision 9, an `##` carries at most 250 prose words and an `###` at most 140.** Our `###` sections run to 1,209 words, against a public range of 36 to 136.

**Amended.**

- **Decision 2, a guide or concept page carries at most 1,050 prose words.**
  Declined as a number and adopted as a diagnostic. The reason is the same one
  the reference-page-budget spec gives: a page over a word count is sometimes two
  reader questions sharing a URL and sometimes a wide subject, and the count
  cannot tell an author which. Decisions 3, 5, 6 and 9 above measure the shape
  that actually made our pages long, and a page passing all four at 1,300 words
  is a better page than one failing them at 1,000. No guard carries a page-level
  word budget after this document.
- **Decision 10, the counter is committed and the ratchet re-baselined.** Amended
  to: the counter is not committed, and the ratchet is deleted along with the
  guard that read it. The density study asked for
  `tools/repo-checks/src/doc-density.ts` so that decision 10 could be checked.
  With decision 2 declined as a number there is nothing left for a page-level
  counter to check, and the shape rules that survive are separate checks over
  separate quantities. § 14 records which of them a guard could reach and why
  none is written yet.

**Declined.**

- **Decision 1, a reference page carries at most 500 prose words.** Already
  refuted by `docs/specs/2026-09-21-reference-page-budget.md`, whose measurement
  is the one to reread before proposing it again.

### What `<PageSheet difficulty>` is rated against

`apps/docs/components/PageSheet.tsx` renders a 1-to-5 bar, and a number is worth
nothing until the reader it describes is named. The reader is one who has the
section's Overview and its `getting-started.mdx` behind them, and no other page in
the section. Call that the section floor. `requires` then names what the page needs
above the floor, which is why both fields sit on the card without saying the same
thing twice.

Two other readings were measured on `acl` and both fail.

Rating the page against its own `requires`, so that the number is what the page
costs a reader who walked the ladder, cannot be checked from outside: only somebody
who read the prerequisites can dispute it, and the reader who arrives from a search
result is the one the number would most have helped. `acl/asking.mdx` carried 2 on
that reading and a cold reader put it at 4.

Rating the page against nothing, so that the number is what the page costs a reader
holding no page at all, collapses the scale. Seven acl pages were read that way on
2026-09-25, one reader per page, each having seen no other page, and six came back
4: `getting-started` 3, `subject-rules` 4, `object-rules` 4, `asking` 4, `ui-checks`
4, `limits` 4, `decision-object` 4. Every reader lost the same words, and they are
the Overview's words: subject, object, matrix, and what `can` returns. So that
number reports whether the reader skipped the Overview, which is the same answer on
every page, and a bar reading 4 everywhere tells a reader nothing.

The floor beats both because it is small, it is named, a reader acquires it in two
pages, and a reviewer can check a rating by reading those two pages and then the
page under review. The cost is that the number says nothing to a reader who has not
read the Overview, and § 5's first sentence per stage plus the `requires` list are
what serve that reader instead.

Carried forward from the old standard's § 4 unchanged, because three guards read
it: the section floor is four roles, `index`, `getting-started`, `api` and the
page `navigation.ts`'s `demo` field names; a section of five pages or fewer may
put the demonstration role on `getting-started`; there is no maximum page count
and no maximum number of bands; and a band is a separator with at least two pages
under it. The old standard argues each of those and this document does not
repeat the argument.

## 8. Headings

An API reference page carries one heading per exported symbol, spelled as the
symbol, in backticks. This is the old standard's decision 8, carried forward
unchanged because `doc-exports.test.ts` reads the heading to find the symbol a
`signature` fence documents and `doc-export-coverage.test.ts` reads it in the
other direction. `acl/api.mdx` carries 107 such headings.

A question page takes the opposite rule: the heading is the question a reader
types, and the method name is in the first line of the answer.
`apps/docs/content/acl/_meta.ts` already states this.

Every page carries exactly one `# ` heading, and it is not the package name
unless the page is the Overview. No guard reaches this; § 14 lists it as a
reviewer's.

## 9. The runnable requirement

Carried forward from the old standard's § 5 in full. Restated here only as far as
a reader needs to apply it, because the old standard's § 5 argues it and this
document does not repeat the argument.

Every fence in `apps/docs/content/` is one of three things: a `file=… region=…`
reference to a doctested region, a shell command, or a fence carrying an
exemption tag from the closed list. There is no fourth case, and that includes an
API reference page.

The five tags, unchanged: `signature`, `no-run`, `anti-example`,
`fails-type-check`, `elided`. `mermaid` and `twoslash` are also explained fences.
`doc-fence.test.ts` holds the list and counts `anti-example` plus `no-run`
against the section's executed regions, so the two tags a writer reaches for
instead of wiring doctest cannot outnumber the real examples.

A teaching page has two layers and they do different jobs. Prose, diagrams and
code blocks teach the concept and stand complete on their own. An interactive
control makes it practical. The control is additive and never substitutive, so a
page whose prose says only "try changing the value" has failed at teaching, for
every reader including the ones using the control. That is the old standard's
decision 12 and it is the rule this document leans on hardest in § 6, because a
success moment is not a control: a page can give a reader a result with no
control at all, and a control with no explained result is the failure the rule
names.

Where a control is not achievable the page says so, and the five named cases are
the old standard's: a trust boundary, a build-time transform, a compile step with
no browser runtime, a cross-process concern, and an argument.

## 10. What survives being taken apart

Carried forward from the old standard's § 5a unchanged.

Self-containment is a property of an H2 section rather than of a page, because a
retrieval system takes a chunk whose boundaries the writer never chose. Three
rules, each a reading a reviewer applies once: no pronoun whose referent is in an
earlier section; a heading naming the package as well as the operation; and every
fact beside the sentence that uses it.

The agent surface is a `.md` sibling per page, generated after region inlining so
its fences are not empty. `llms.txt` is not published, and the old standard's
§ 5a carries the traffic measurement that decided it.
`tools/repo-checks/src/doc-md-siblings.test.ts` asserts that no fence naming a
region reaches a sibling empty.

## 11. One domain

Carried forward from the old standard's § 6 unchanged. Every example in
`apps/docs/content/` and every region a page renders is set in Baize, the board
game shop `apps/storefront` already runs. The vocabulary is the old standard's
table: a game as `urn:game:<slug>` from the catalogue's seven, a listing, a
question under a listing, the three roles `customer`, `bookseller` and `owner`,
an order as `order-2026-0042`, a pickup code as `ORD-a4kp-9mxa`, the three
services `storefront` → `orders` → `stock`, and a flag named for what the shop is
rolling out.

`compose` carries the only recorded `domainExempt`.
`tools/repo-checks/src/doc-domain.test.ts` counts the five abandoned nouns per
section over fenced blocks, and its allowance is empty, so the old domain is
gone from every fence the site renders.

## 12. Ordering

Carried forward from the old standard's § 8 unchanged. Separators rather than
folders at every level. Every section directory has a `_meta.ts` naming every
page in it, in reading order, and under § 1 that order is a claim about what a
reader has already met rather than a convenience.

`docs-navigation.test.ts` holds both directions: every `_meta` key resolves to a
page and every page is a `_meta` key.

## 13. What "done" means for a page

The list an author is handed. Items marked **review** fail a reviewer rather
than the build, and § 14 is where that split is set out per guard.

1. It is listed in its section's `_meta.ts`, in reading order, with an editorial
   title.
2. It has exactly one `# ` heading, and it is not the package name unless the
   page is the Overview. **review**
3. It is one of the three stages or is entered sideways, and it carries what that
   stage owes and nothing another stage owes. **review**
4. Its first sentence does the job § 5 gives its stage. **review**
5. If the reader builds something on it, it carries a success moment. § 6.
6. Its lede, meaning prose before the first `##`, is at most 40 words. **review**
7. No prose run in it exceeds 8 sentences, its first code fence arrives within 8
   sentences, and its first backticked symbol arrives within 25 prose words.
   **review**
8. Every `##` in it carries at most 250 prose words and every `###` at most 140.
   **review**
9. A repeated member surface in it is a table or one `###` per member, never
   paragraphs. **review**
10. If it teaches, it uses no symbol, option or concept a later stage page
    introduces, and it reminds the reader of each concept the page before it
    introduced at less length than that page used. **review**
11. Its teaching layer is complete with every control removed. **review**
12. Every H2 section in it stands alone when cut out. **review**
13. Every diagram in it is a `mermaid` fence carrying a `caption`, sits inside
    the block that refers to it, and says nothing the prose does not.
14. Every example in it is set in the shop, or the section carries a recorded
    `domainExempt`.
15. Every TypeScript fence in it is a `file=… region=…` reference or carries an
    exemption tag.
16. Every region it references exists and executes in the package's test run, and
    its `.md` sibling carries the region's code rather than an empty fence.
17. If it is an API reference, it carries one `##` per exported symbol, spelled as
    the symbol.
18. Every `@evanion/…` specifier it imports in a fence resolves, and every name
    it binds resolves to an export.
19. Every internal link it makes resolves to a page that exists.
20. It carries no labelled four-part brief, and no fixed rubric block of any
    kind. **review**

The old standard's item 12, "under 1,200 words of prose", is deleted. § 7 is the
reason.

## 14. The guards

`tools/repo-checks/src` holds one file per guard, globbed by
`tools/repo-checks/vitest.config.ts`, so a new guard needs no registration. Every
citation below points at a section of this document, and the section it points at
says what the guard's docblock claims it says. A citation off by a section is
worse than none, because a reader trusts it.

### Kept, with the citation repointed

Nine guards. This standard still asserts what each one checks, so the rule does
not move and only the docblock's reference does.

| Guard | File                          | Was                      | Now          |
| ----- | ----------------------------- | ------------------------ | ------------ |
| G1    | `docs-navigation.test.ts`     | § 12                     | § 12         |
| G3    | `doc-fence.test.ts`           | § 12                     | § 9 and § 14 |
| G4    | `doc-control.test.ts`         | § 12                     | § 9 and § 14 |
| G5    | `doc-exports.test.ts`         | § 12                     | § 8 and § 14 |
| G6    | `doc-specimen.test.ts`        | § 12                     | § 14         |
| G7    | `doc-links.test.ts`           | § 12                     | § 14         |
| G9    | `doc-domain.test.ts`          | § 12                     | § 11         |
| G10   | `doc-export-coverage.test.ts` | decision 8, unnamed file | § 8 and § 14 |
| —     | `doc-md-siblings.test.ts`     | § 5a                     | § 10         |
| —     | `regions.test.ts`             | decision 17              | § 9          |

`doc-regions.test.ts` cites nothing, and repointing the others found a bug in it
rather than a citation. Its scan was
`/```\S*\s+file=(\S+)\s+region=([\w-]+)/g`, which requires `file=` immediately
after the language and therefore matched no fence carrying `twoslash` between
them. That is how most of `apps/docs/content/acl` writes a reference, so the
guard whose whole job is catching a renamed region in `nx test` was skipping the
majority of the site and leaving it to `next build`. The loader never had the
bug; its own `/(?:^|\s)file=(\S+)\s+region=([\w-]+)/` reads the keys wherever
they sit, which is why the file's own fixtures passed while the scan above them
saw nothing. The scan now matches the keys anywhere in the info string, and two
assertions hold it: one on a `twoslash` fence, and a floor on the number of
references found across the site, because a scan that matches nothing passes
every assertion under it. No region was actually broken.

G10's docblock named
"decision 8 of the documentation standard" with no filename, which is the one
citation in the set a rename would not have broken and also the one a reader
could not follow; it gets a path.

Three docblocks name `doc-prose-budget.json` as the example of the ratchet
idiom: `doc-floor.test.ts`, `doc-control.test.ts` and `doc-fence.test.ts`. That
file is deleted below, so each points at `doc-fence-allowance.json` instead,
which is the numeric ratchet with both directions written.

### Updated

**G2, `doc-floor.test.ts`.** The rule is unchanged and the standard behind it
changed, so the docblock changes and one allowance entry goes. The guard requires
`index.mdx`, `getting-started.mdx`, `api.mdx` and the `demo` page of every
documented section. Under the old standard `getting-started` was a tutorial page
whose justification was one row of a table. Under § 3 it is stage 2 of the
journey and the page the owner's complaint is about, so the docblock now says
what the page is for rather than only that it must exist.

`doc-floor-allowance.json` holds three entries today: `acl`, `luhn` and `token`,
each short of `getting-started`. The pilot writes `acl/getting-started.mdx`, so
the `acl` entry is removed and the ratchet goes from three entries to two. That
is the shape every ratchet in this document takes: a page conforming comes off,
a page still on the old shape stays on until somebody rewrites it.

### Retired

**G8, the prose budget.** `doc-prose-budget.ts`, `doc-prose-budget.test.ts` and
`doc-prose-budget.json` are deleted. Four things agree:

- It fails nothing today. Both its assertions are
  `expect(counts.size).toBeGreaterThan(0)` and an over-budget page goes through
  `console.warn`. It is the only guard in the directory that warns rather than
  failing.
- The old standard's own § 12 calls it "the least valuable of the nine" and says
  over-length is a symptom the guard cannot localise.
- `docs/specs/2026-09-21-reference-page-budget.md` refuted the per-page budget
  for a reference page, and its § 7 already removed the file's only entry in
  principle. The entry is still there and is still stale: it records
  `acl/api.mdx` at 1,547 against a measured 1,637.
- The density study's decision 10 established that the counter cannot see the
  rewrite this standard asks for. `proseWords` charges a table cell and a heading
  to prose, so moving a member surface out of paragraphs into a table under § 7's
  decision 8 scores no better, and on `resolution.mdx` it scores 1,404 where a
  block-aware counter scores 1,020.

`proseWords` and `proseCounts` have no caller outside their own test, so nothing
else breaks. The retirement is recorded here so that nobody re-adds the guard
from the old standard, and the thing to reread before proposing a word budget
again is `docs/specs/2026-09-21-reference-page-budget.md` § 2, which is where the
argument for one was measured and failed.

### New

**G11, `doc-success-moment.test.ts`.** § 6's rule, on the two decidable roles.
For every `documented: true` section, `getting-started.mdx` and the page the
`demo` field names each render at least one `file=… region=…` fence whose region
carries a `// -> value` claim. The claim test is the repository's own:
`indexOfLineComment` from `tools/doc-examples/src/expect-comments.ts`, so the
guard and CI answer "is this a claim" with the same code.

The escape is `successExempt` on the `navigation.ts` entry, a non-empty string.
The allowance is `doc-success-moment-allowance.json`, keyed by section, holding
the roles that do not satisfy it yet, on `doc-floor-allowance.json`'s list-valued
shape. It starts at four sections and five roles: `compose`,
`nestjs-correlation-id` and `react-acl` on `getting-started`, and `react-widget`
on `getting-started` and `playground`. For the first three, `getting-started` is
also the page the `demo` field names, so one page carries both roles. All four
fail for one reason: the package does not wire `docExamples()` in its
`vite.config.ts`, so no region of it can carry a claim. Both ratchet directions
are written, and a section may not be both exempt and allowed.

**G12, `doc-stage.test.ts`.** § 2's and § 3's boundary, which is the part of the
meta-prompt that is mechanical. Two assertions:

- No `index.mdx` under `apps/docs/content/` carries an install command. The test
  is a shell fence containing `npm install`, `npm i`, `yarn add`, `pnpm add` or
  `bun add`. This is the rule that stops an Overview becoming a Setup page, which
  is what happened to `acl/simple.mdx` from the other direction.
- Every `getting-started.mdx` carries one. A Setup article without an install
  command is not stage 2.

Both are greps over filenames that already carry a role, so nothing new is
declared.

An earlier draft of this section said the guard would pass on landing with no
allowance. That was asserted and not measured, and measuring refuted it. G12
fails on seven roles across five sections:

| Section                 | Violation                                                      |
| ----------------------- | -------------------------------------------------------------- |
| `astro-widget`          | install command on the Overview, and none on the Setup article |
| `luhn`                  | install command on the Overview                                |
| `nestjs-correlation-id` | install command on the Overview, and none on the Setup article |
| `token`                 | install command on the Overview                                |
| `urn`                   | install command on the Overview                                |

So `doc-stage-allowance.json` starts at five section entries and seven roles, on
`doc-floor-allowance.json`'s list-valued shape. That number is more useful than
the zero the draft claimed: five sections put their install command on the page
the meta-prompt reserves for the mental model, which is the same defect `acl` had
in reverse, and nobody had counted it.

`WorkshopNotice` renders `npm install <package>` itself, from
`navigation.ts`, on every page of an unpublished package. The guard reads the
`.mdx` source and does not see that, which is correct: the notice is page
furniture about the repository rather than an instruction the page gives, and a
guard that failed every Overview of every unpublished package would be measuring
the component. The duplicate rendering on `simple.mdx` is a page defect and the
pilot fixes it by moving the install to stage 2.

### What no guard reaches

Longer than the old standard's list, because § 7's shape rules are readings and
§ 5's replacement for the brief is a judgement about a sentence.

- **The lede length, the run length, the distance to the first fence and the
  distance to the first symbol.** Each is a count and each could be guarded. None
  is, because the block classifier they all need is the counter the density study
  asked for and § 7 declined to commit. Writing the classifier is the one piece
  of machinery that would move four rules from this list to the one above, and it
  is a guard to write rather than a rule to decide.
- **Whether a page's first sentence does its stage's job.** § 5's four sentences
  are four different jobs and no count separates them.
- **Whether a page carries a rubric block.** `**The concept.**` is greppable and
  the next rubric is not, so a guard on the string would catch the brief this
  document deletes and nothing else.
- **Whether a success moment on a page outside the two obliged roles is present
  or needed.** The band extension in § 6, pending a band vocabulary.
- **The teaching order and its fading**, **whether the teaching layer stands
  alone**, **whether an H2 section survives being cut out**, **whether a diagram
  is still true**, **whether an example is set in the shop**, and **a page's
  single `# ` heading**. All six carried from the old standard's list unchanged,
  with its reasons.

`.claude/agents/docs-reviewer.md` is where this list is enforced. Its brief
carries every item above, and the one thing it must stop looking for is the prose
budget, which no longer exists.

### The reader, which is not a guard and is the only instrument that measures the complaint

One thing on the list above cannot be reviewed at all, by a guard or by a
reviewer, and it is the thing the owner actually complained about. Both a guard
and a reviewer check a page while already knowing the material, so neither can
tell you where a reader who has never seen the library stopped following.

`.claude/agents/docs-cold-reader.md` is that instrument, borrowed from the reader-
testing stage of Anthropic's `doc-coauthoring` skill. It reads a sequence of pages
in the order a reader meets them, with no spec, no source, no `_meta.ts` and no
guard, and reports where it lost the thread, every term used before it was
defined, what it believed the library was for after the first screen, whether it
could do what the page asked, whether the reading felt jarring, and whether the
step from the previous page was too large. Its value is entirely its ignorance,
so its own file says so, because the next person to edit it will want to be
helpful and hand it the spec.

What was taken from that skill and what was left. Its reader-testing stage is
here. Its iterative-refinement loop is in `.claude/skills/docs-page/SKILL.md` as
the order to work in on one page, because this repository writes a page against
84 siblings under guards rather than co-authoring one document in a conversation.
Its context-gathering stage with clarifying questions is left out: the context
here is the source, the package README's regions and these specs, and a page's
author can read all three without asking anybody.

It is not a measurement and the agent's own brief says so. It is one reader's
account, which is what the owner asked for.

## 15. Order

1. **This document, the supersession header on the old one, and the citations.**
   Eleven files under `tools/repo-checks/src`, plus `apps/docs/AGENTS.md`,
   `.claude/skills/docs-page/SKILL.md`, `.claude/agents/docs-reviewer.md`,
   `apps/docs/mdx-components.js` and `apps/docs/tools/mdx-listing-loader.mjs`.
   Independent of any content change.
2. **G8 retired, G11 and G12 written.** G11 lands with its four-entry allowance
   and G12 lands green.
3. **The three-page pilot on `acl`:** the Overview rewritten to § 2,
   `getting-started.mdx` written to § 3, and `asking.mdx` rewritten to § 4. Read
   cold by `.claude/agents/docs-cold-reader.md` before it goes out, and its report
   travels with the change rather than being summarised. This is what the owner
   judges, and steps 4 onwards do not start until he has.
4. **The rest of `acl`'s Setup band**, because `simple`, `intermediate` and
   `advanced` each open on the brief and each now has a Setup article above them
   to lean on.
5. **The 27 remaining pages carrying the brief**, section by section, each
   section's Overview and Setup article first. This is also the step that retires
   G12's allowance: five Overviews move their install command down to their Setup
   article, and `astro-widget` and `nestjs-correlation-id` gain one.
6. **`docExamples()` wired in `compose`, `nestjs-correlation-id`, `react-acl` and
   `react-widget`**, which is what retires G11's four allowance entries.
7. **The block classifier**, if the shape rules in § 7 turn out to be violated
   often enough to be worth a guard. Measured after step 5 and not before, because
   rewriting 30 pages is what tells us whether authors keep the rules without one.

## Testing

- G11 fails on a fixture section whose `getting-started` renders a region with no
  claim, passes when the region carries one, passes on a section carrying
  `successExempt`, and fails on a section that is both exempt and allowed.
- G11's ratchet fails when an allowance entry names a role that now satisfies the
  rule, which is `doc-floor.test.ts`'s stale-entry test applied to this data.
- G12 fails on a fixture `index.mdx` carrying `npm install` in a shell fence, and
  on a fixture `getting-started.mdx` carrying none. It passes on an `index.mdx`
  that names a package in prose without a shell fence, which is the false
  positive the rule has to avoid.
- G2's allowance no longer names `acl`, and its stale-entry test fails if it
  does.
- Nothing imports `proseWords` or `proseCounts` after G8 is deleted, which
  `typecheck` settles rather than a test.
- Every rewritten page's regions resolve, which `doc-regions.test.ts` already
  asserts, and reach its `.md` sibling non-empty, which
  `doc-md-siblings.test.ts` already asserts.

## What this standard declines

**Diátaxis as an organising framework.** The old standard's § 3 argued it at
length and concluded it is a diagnostic rather than a template. This document
goes one step further and drops the vocabulary from the prose, because § 6's rule
is the owner's sentence about what the reader does on the page and that sentence
is clearer than "action and cognition". The diagnostic survives as a reviewer's
question and nothing in this document names it.

**A word budget of any kind.** § 7. Two specs measured against it and both
refuted it, in opposite directions.

**A replacement rubric for the four-part brief.** § 5. The defect was repetition
and a new rubric repeats.

**A guard on the Overview's prohibition against code.** § 2 resolves the
meta-prompt's constraint as binding on install and configuration rather than on
code, and G12 checks the install half. A guard on "no configuration block" would
need to know what a configuration block is, which is a reading.

**`llms.txt`.** Carried from the old standard, on its traffic measurement.

## The evidence, and what it does not cover

**Measured in this tree during this session.**

- 84 `.mdx` pages under `apps/docs/content`, 12 documented sections in
  `navigation.ts`.
- 30 pages carry `**The concept.**`, which confirms the diagnosis exactly.
- One install command in `apps/docs/content/acl`, at `simple.mdx:54`. Searched
  `npm install`, `npm i `, `pnpm add`, `yarn add` and `bun add`.
- 42 of 84 pages render at least one region carrying a `// -> value` claim, by
  resolving every `file=… region=…` reference through the repository's own
  `parseRegions` and testing each region body with the repository's own
  `indexOfLineComment`. `acl` is 24 of 32. Counting `acl/api.mdx`'s 29
  `<!-- reference … example=… -->` directives makes it 43 of 84 and `acl` 25 of 32.
- All 36 regions in `libs/acl/README.md` carry at least one claim.
- Seven packages wire `docExamples()`; four do not.
- Four sections fail G11 on the two obliged roles: `compose`,
  `nestjs-correlation-id`, `react-acl`, `react-widget`.
- G12 fails on seven roles across five sections, tabled in § 14. Five Overviews
  carry an install command and two Setup articles carry none.
- Only `acl/_meta.ts` carries band separators. Eleven sections have none.
- `proseWords` and `proseCounts` have no caller outside
  `doc-prose-budget.test.ts`.
- A `// -> value` claim in a `.ts` or `.tsx` `// #region` is inert. Confirmed
  from `rewriteJsDoc`'s own control flow and by grepping every source file the
  site references by region: zero `// ->` lines.

**Quoted from another document rather than re-measured.** Every prose-word,
lede, run, first-fence and first-symbol figure in "What is actually wrong" and in
§ 7 is `docs/specs/2026-09-20-documentation-density.md`'s, by its own counter,
against `apps/docs/content/acl` at branch point `docs/prose-rewrite`. The acl
section has been edited since, so those figures describe that branch point and
not this tree. `acl/api.mdx` at 1,637 words across 107 entries is
`docs/specs/2026-09-21-reference-page-budget.md`'s.

**Asserted here and not measured.**

- That deleting the four-part brief loses nothing. The density study checked on
  one page, `refusals.mdx`, and found the page's first `##` restating the brief.
  It did not check the other sixteen. Some brief somewhere probably carries a
  fact that appears nowhere else on its page, and the rewrite will find it one
  page at a time.
- That the three-stage journey is the right split for a package a reader already
  knows the shape of. The meta-prompt is written for a novice, and a reader
  arriving at `@evanion/urn` from an RFC knows what a URN is. The stages still
  order that section correctly and nobody has tested whether stage 1 earns its
  page there.
- That § 5's four sentences hold up across 84 pages. Four sentences written
  against three stages and one arrival mode, and the pilot exercises three of
  them.
- That the band extension of § 6 is worth building. It agreed with the owner on
  eighteen of nineteen acl pages, which is one section.
- Whether the five Overviews carrying an install command should lose it or
  whether the rule should bend. § 14 records the count and § 15 step 5 schedules
  the fix, and nobody has read those five pages to find out whether the install
  fence is the best thing on them. A section of four pages whose Overview is the
  only page a reader opens is a case this standard's three stages may simply not
  fit, and `urn` and `token` are the candidates.

**Where I am guessing.**

- Whether the owner reads the rewritten Overview as less abstract. § 2 removes
  the brief, moves the `WorkshopNotice` below the hook and cuts the lede to under
  40 words, and every one of those is a change to what a reader meets in the
  first screen. Whether the page then reads as concrete is a judgement nobody has
  made yet, and a shape that satisfies this document and still reads as abstract
  has failed.
- Whether `successExempt` will ever be used. It is specified with no case behind
  it, which § 6 admits and which this repository has argued against before.
- Whether retiring G8 loses a signal. It warned and nobody was obliged to read
  the warning, so the honest position is that it lost the signal before this
  document deleted it.
- Whether the block classifier in § 15 step 7 is worth writing. Four rules
  depend on it and all four are readings today. The measurement that would
  decide it is how often a reviewer catches a violation after step 5, and that
  number does not exist.
