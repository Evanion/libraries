# The public style guides, read against ours

Status: proposed
Depends on: `docs/specs/2026-09-16-documentation-standard.md` (the structural
standard, which owns page types, the teaching order, fading, H2
self-containment and the 1,200-word prose budget; nothing here touches any of
those), `docs/specs/2026-09-20-documentation-prose-craft.md` (on branch
`docs/prose-craft`; its fourteen decisions are the subject of section 9, and
this document amends eight, drops one and marks two as unsupported),
`~/.claude/CLAUDE.md` (the ban list, whose em-dash rule section 4 finally has a
citation for and whose gerund rule section 4 leaves where the prose-craft spec
left it), `tools/repo-checks/src/doc-antithesis.test.ts` (the only prose guard
that exists, and the shape every guard proposed in section 10 copies),
`tools/repo-checks/src/doc-prose-budget.ts` (the word counter, which section 10
would extend to paragraphs and clauses), `.claude/agents/docs-reviewer.md` (the
agent that carries the judged rules)
Measured against: nothing in this repository was re-counted for this document.
Every number about `apps/docs/content` quoted below is the prose-craft spec's,
and it is quoted as that document's measurement.
Sources reached, with the page named beside every claim in the body: the Google
developer documentation style guide, twelve pages (Highlights, Second person,
Verb tense, Voice, Notices, Jargon, Writing for a global audience, Voice and
tone, Procedures, Lists, Link text, Sentence structure); Google's technical
writing course, three lessons (Short sentences, Words, Paragraphs); the
Microsoft Writing Style Guide, six pages (Top 10 tips for Microsoft style and
voice, Person, Verbs, Use simple words concise sentences, Writing step-by-step
instructions, Global communications: Writing tips, Scannable content: Lists);
the Microsoft Learn contributor guide, one page (Markdown reference, its Alerts
section); the GitLab documentation style guide, two files read as raw Markdown
from `gitlab-org/gitlab` at `master`
(`doc/development/documentation/styleguide/_index.md` and `word_list.md`); the
18F Content Guide, four files read as raw Markdown from the archived
`18F/content-guide` repository (Active voice, Voice and tone, Punctuation, and
the page index); the Red Hat supplementary style guide overview; Write the
Docs, two pages (Documentation principles, Style guides); the Good Docs Project
template catalogue; digital.gov's plain language guide, two pages (Principles,
Writing).
Not reached, and therefore absent from the argument: the IBM Style guide, whose
index at `ibm.com/docs/en/ibm-style` lists every topic and whose topic pages
answer 401 to this session; the Apple Style Guide, which serves a table of
contents at `support.apple.com/guide/applestyleguide` and no rule text to a
fetch; the Splunk Style Guide, whose host `style.splunk.com` does not resolve
from this session and whose `docs.splunk.com` path answers 403; ISO 24495-1,
whose catalogue page at `iso.org` answers 403, so nothing substantive about the
standard was read and it is cited nowhere below; the live 18F Content Guide
site, whose hosts `content-guide.18f.gov` and `guides.18f.gov` do not resolve,
which is why the 18F text comes from the repository instead.
Quotation: one short quote per guide, in the body, with the page named. Every
other claim about a guide is a summary in my own words with the page named, so
that a reader can open that page and check it.

## What is actually wrong

The prose-craft spec derived fourteen sentence-level rules from two board game
rulebooks, one software style guide and a counter run over seven documents. It
is about to be applied to roughly 30 pages. Four professional guides that
legislate the same subject were never read for it, and three of the fourteen
decisions turn out to contradict what those guides rule.

The sharpest of the three is decision 3, the 25% reader-addressing floor.
Google and Microsoft are both widely believed to mandate second person, and
both do, and neither mandates it as a density. Google's Second person page
splits the sentence population in two and assigns a person to each half: second
person for what the reader does, third person for what the software does. A
reference page that describes `hydratePolicy` is a page of software-behaviour
sentences, and Google's rule puts those in the third person. A floor applied to
that page pushes an author to write `you` into sentences where Google rules it
out. So the floor and the rule it stands in for point different ways on exactly
the pages this site has most of.

The second is decision 11's modal assignment. GitLab's word list legislates
three modal forms against three meanings, and decision 11 reads two of the
three backwards.

The third is decision 7's label set. Four guides publish a closed set of
notice labels. All four sets are ordered by severity. Decision 7's set is
ordered by rhetorical function, and no guide I reached carries a label meaning
either `Exception` or `Remember`.

Against that, the guides agree with this repository's ban list on the one point
where the ban list is most often called eccentric. GitLab forbids the em dash
outright and names the same remedy the ban list names.

## Decisions

Each decision names a test. Where a public guide rules the same thing, the
guide and its page are named; where nothing public rules it, the decision says
so and the rule stays a house rule.

1. What a sentence is about decides its person. A page-level ratio decides
   nothing. A sentence about what the reader does takes the second
   person or the imperative. A sentence about what the package does takes the
   third person with the package as the grammatical subject. Google, Second
   person. Test: for each sentence, name the actor; if the actor is the reader
   and the sentence says `the developer`, `the caller` or `the user`, rewrite
   it; if the actor is `hydratePolicy` and the sentence says `you`, rewrite it.
   Section 1.
2. The 25% floor becomes a diagnostic and stops being a rule. A page below 25%
   is read against decision 1 to find out which side it failed on, and a page
   that passes decision 1 at 12% passes. Section 1.
3. Present tense is the default. `will` is written only where the action it
   describes happens later in time than the sentence around it, and the
   hypothetical `would` is rewritten as a conditional with `if`. Google, Verb
   tense; Microsoft, Verbs. Test: grep the page for `will`, `would` and
   `should be able to`; every hit names a later moment or is rewritten.
   Section 2.
4. Indicative for a statement of fact, imperative for a step, and no
   subjunctive. Microsoft, Verbs. Test: no sentence on a reference page opens
   `We recommend that you be`. Section 2.
5. A condition, a location or a goal goes before the instruction it qualifies,
   inside the same sentence or the sentence before it. Google, Highlights and
   Sentence structure; Microsoft, Writing step-by-step instructions. Test: no
   step ends in a trailing `if …` or `when …` clause that changes whether the
   step runs. Section 3.
6. The modal forms carry GitLab's three meanings. An imperative means the
   reader has to do it. `You should` means this repository recommends it and
   the reader may decline. `You can` means the action is available and nothing
   is lost by skipping it, and it is deleted wherever the sentence still reads
   without it. GitLab, word list, entries `recommend, we recommend` and
   `you can`; Microsoft, Person. Test: every `you should` on the page is a
   recommendation the reader may refuse, and every `you can` still reads as a
   sentence after `you can` is cut. Section 4.
7. The notice set is ordered by severity and closed at four: `Note`,
   `Exception`, `Warning`, `Shop note`. Google, Notices; Microsoft Learn
   contributor guide, Markdown reference; Red Hat supplementary style guide.
   `Remember` is dropped and the structural standard's fading rule keeps that
   work as ordinary prose. Section 5.
8. The budget covers every label and not only `Exception`. Two notices a page,
   never two adjacent, and an H2 section carrying more than one `Exception`
   records in prose that the API is hard to remember. Microsoft Learn
   contributor guide; Google, Notices; GitLab, `_index.md`; Red Hat. Section 5.
9. A paragraph runs three to five sentences and never more than seven, and its
   first sentence carries the concept the paragraph is about. Google technical
   writing course, Paragraphs; Write the Docs, Documentation principles;
   digital.gov, Principles. Test: count the sentences, then read the first
   sentence alone and say what the paragraph is about. Section 6.
10. A list carries between two and seven items, all items share a structure,
    and no list has one item. Microsoft, Scannable content: Lists; Google,
    Lists. Test: count. Section 6.
11. No sentence links more than two clauses with `and`, `or` or `but`.
    Microsoft, Global communications: Writing tips. Test: count the coordinating
    conjunctions between independent clauses. Section 6.
12. An acronym is spelled out on its first use in a page with the acronym in
    parentheses, and the page then uses one of the two forms for the rest of
    its length. Google technical writing course, Words. Test: the first hit for
    the acronym is the expansion. Section 7.
13. A term of art enters as the grammatical subject of its defining sentence,
    or as a link to a definition that already exists on this site. Google,
    Jargon; Google technical writing course, Words. The link form is new; the
    prose-craft spec's decision 5 allowed only the definition. Section 7.
14. One name per concept and one concept per name. Microsoft, Use simple words
    concise sentences; Google technical writing course, Words; Write the Docs,
    Documentation principles. The second half is new. Test: grep the section
    for synonyms, then grep for the name and check every hit means the same
    thing. Section 7.
15. A word list becomes a guard. `simply`, `simple`, `easily`, `easy`,
    `quickly`, `please`, `and/or` and `note that` are refused in
    `apps/docs/content`. GitLab, word list; Google, Voice and tone. Section 8.
16. No humour, no idiom, no holiday, no season and no sport, in a rule
    sentence, in a heading or in an example. Google, Writing for a global
    audience and Voice and tone; Microsoft, Global communications: Writing
    tips; Write the Docs, Style guides. The board game domain keeps its
    vocabulary under this rule and loses its jokes. Section 8.
17. Link text is the target's heading, or a phrase that describes the target
    and reads correctly with the surrounding sentence cut away. `here`, `this
page` and `this document` are refused. Google, Link text. This loosens the
    prose-craft spec's decision 12, which required the heading exactly, and the
    loosening exists for reference headings that are bare symbols. Section 8.
18. The em dash stays banned, and the remedy is a second sentence or a comma.
    The prose-craft spec proposed a colon and no guide reached names one. GitLab, `_index.md`,
    Punctuation. Section 4 reports that Microsoft and 18F both rule the
    opposite way and why this repository follows GitLab.
19. Decision 13 of the prose-craft spec is dropped. No guide reached legislates
    page length against a difficulty label, and the prose-craft spec's own
    ledger calls it the weakest evidence in that document. Section 9.
20. Decisions 10 and 14 of the prose-craft spec stay, and each is labelled in
    that document as a house rule with no public backing, so a later reader
    does not go looking for the citation. Section 9.

Decisions 1 and 2 are the expensive pair, because the prose-craft spec's phase
two was scoped around the 25% number and decision 2 removes the number.
Decision 7 changes a component that does not exist yet, which is the cheapest
moment to change it. Decision 15 is the only decision here that a guard can
enforce on its own with no reviewer attached.

## 1. What Google and Microsoft actually mandate about person

Google's Highlights page states the rule as `Use second person: "you" rather
than "we."` The Second person page then qualifies it in a way the Highlights
line does not carry: second person is for what the reader does, and third
person is for what the software or an end user does. The same page allows first
person plural for the organisation that authored the document, and it separately
tells an author to use the imperative when the reader is being told to do
something, with the `you` implied.

Microsoft's Person page opens on second person as the general case and then adds
a deletion rule: "Omit you can whenever the sentence works without it."
Microsoft's Top 10 tips page repeats the deletion in its tenth tip and pairs it
with an instruction to open most statements on a verb. So Microsoft mandates
second person and, in the same breath, mandates removing the most common way
second person reaches a sentence.

GitLab's word list entry `you, your, yours` is a substitution rule: `you`
replaces `the user`, `the administrator` and `the customer`. Its entry `we`
tells an author to focus on what the reader accomplishes. Neither entry counts
anything.

None of the three names a number or a ratio. What all three legislate is which
person a given sentence takes, and Google is the only one that says
what happens to a sentence whose actor is the software.

That last point is what decides the 25% floor. The prose-craft spec measured
this site at 9% of sentences naming the reader, react.dev's `useState` reference
at 57%, and the Rust book at 12% to 16%. A reference page's job is to describe
what a symbol does, and Google rules those sentences into the third person, so a
reference page can be correct under Google at any figure. The prose-craft spec
saw this and wrote decision 4 to accommodate it at section openings, and then
wrote decision 3 as a flat per-page floor that does not accommodate it anywhere
else. `apps/docs/content` is roughly half reference pages under the structural
standard's decision 6, so the floor would bear hardest where the rule says
least.

Decision 1 keeps the whole of what the guides actually rule, and it asks for the
same rewriting work on the pages that deserve it, because the sentences the
prose-craft spec was complaining about are the ones whose actor is a process
with nobody behind it, and those fail decision 1 on the third-person side just
as hard. 18F's Active voice page states the same prohibition from the other
direction, in a sentence about passive voice: never write so that actions appear
to happen with nobody doing them. Google's Voice page gives the same reason for
preferring the active voice, which is that the passive makes it easy to leave
the actor out.

Decision 2 keeps the 9% figure as a diagnostic. A page at 9% is worth opening.
What the reviewer then applies is decision 1, one sentence at a time.

## 2. Tense and mood, which neither existing document rules

Google's Verb tense page is the most specific thing any source here says about a
verb. Present tense is the default for behaviour that is not tied to a moment.
Future `will` is allowed, and only to mark an action that genuinely happens
later than the sentence describing it; the page's own worked pair is an
archive that runs at the next backup. The page separately rules out the
hypothetical `would`, and rewrites its example as a conditional opening on `if`.
It also forbids the future tense for describing how a product will work after a
release.

Microsoft's Verbs page agrees on present tense and adds the mood table.
Indicative is for statements of fact and carries most content. Imperative is for
procedures and for headings over columns of reader actions. Subjunctive is
listed and marked to avoid. The page also forbids switching mood inside one
sentence.

Neither the structural standard nor the prose-craft spec says anything about
tense or mood. Decisions 3 and 4 close that. The tense rule is close to
greppable: `will`, `would` and `shall` are three tokens, and a reviewer reading
only the hits can decide each one in a few seconds.

GitLab rules one more thing here that this repository will want, from
`_index.md`: no page promises a feature in a future release. A published
package's documentation that says a capability is planned ages into a lie the
moment the plan changes, and this repository publishes specs with a `Status`
line that already carries that information in the right place.

## 3. Procedures, and where a condition goes

Google's Procedures page requires an imperative verb in the first sentence of
every step, one step per action, and the location of the action stated before
the action. It marks an optional step by opening it with `Optional` and a colon.
It formats a one-step procedure as a bullet, with no number on it.

Microsoft's Writing step-by-step instructions page rules the same imperative,
the same one-action-per-step, and the same location-first ordering, and adds
that a step is a complete sentence with a capital and a period. It also allows
combining short steps that happen in one place.

Google's Highlights page states the general form of the ordering rule for prose
as well as for steps: conditions go before instructions. The Sentence structure
page says the same about a circumstance or a goal.

The prose-craft spec's decision 2 already has the imperative half. Decision 5
here adds the ordering half, which is the part with a test a reviewer can apply
without judgement: a step whose `if` clause sits at the end has told the reader
to act and then told them whether to.

## 4. Modals, and the em dash

GitLab's word list carries the cleanest modal legislation in any source here, in
the entry headed `recommend, we recommend`: "Instead of we recommend, use you
should." The entry sets three forms against three meanings, with the bare
imperative for a requirement, `you should` for a recommendation, and `you can`
for an option. The separate `you can` entry tells an author to open on an active
verb where possible and to keep `you can` for optional actions. The `may,
might` entry assigns permission to `may` and probability to `might`, and
recommends `can` over `may`.

The prose-craft spec's decision 11 reads two of those three backwards. It
assigns permission to `you can`, which GitLab assigns to `may`, and it rewrites
`you should` away entirely, which GitLab makes the required spelling of a
recommendation. Decision 6 here takes GitLab's assignment, with Microsoft's
deletion rule attached, because the deletion rule and GitLab's `you can` entry
say the same thing about where a sentence should start.

The em dash is where the guides disagree with each other, and the disagreement
is worth writing down because the ban list gets argued about.

| Guide     | Page                     | Rule                                                                                 |
| --------- | ------------------------ | ------------------------------------------------------------------------------------ |
| GitLab    | `_index.md`, Punctuation | En dash and em dash are both refused; write two sentences or use commas.             |
| Microsoft | Top 10 tips, tip nine    | Em dash is prescribed, with no spaces around it, and the page's own examples use it. |
| 18F       | Punctuation, Dashes      | Em dash is prescribed for an offset phrase, with a space on either side.             |
| Google    | Highlights               | The page rules on serial commas and says nothing about dashes.                       |

18F's Dashes section is explicit that "you should use the longer em dash (—)",
and its Voice and tone page then uses the character four times in its own body
prose. Microsoft's ninth tip is a spacing rule whose corrected example carries
two em dashes. GitLab's punctuation list refuses both dash characters and names
the remedy as separate sentences or commas.

So three maintained guides hold three positions and no consensus exists to
appeal to. The ban list matches GitLab exactly, including the remedy, and
decision 18 takes GitLab's remedy over the colon the prose-craft spec proposed
in its section 8. The colon is not wrong; it is unsupported, and a remedy that
one of the three guides writes down is a better default than one none of them
does. The prose-craft spec's finding about MDN's Learn page, where twelve em
dashes all attach a gloss to a term, is unaffected: a comma attaches a gloss
too, and GitLab names the comma.

## 5. Notices, and whether anyone should use them

Four guides publish a closed set. They do not publish the same set.

| Guide                             | Page               | Labels                                 |
| --------------------------------- | ------------------ | -------------------------------------- |
| Google                            | Notices            | Note, Caution, Warning, Success        |
| Microsoft Learn contributor guide | Markdown reference | Note, Tip, Important, Caution, Warning |
| Red Hat supplementary style guide | overview           | NOTE, IMPORTANT, WARNING, TIP          |
| GitLab                            | `_index.md`        | flag, note, warning, disclaimer        |

Every set orders its labels by how much a reader loses by skipping one. Google's
Warning means the step may be irreversible. Microsoft's Warning means a
dangerous certain consequence and its Caution means a negative potential one.
Red Hat carries no Caution at all and says the type is not fully supported.
None of the four carries a label meaning `Exception`, and none carries one
meaning `Remember`.

The prose-craft spec's decision 7 set four labels by rhetorical function, taken
from a board game rulebook. Its own stated defect, in that document's opening
section, is that a reader skimming this site cannot see which paragraph will
cost them an afternoon. That defect is a severity problem, and the four
published sets are severity ladders. Decision 7 here keeps `Exception`, because
nothing in the published sets marks the counterexample to a rule just stated and
because the prose-craft spec's decision 8 hangs on counting them, and replaces
`Remember` with `Warning`. The structural standard's decision 2 already requires
the fading reminder and already places it, so `Remember` was a second home for
work that has one.

The stronger finding is that every guide reached tells an author to use fewer
notices, and one of them tells an author to use almost none. The Microsoft Learn
contributor guide's Alerts section: "Avoid notes, tips, and important boxes.
Readers tend to skip over them." The same section limits an article to one or
two alerts and forbids adjacent ones. Google's Notices page warns that multiple
notices on a page lose their distinctiveness and tells an author not to group
them. Red Hat tells an author to keep admonitions to a minimum and to avoid
placing them near each other. GitLab tells an author to use alert boxes
sparingly and never to place one immediately after another.

The prose-craft spec's own ledger records that nothing in its evidence base
measured a callout on a web page. The guides did not measure one either, and all
four landed on scarcity anyway. Decision 8 takes the numeric form, because two a
page is countable and `sparingly` is not.

## 6. The numbers the guides name

Three shapes carry a published number, and this repository bounds none of them.

| Shape          | Number                                 | Guide and page                                 |
| -------------- | -------------------------------------- | ---------------------------------------------- |
| Paragraph      | Three to five sentences, seven at most | Google technical writing course, Paragraphs    |
| List items     | Two to seven                           | Microsoft, Scannable content: Lists            |
| Linked clauses | Two, three at the outside              | Microsoft, Global communications: Writing tips |
| Notices        | One or two per article                 | Microsoft Learn contributor guide, Alerts      |

Google's Paragraphs lesson states the first of those directly: "Readers
generally welcome paragraphs containing three to five sentences." The same
lesson makes the opening sentence the load-bearing one, on the ground that a
reader who is skimming reads it and may read nothing else. Write the Docs
reaches the same place from its Skimmable principle, which asks that paragraphs
and list items carry their concept as early as possible. digital.gov's
Principles page lists a topic sentence as one of five plain language principles.

That cluster is the public backing for the prose-craft spec's decision 4, and it
is better backing than the one that document used. Decision 4 was argued from a
board game rulebook whose reader has flipped to a page with no search and no
links, and the spec's own ledger flags that as an analogy. Google, Write the
Docs and digital.gov all rule the same thing for a reader who arrived from
search. Decision 9 here widens decision 4 from the first sentence of an H2
section to the first sentence of every paragraph.

Sentence length is the number nobody names. Google's Short sentences lesson
argues for short sentences and gives no count; its advice is structural, which
is to refactor a long sentence carrying an `or` or an embedded list into a list.
Microsoft's Use simple words page names no count either and gives a proxy: a
sentence punctuated by more than a few commas is probably too complex. GitLab's
`_index.md` carries a 100-character line-length convention for the source file
and nothing about the sentence. So the prose-craft spec was right to leave
sentence length alone, and its measurement of this site's median at 15 words
stands as evidence that nothing needs doing there.

## 7. Terminology

Google's technical writing course, in its Words lesson, rules two things this
repository has no rule for. An unfamiliar acronym is spelled out on first use
with the acronym in parentheses, and an author does not then alternate between
the two forms. A document introducing many terms collects them into a glossary.
The same lesson carries the consistency rule in the form everyone quotes, which
is that a component named one thing does not get renamed to another halfway
through.

Microsoft's Use simple words page carries the consistency rule twice, once as
one term per concept and once, on the Global communications page, as the
converse: one word does not refer to two concepts. The prose-craft spec's
decision 6 has the first half and not the second, which matters here because
this repository's vocabulary already carries `policy` for a document, for a
federated member and for the thing an author writes.

Google's Jargon page offers an alternative decision 5 does not. A term used once
can be described in plain language with the term in parentheses; a term used
throughout can be described on first reference or linked to a definition that
already exists. Decision 13 adds the link form, because this site has reference
pages whose whole purpose is to hold a definition, and a teaching page that
links to one is doing what Write the Docs' ARID principle asks. Write the Docs
states that principle as "Accept (some) Repetition In Documentation", which
permits repetition without requiring it, and the structural standard's fading rule already decides how
much repetition this site carries.

The glossary question is open and decision 12 does not settle it. Google says to
collect definitions when there are many. This site has closed mode, the deny
overlay, a vetoable key, a frozen document and the freshness budget, which the
prose-craft spec already listed as concepts with no symbol and no marker.

## 8. What the guides forbid outright

GitLab's word list is the only source here that publishes refusals as a
checkable list. It refuses `simply` and `simple` on the ground that a reader who
finds the process hard stops trusting the document, refuses `easily` for the
same reason, refuses `please` in product documentation, refuses `and/or` in
favour of `or` or a rewrite, and refuses `note that` as wordy. Google's Voice
and tone page refuses the same family, naming `simply`, `easy` and `quickly`,
and refuses exclamation marks, pop-culture references, internet slang and
figurative language.

Decision 15 takes the intersection and makes a guard of it, because a word list
is the one rule in this document that a pattern decides with no judgement
attached. It is the same shape as `doc-antithesis.test.ts` and cheaper, because
a literal token has no honest use to protect.

The humour rule is the one that touches this repository's domain. Google's
Writing for a global audience page refuses humour, idiom, slang, holidays,
cultural practices, sports and seasons, each named separately, and its reason in
every case is translation and a reader outside the author's country. Microsoft's
Global communications page refuses idioms and culture-specific references on the
same ground. Write the Docs' Style guides page goes as far as tabulating
replacements for idioms about killing animals.

The prose-craft spec's decision 9 fences the game domain out of rule sentences
and leaves it in the examples, the furniture and a labelled aside. Nothing in
the guides disturbs that fence, and Google's page extends it: a heading and an
example are both places where a cultural reference reaches a reader who cannot
decode it. `urn:game:brass-birmingham` is a product name and stays. A heading
that plays on a game mechanic does not. Decision 16 states the extension.

Google's Link text page rules that link text works with the surrounding text
removed, refuses `this document`, `this article` and `click here`, and accepts
either the exact page title or a descriptive phrase. The prose-craft spec's
decision 12 required the exact heading, which it justified from the structural
standard's `.md` sibling transform, and no style guide backed it. Google's
looser form covers that justification, because a descriptive phrase comes
through the transform as well as a heading does, and the looser form is the one this site
needs on reference pages whose headings are bare symbols. Decision 17 takes
Google's.

## 9. The fourteen, one at a time

| Prose-craft decision             | Verdict | Public backing                                                              |
| -------------------------------- | ------- | --------------------------------------------------------------------------- |
| 1, subject is an actor           | Stands  | Google Voice; 18F Active voice; Microsoft Top 10, tip ten                   |
| 2, steps are imperatives         | Stands  | Google Procedures; Microsoft Writing step-by-step instructions              |
| 3, 25% floor                     | Amended | None. Google Second person rules person per sentence. Decisions 1 and 2     |
| 4, section opens on the payoff   | Stands  | Google Paragraphs; Write the Docs Skimmable; digital.gov Principles         |
| 5, term enters as subject        | Amended | Google Jargon adds the link form. Decision 13                               |
| 6, one name per concept          | Amended | Microsoft Global communications adds one concept per name. Decision 14      |
| 7, four labels by function       | Amended | Four guides publish severity sets. Decision 7                               |
| 8, `Exception` is a budget       | Amended | Widened to all labels, two a page. Decision 8                               |
| 9, colour outside rule sentences | Amended | Google global audience extends it to headings and examples. Decision 16     |
| 10, instruction before opinion   | Stands  | None found. Astro only; nearest is Google's conditions-first rule           |
| 11, `you can` and `you should`   | Amended | GitLab word list assigns the modals differently. Decision 6                 |
| 12, link text is the heading     | Amended | Google Link text accepts a descriptive phrase. Decision 17                  |
| 13, length tracks difficulty     | Dropped | None found in any guide reached. Decision 19                                |
| 14, recap lists the mistakes     | Stands  | None found. Microsoft's checklist extension summarises instead. Decision 20 |

Three stand untouched, eight are amended, one is dropped, and two stand as house
rules with the absence of backing written down.

Decision 13 is dropped because nothing legislates it and because its own author
recorded it as the weakest claim in the document. The rule ties a page's prose
count to its `difficulty` rung, which are two different facts: how hard the
subject is, and how much text it took. A reference page for a four-member
interface can be `Rare` and short. The `doc-prose-budget.json` ratchet already
catches a page that ran long, and a second length rule disagreeing with it is
the thing the prose-craft spec said it was avoiding.

Decisions 10 and 14 stay because nothing contradicts them, and both are worth
having. What changes is that each carries a line saying no public guide rules
it, so nobody spends an afternoon looking for the citation.

## 10. What a guard could reach

`doc-antithesis.test.ts` is the model, and the discipline it records in its own
docblock is that a guard fires only where a pattern cannot mistake an honest
sentence for a dishonest one.

| Rule        | What a guard counts                                                          | Why it is safe                                           |
| ----------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| Decision 15 | Literal tokens in prose: `simply`, `easily`, `please`, `and/or`, `note that` | Substring search. No judgement.                          |
| Decision 9  | Sentences per paragraph, against seven                                       | `doc-prose-budget.ts` already splits sentences.          |
| Decision 10 | Items per list, against two and seven                                        | Markdown list markers are syntactic.                     |
| Decision 7  | Aside labels outside the closed set of four                                  | A closed vocabulary check.                               |
| Decision 8  | Notices per page against two, and adjacency                                  | A count and a line-distance check.                       |
| Decision 12 | First occurrence of an all-caps token, against an expansion nearby           | Syntactic, with a per-page allowance for known acronyms. |
| Decision 17 | Link text against the refused phrases                                        | `doc-links.test.ts` already resolves targets.            |
| Decision 3  | Hits for `will`, `would`, `shall`, reported and not failed                   | A report, because every hit needs a reader.              |

Resting on a reviewer:

- Decision 1, which side of the reader-versus-software split a sentence falls
  on, and whether the actor named is the one doing the work.
- Decision 4, whether a sentence is indicative where it should be.
- Decision 5, whether a trailing clause changes whether the step runs.
- Decision 6, whether a `you should` is a recommendation the reader may refuse.
- Decision 11, whether two clauses joined by `and` are independent.
- Decision 13, whether a first occurrence is a definition or a link to one.
- Decision 14, whether two phrases name one concept, and whether one name
  covers two.
- Decision 16, whether a heading or an example carries a cultural reference.

Eight judged rules here beside the prose-craft spec's eight and the structural
standard's six is more than `docs-reviewer` can hold in one pass. Section 11
says what to do about that.

## Testing

Nothing here needs code before phase two starts. What phase two needs:

- The notice component from the prose-craft spec's testing section, built with
  decision 7's set in place of that document's. A component built with
  `Remember` obliges a later sweep over every page that used the label.
- The word list in decision 15, shipped as a guard on the ratchet pattern
  `doc-prose-budget.json` uses, before any page is rewritten. It is the one
  guard that can be written today, and it catches a defect a rewrite would
  otherwise introduce.
- The prose-craft spec's counter committed under `tools/repo-checks`, unchanged
  by this document. Decision 2 keeps that counter's 9% as a diagnostic, so the
  counter is still needed and no longer needs a threshold.
- One page rewritten against decision 1 and the same page rewritten against
  decision 3, so the two produce a comparable diff. `luhn/index` is the prose-craft
  spec's candidate and stays the right one.

## 11. The reviewer load

The structural standard names six judged rules, the prose-craft spec names
eight, and this document names eight more. Twenty-two judgement calls per page
is past what one review pass holds, and the prose-craft spec already flagged
fourteen as doubtful.

The split that works is by what a rule attaches to. Decisions 1, 4, 5, 6 and 11
attach to a sentence and a reviewer can decide them while reading in order, one
pass, no lookups. Decisions 13, 14 and 16 attach to a page as a whole and need a
grep before a verdict. Those are two passes with different inputs, and they
should be two passes.

This is a recommendation to `.claude/agents/docs-reviewer.md` and this document
does not make the change.

## The evidence, and what it does not cover

Read verbatim, as raw Markdown or as near-raw source with front matter intact,
so the wording quoted is the wording the maintainers wrote:

- The six Microsoft Writing Style Guide pages and the Microsoft Learn
  contributor guide's Markdown reference. Each returned its source Markdown
  including YAML front matter, git commit id and the original GitHub URL under
  `MicrosoftDocs`, so the rule text is the published text.
- The four 18F Content Guide files, read from the archived `18F/content-guide`
  GitHub repository through `gh api`, base64-decoded locally. The em dash rule,
  the serial comma rule and the passive voice prohibition are read from those
  files directly.
- The two GitLab files, `_index.md` and `word_list.md`, fetched as raw Markdown
  from `gitlab-org/gitlab` at `master`. The punctuation line refusing the en
  dash and the em dash, and the `recommend, we recommend`, `you can`, `you`,
  `we`, `may, might`, `simply, simple`, `note that`, `please` and `and/or`
  entries, come from that raw source.

Read through an extraction pass and not verbatim, which is the weaker category and is flagged as such on every claim it supports:

- Every Google page, style guide and technical writing course alike. The fetch
  tool converts the page and answers a prompt against it, so the quotations
  attributed to Google here are that tool's report of the page, and not text I
  copied from the rendered HTML. The two Google quotations in the body are
  short and widely reproduced elsewhere; the rest of the Google claims are
  summaries and each names its page so it can be checked.
- The Red Hat supplementary style guide. One extraction pass over the overview
  produced the admonition set and the minimise instruction. I did not reach the
  individual rule page for either, and Red Hat is quoted nowhere in this
  document for that reason. Section 5's table row for Red Hat is the weakest row
  in it.
- Write the Docs, the Good Docs Project and digital.gov. The Good Docs Project
  publishes content-type templates and no sentence-level rules, so it supports
  nothing here.

Asserted, and not measured or quoted:

- That decision 1 produces less rewriting than decision 3 did. Nobody has
  applied either to a page. The claim that the floor would push `you` into
  software-behaviour sentences is derived from Google's rule and from the
  structural standard's page-type split, and no page has been rewritten under
  the floor to see whether an author actually does that.
- That severity is the right axis for a notice label on this site. Four guides
  chose it and none of them published a reason or a measurement, and the
  prose-craft spec's ledger already records that nothing in its evidence base
  measured a callout either.
- That `Exception` belongs in a severity set organised on a different axis.
  Decision 7 keeps it on the strength of the prose-craft spec's decision 8,
  which is a budget rule taken from a board game designer, and no public guide
  carries a comparable label.
- That the word list in decision 15 is the right intersection. GitLab and
  Google each publish a longer list, and this document took the tokens both
  refuse plus `and/or` and `note that`, which only GitLab refuses. Nobody
  counted how often any of them appears in `apps/docs/content`.
- That two notices a page is the right budget for this site. Microsoft names one
  or two for an article and this document took the upper bound. The pages here
  are longer than a typical Microsoft Learn article and nothing checked whether
  that matters.
- That no guide reached rules on page length against a difficulty label. This is
  an absence claim over the pages listed at the top, and the guides I could not
  reach are exactly the ones most likely to carry a length rule, because the IBM
  Style Guide is the longest and most prescriptive of the set.

## Where I am guessing

- That the IBM Style Guide would not change section 5. It is the source
  everybody's admonition ladder descends from, its published index carries a
  Notes topic under Structure and format, and its rule text answered 401 to this
  session. Somebody with access should read that topic against decision 7 before
  the component gets built, because IBM's set is the one with `Restriction`,
  `Requirement` and `Attention` in it, and one of those may be what `Exception`
  was reaching for.
- That the Splunk Style Guide adds nothing. It is the one guide in the brief
  with a reputation for naming a sentence-length number, and section 6 concludes
  that nobody names one on the strength of Google, Microsoft and GitLab alone.
  If Splunk names a number, section 6's conclusion is wrong and the prose-craft
  spec's median-15 finding needs a threshold to be measured against.
- That ISO 24495-1 would not overturn decision 1. Its four principles are
  reported everywhere in secondary sources and I read none of it, so this
  document cites it nowhere and the guess is only that citing it would not have
  changed anything.
- That the owner wants the public guidance to win where it conflicts with the
  prose-craft spec. Section 9 resolves every conflict that way except the em
  dash, where two of three guides rule against the ban list and decision 18
  keeps the ban anyway. If the intended reading was that the house style wins
  by default, decisions 6, 7 and 17 are the three to revisit, because each one
  gives up a house rule for a published one.
- That the Microsoft Learn contributor guide counts as the Microsoft position on
  notices. The Writing Style Guide proper has no notices page that this session
  could find, and the contributor guide is a different publication with a
  different author. Its Alerts section is the strongest anti-notice statement in
  this evidence base and decision 8 rests on it.
