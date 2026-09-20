# The prose craft standard

Status: proposed
Depends on: `docs/specs/2026-09-16-documentation-standard.md` (the structural
standard this sits under; it owns page types, the teaching order, the fading
rule, H2 self-containment and the prose budget, and this document adds nothing
structural), `~/.claude/CLAUDE.md` (the ban list, which is the negative half of
what this document is the positive half of),
`tools/repo-checks/src/doc-antithesis.test.ts` (the one prose rule that already
has a guard, and the model for how a rule here becomes one),
`tools/repo-checks/src/doc-prose-budget.ts` (the word counter this document's
length rule reuses), `apps/docs/components/PageSheet.tsx` (the rarity ladder,
`requires` and `unlocks`, which is where the game vocabulary already lives),
`.claude/agents/docs-reviewer.md` (the agent that will run phase two against
these rules)
Measured against: this worktree at `f6f8eeb`, branched from `main`. 76 `.mdx`
pages under `apps/docs/content`, 2,737 prose sentences, 464 H2 sections. Every
number below about this repository came from running a counter over those files;
the scripts are in the session scratchpad and are not committed, because a
counter that disagrees with a guard is worse than no counter and section 9 says
which of these should become guards.
Prior art, read in full for this document: Jamey Stegmaier, "What Makes a Great
Rulebook?", stonemaiergames.com, read 2026-09-20; the Brass: Birmingham
rulebook v2018.11, the English PDF linked from `roxley.com/products/brass-birmingham`,
all 12 pages; the Astro docs writing style guide at
`contribute.docs.astro.build/guides/writing-style/`; the Magic: The Gathering
rules page at `magic.wizards.com/en/rules`; the Markdown sources of
`react.dev/learn/state-a-components-memory` and
`react.dev/reference/react/useState`, the Rust book's `ch04-01` and `ch09-02`,
`docs.astro.build/en/concepts/islands/`, and MDN's `Window.fetch` reference
beside its Learn-track variables page, each fetched from the project's own
repository, so the measured text is the text somebody wrote and not a
renderer's output.
Studies: Andersen, O'Rourke, Liu, Snider, Lowdermilk, Truong, Cooper and
Popović, "The Impact of Tutorials on Games of Varying Complexity", CHI 2012,
read in the original for this document. Section 7 reports what it measured and
what it declines to conclude.
Not reached, and therefore absent from the argument: the Wingspan appendix and
the Wingspan rulebook, whose PDFs Stonemaier serves only from a Dropbox folder
this session could not enumerate; Fantasy Flight's paired Learn to Play and
Rules Reference booklets, whose product and support pages answer 403 and whose
PDFs sit behind a CDN path this session could not guess. Section 3 uses Magic:
The Gathering's split instead, which is the same split and is reachable.

## What is actually wrong

The structural standard is written and its guards are landing. Nothing in it
reaches a sentence. `doc-antithesis.test.ts` is the whole of what any guard
knows about how a sentence is built, and it checks one figure of speech.

Measured across all 2,737 sentences in `apps/docs/content`, beside the same
counter run over the pages this repository names as prior art:

| Source                          | Sentences | Median words | Over 30 words | Sentences naming the reader | Sentences opening on the reader |
| ------------------------------- | --------- | ------------ | ------------- | --------------------------- | ------------------------------- |
| `apps/docs/content`, all of it  | 2,737     | 15           | 8%            | 9%                          | 1%                              |
| react.dev, `useState` reference | 138       | 15           | 2%            | 57%                         | 5%                              |
| MDN Learn, variables            | 103       | 16           | 6%            | 50%                         | 13%                             |
| react.dev, Learn, state         | 126       | 13           | 2%            | 35%                         | 12%                             |
| docs.astro.build, islands       | 59        | 18           | 10%           | 34%                         | 2%                              |
| The Rust book, `ch09-02`        | 128       | 22           | 20%           | 12%                         | 0%                              |
| The Rust book, `ch04-01`        | 168       | 18           | 15%           | 16%                         | 1%                              |

Sentence length is not the defect. The median of 15 words sits inside the range
every one of these sources occupies, and 8% over thirty words is better than
either Rust chapter.

The defect is who the sentences are about. 9% of this site's sentences name the
reader. react.dev's `useState` page names the reader in 57% of its sentences and
MDN's Learn page in 50%, and neither is a chatty document. The most common first
word on this site is a backticked symbol: 537 sentences of 2,737 open on one,
which is 20%, ahead of `the` at 468 and `a` at 332. `you` does not appear in the
first eighteen.

The same gap is sharper at section openings. Of 464 H2 sections, 121 open with a
sentence whose first word is a symbol, and 20 open with a sentence that names
the reader. 4%.

The second defect is that a warning on this site looks like every other
paragraph. `apps/docs/content` carries no callout, aside, note or warning
component: `grep` over every `.mdx` finds `WorkshopNotice`, `PageSheet`, `Probe`
and the package components, and nothing that marks a sentence as a caution. A
reader skimming a page has no way to see that one paragraph will cost them an
afternoon and the next will not.

The third defect is that the game angle is currently furniture and nothing else.
`PageSheet` carries the rarity ladder, `requires` and `unlocks`. Below the sheet
the prose is ordinary technical writing with a shop in the examples. The owner's
instruction was to take inspiration from game manuals on the text prose, and
section 2 is what a rulebook actually does at sentence level, measured off one.

The fourth is em-dashes, and it is a compliance gap. The ban list rules them
out. Per-section counts of sentences carrying one: `token` 16%,
`nestjs-correlation-id` 14%, `react-widget` 13%, `astro-widget` 11%, `luhn` 10%,
`urn` 10%, `feature` 9%, `compose` 7%, and `acl`, `react-acl` and `widget` at
0%. The three at zero are the sections written after the ban existed. Section 8
rules on whether the ban is right.

## Decisions

Each decision states a test a reviewer can apply to a page and answer yes or no.
Where the test is countable, the count is named.

1. **The subject of a sentence is the reader, a named symbol, or a named
   thing that acts.** Test: say the sentence's subject out loud. If it is
   `this`, `it`, `there`, or a noun phrase naming a process, the sentence is
   rewritten. Section 1.
2. **A step the reader takes is written as an imperative addressed to them.**
   Test: every numbered or bulleted step begins with a verb in the imperative.
   No step begins with "the developer", "the caller", "one" or "the
   application", where the reader is the one doing it. Section 1.
3. **A page names the reader in at least one sentence in four.** 25%, against
   the site's current 9% and react.dev's 35% to 57%. The number is a floor on a
   page, not a target for a paragraph. A page under it is a page written about
   the API, with nobody addressed. Section 1.
4. **A section's first sentence states what the reader gets from that section,
   in the reader's words, before any mechanism.** Test: read the heading and
   the first sentence alone. They answer "why am I here" with no second
   sentence. No H2 section opens on a bare symbol. Section 2.
5. **A term of art enters in a sentence whose grammatical subject is the term,
   and nothing uses it before that sentence.** Test: search the page for the
   term; the first hit is the definition. Section 3.
6. **One name per concept, for the life of the section.** A concept named
   "matrix document" on one page is not "the policy file" on the next. Test:
   grep the section for the synonyms; there are none. Section 3.
7. **A caution is labelled, from a closed set of four labels, and is not
   louder prose.** `Note`, `Exception`, `Remember`, `Shop note`. Each label
   means one thing, section 4 says which, and a paragraph that would need a
   fifth label is a paragraph in the wrong place. Section 4.
8. **`Exception` is a budget.** An H2 section carrying more than one is a
   section describing an API that is hard to remember, and the page records
   that in prose, and no page smooths it over. Stonemaier's rule, section 4.
9. **Domain colour lives in a labelled aside, in the examples, and in the page
   furniture. It never appears inside a sentence that states a rule.** Test: cut
   every `Shop note` and every `PageSheet` field from the page. What is left
   states every rule the page states, with no shop vocabulary in it. Section 5.
10. **The instruction and the opinion are separate sentences.** Where a step can
    be done several ways, the first sentence gives the action and the criterion
    and the second names the choice the example makes. Astro's rule, adopted
    verbatim in section 6.
11. **"You can" grants permission and nothing else. "You should" is rewritten.**
    Astro's rule, section 6. Test: every "you can" on the page is followed by
    something optional.
12. **A cross-reference is spelled as the heading it points at.** Test: the link
    text and the target's heading are the same string. Section 6.
13. **A page's length and its `difficulty` rung move together.** Test: within a
    section, no page rated `Common` is longer in prose words than a page rated
    `Rare`. Stonemaier's rule about rulebook length, section 6.
14. **A teaching page ends with a list of the rules a reader gets wrong, not a
    summary of the page.** Test: every item on the list is something a reader
    could violate. None of them restates the page's opening sentence.
    Section 6.

Decision 3 is the expensive one. 76 pages are at 9% and the floor is 25%, so
most of the site's prose is rewritten to satisfy it, and decision 1 is where
most of that rewriting happens. Decision 7 needs a component that does not exist.
Decision 9 is the one the owner is most likely to want argued, because it
constrains the game angle where he may have wanted it widened, and section 5 is that
argument. Decision 13 is the one with the weakest evidence behind it.

## 1. Who the sentence is about

The rulebook rule is one sentence and it is the whole of the sentence-level
craft in the Stonemaier post. Jamey Stegmaier, "What Makes a Great Rulebook?":

> I write rulebooks as if I'm talking to you.

The worked pair beside it is `"Pay $1 to gain 2 resources," not "The player pays
$1 to gain 2 resources."` Two sentences that state the same fact. One has a
third-person noun phrase doing the work and the reader watching; the other hands
the reader the verb.

Brass: Birmingham is written that way for twelve pages. Its setup steps are
`Take a Player Mat`, `Take £17 from the Bank`, `Choose a coloured Character
tile`, `Place your Victory Point (VP) Marker on the "0" space`. Its turn rule is
`On your turn, perform a total of 2 actions.` The reader is either the
grammatical subject or the addressee of an imperative on essentially every rule
in the document, and the book has no chatty register at all. A document can address its reader and stay flat, and Brass is the proof. That
is the finding that matters here, because the fear behind not addressing the reader is that the page will
read as marketing.

Astro's style guide arrives at the same instruction from the other side and
forbids the register at the same time:

> Do not use we, we'll, us, let's etc. (You are not with the reader.)

and, on instructions, `Whenever possible, give the reader a direct instruction`,
with `Run the following command …` as the shape. This repository already
complies with the first half: 0% of its sentences carry `we`, `us`, `our` or
`let's`. The Rust book, for comparison, carries one of those in 29% of `ch04-01`
and 38% of `ch09-02`. Section 8 reports that contradiction and does not hide it.

What this repository does not do is the second half. 9% of sentences name the
reader. The rewrite is usually mechanical, because the third-person version and
the second-person version carry the same facts. Taking a sentence from
`acl/adopting.mdx`, `The library does not sign a document or verify one`
passes decision 1 already, because `the library` is a named thing that acts.
`Closed mode softens the query and leaves the document under every check` also
passes. What fails is the sentence whose subject is a process and whose verb has
nobody behind it. An author rewrites those, and that work is where decision 3's
25% comes from.

Decision 3's number needs defending, because 25% is not read off any single
source. The sources cluster at 34% to 57% for teaching and reference pages
written by teams with editors. The Rust book sits at 12% to 16% and reads well.
25% is set between them, closer to the low end, because this repository's prose
is dense by design and a floor that forced react.dev's density would fight the
structural standard's H2 self-containment rule. A page can reach 25% by
rewriting roughly one sentence in six.

The corresponding count for section openings, decision 4's, is stricter and
section 2 says why.

## 2. What a section's first sentence does

Brass opens every action section the same way. The Build section's first
sentence:

> Performing the Build action allows you to place Industry tiles onto a location

and then, on the next line, `To perform the Build action:`, and then the
numbered steps. Sell, Loan, Develop, Network and Scout each open with the same
construction. A reader who has flipped to the page mid-game reads one sentence
and knows whether this is the section they wanted.

The skeleton is a purpose sentence, then a procedure. One line per section
buys it, and it is what makes the book usable as a reference without an index,
in a medium with no search and no links.

This site inverts it. 121 of 464 H2 sections open on a symbol. From
`acl/adopting.mdx`, the section headed `Closed mode is the whole difference`
opens `parseMatrix is hydratePolicy.` From `acl/api.mdx`, the section headed
`hydratePolicy` opens `Builds an evaluator over a matrix document.` The second
of those is a reference page's signature gloss and is correct as it stands,
which is why decision 4 is worded as what the sentence does, and not as what
word it opens with. A reference page's first sentence says what the symbol does, which
is what a reader who searched for the symbol came for. A teaching page's first
sentence says what the reader gets, which is what a reader working through the
section came for.

The test holds for both: read the heading and the first sentence, and they
answer "why am I here" without a second sentence. `hydratePolicy` / `Builds an
evaluator over a matrix document` passes. `Closed mode is the whole difference` /
`parseMatrix is hydratePolicy` does not, because the sentence names two symbols
and states a relation between them, and a reader who did not already know both
learns nothing from it.

## 3. How a term of art enters

Brass introduces its terms in a fixed shape and marks them for the rest of the
document. `Two locations are considered "connected" to each other if you can
trace a route of Link tiles (owned by any player) from one location to the
other.` The term is the grammatical subject, the definition is the predicate, it
sits under a heading that is the term, and every later use is capitalised, so a
reader can tell a defined term from an English word by looking at it.

The capitalisation is the part worth stealing, in this repository's own idiom.
Backticks already do it for symbols. Nothing does it for a concept that has no
symbol, and this site has several: closed mode, the deny overlay, a vetoable
key, a frozen document, the freshness budget. A reader meeting `closed mode` in
the middle of a paragraph cannot tell whether it is a term this site defined or
a phrase the author reached for.

Decision 6 is the cheap half of the answer. One name, used every time, is
enough for a reader to notice that it keeps recurring, and it is checkable by
grep. Decision 5 is the other half: the first occurrence of the name is the
definition, not a use.

Brass's own violations are worth counting, because they bound the rule. The
document forward-references four times, each as `(see "Overbuilding")` or
`(see "Consuming Coal" and "Connected Locations")`, always naming the heading
where the definition lives. It never uses a term bare before defining it. A
forward reference to a heading is not a use of an undefined term, and decision 5
allows it under decision 12's spelling rule.

## 4. What a warning looks like

Brass runs three labels across twelve pages, plus a fourth for flavour, and each
one means exactly one thing. Counted over the full text:

| Label              | Count | What it means                                          |
| ------------------ | ----- | ------------------------------------------------------ |
| `Exception:`       | 14    | The rule just stated does not hold in this named case. |
| `Note:`            | 11    | An extra fact. Getting it wrong is not possible.       |
| `Remember:`        | 4     | Something taught earlier applies again here.           |
| `Historical Note:` | 3     | Flavour. Carries no rule.                              |

The labels do work that formatting alone cannot. `Exception: During the first
round of the Canal Era, each player performs only 1 action.` is attached to the
sentence it qualifies, and a reader who reads the rule and skips the exception
has misplayed. `Remember: If consuming beer from another player's Brewery, it
must be connected to the second rail Link (after it is placed).` restates a rule
from an earlier page at the point it applies again, which is the structural
standard's fading rule with a device attached to it. The structural standard
already requires the reminder and gives it no form; `Remember` is the form.

Decision 7 takes all four, with `Historical Note` renamed `Shop note` for the
board game shop domain. The set is closed at four. A fifth label is how a
document ends up with `Tip`, `Caution`, `Important` and `Danger` and no reader
who can tell them apart.

Decision 8 is Stegmaier's, and it is the sharpest claim in his post:

> in 99% of cases, if I use the word "exception" in the rulebook, it's a sign of
> something that will be difficult for players to remember and should be removed
> from the gameplay.

He is a designer and can change the game. This repository can change the
package, and sometimes will not. So the rule here is weaker than his: an H2
section carrying more than one `Exception` is a section whose API is hard to
remember, and the page says so in prose. `acl/pitfalls` exists because that
already happened once and nobody wrote it down at the point it happened.

Brass, for its part, spends 14 exceptions across a game people call one of the
best designed ever made, which is the honest counterweight to the 99% claim.

## 5. Where the game angle belongs, and where it does not

Astro's style guide forbids the thing this repository is reaching for, in terms:

> Astro docs does not incorporate any characters as guides, or try to "tell a
> story" throughout docs. Each piece of content is standalone.

and, on register, `State facts directly. Do not try to be funny or whimsical.`,
with the rejected example `Scripts are like magical fairy godmothers that bring
your static page to life with a wave of their wand!`

The rulebooks agree with Astro and not with the reading of the owner's
instruction that would put metaphor into rule sentences. Brass carries two full
pages of Industrial Revolution biography, a paragraph each on Arkwright,
Tinsley, Watt, Owen, Brunel, Stephenson, Bessemer and Coade. None of it is
inside a rule. The flavour that does sit beside rules is fenced behind
`Historical Note:` and carries no rule at all: `Historical Note: Coal was
required in large quantities, so a robust transportation network was critical.`
A player who reads only the rules and none of the history plays the game
correctly.

So the game angle is taken at three places, and decision 9 is the fence:

- The furniture. `PageSheet` already does this, and the rarity ladder,
  `requires` and `unlocks` are the right shape: a reader gets the page's
  difficulty, its cost in minutes and its dependencies before the first heading,
  which is what a character sheet is for.
- The examples. The structural standard's decision 16 already puts every example
  in the board game shop. A `Brewery`, a `Pottery` and `urn:game:brass-birmingham`
  in a code fence carry the domain without any sentence having to be whimsical.
- The `Shop note` label, for the paragraph that is genuinely about the shop
  and not about the package.

What is refused is metaphor inside a rule sentence. The ban list already
forbids the metaphor verbs; decision 9 is the same refusal stated positively and
with a test, and the test is that cutting every aside and every sheet field
leaves a page that states every rule it stated before.

The one thing a rulebook does that this site should copy and currently does not
is the back matter. Brass closes with `THINGS TO REMEMBER`, fourteen bullets that
are the rules players get wrong, then `BEGINNER TIPS`, then `INTRODUCTORY GAME`,
a reduced ruleset for a first play. Decision 14 takes the first of those. A
recap that restates the page is dead weight; a list of the fourteen things people
get wrong is the most re-read page in the book.

## 6. The rules taken from the software sources

Astro's style guide is the only written prose standard among the sources, and
four of its rules are taken whole because each carries a test.

The instruction and the opinion are separated, which is decision 10. Astro's
worked pair: `Add the LanguagePicker component to your site. A good place might
be in a navigation component or a footer shown on every page.` becomes `Add the
LanguagePicker component to your site in a component that is shown on every
page. The example below adds this to the page footer:`. The criterion is in the
instruction and the choice is named after it, so a reader with a different
project can still follow the step. This matters here more than it does for
Astro, because this site's examples are all set in one shop and a reader whose
application is not a shop needs the criterion to transfer.

`You should` and `You can` are decision 11. Astro's reasoning, quoted from the
page: `You should… (Do I have to? What happens if I don't? How bad is that?)`
and `You can… (I can do a lot of things. Should I? Are you telling me to?)`.
Their rule is that `you can` is for permission and for stating that an option
exists, and nothing else. Their rewrite of a `should`: `If the installation was
successful, you should see a prompt to continue.` becomes `After a successful
installation, there will be a prompt to continue.` Their rewrite trades a reader subject for `there`, which decision 1 refuses. This repository's
version keeps the reader: `After a successful installation, you see a prompt to
continue.`

Decision 12 comes from Brass, and Astro says nothing about it. Every cross-reference in
the rulebook is the target heading's own text in quotation marks, because the
medium has no links and a reader has to find the heading by eye. This site has
links, so the rule looks free, and it is not: the structural standard's decision
14 generates a `.md` sibling per page for agents, and a link whose text is `here` or
`this page` degrades to nothing in that artifact. An author who spells the link
as its target's heading pays nothing and keeps the reference useful after the
transform.

Decision 13 is Stegmaier's length rule:

> I try to construct rulebooks in such a way that their length is indicative of
> the complexity of the game

Applied here, the `difficulty` rung on `PageSheet` and the page's prose count are
two statements about the same thing, and the site currently lets them disagree.
The test in decision 13 is deliberately relative: no `Common` page is longer
than a `Rare` page in the same section. An absolute
number would be a second prose budget disagreeing with
`tools/repo-checks/src/doc-prose-budget.json`, which the structural standard
already ruled out.

Decision 14's recap comes from both sides at once. The structural standard's
section 3a records react.dev's page skeleton as `what you'll learn → body →
recap → challenges` and marks it as taken. Brass's `THINGS TO REMEMBER` is the
same slot filled differently, and the difference is the rule: the items are the
mistakes, not the topics.

## 7. What the tutorial study actually supports

Andersen et al., CHI 2012, is the study the structural standard already cites,
and it is re-read here because one of its results bears on prose placement and
one bears against writing prose at all.

Measured, and this is the placement result. Comparing context-sensitive
tutorials against context-insensitive ones, Foldit players `played 40% more
levels and 16% longer` with the context-sensitive version. Refraction showed no
significant effect. In Hello Worlds the return rate was about 2% lower with the
context-sensitive version. The authors' own reading: `for games in which tutorial
presence does not have an impact, it does not matter whether or not the
information is presented in context.`

So adjacency helped in exactly one game of three, and that game is the one where
tutorials helped at all. The structural standard already establishes, from the
same paper, that the game where tutorials helped is the one where the reader's
prior knowledge did not transfer. Carried across, that says an author should put
a fact beside the step that needs it on the pages which teach something
genuinely unfamiliar, and nothing evidences it anywhere else. `acl` is that
section here. Nothing in the paper supports decision 4 or decision 7 as general
rules, and neither is argued from it.

Against the whole enterprise, from the paper's conclusion:

> players seem to learn more from exploring than from reading text

That sentence is a caution this document has to state and not bury. The
paper's strongest recommendation is to design early levels so a player can
experiment, which in this repository is the structural standard's decision 15
and its controls, not prose at all. A page whose prose is excellent and whose
reader has nothing to touch is not what the evidence points at. What this
document constrains is the prose that exists; it does not argue for more of it.

The limits are the ones the structural standard already recorded. Three games,
complexity never manipulated, confounded with genre, platform and audience, and
the authors' own `Further work is necessary to know the exact reasons for this
effect.` Nothing here should be read as a measured claim about documentation
prose, because nobody in this evidence base measured any.

## 8. Where this contradicts the ban list and the standard

Four places. Each one is reported as found, and none of them is resolved in
the ban list's favour.

The em-dash case. MDN's Learn-track variables page carries an em-dash in 12 of 103
sentences. Reading all twelve, every one does the same job: it attaches a gloss
to a term in the sentence that introduced the term. `Booleans are true/false
values — they can have two values, true or false.` The ban list's remedy is two
sentences, and two sentences here would split the term from its gloss and cost
the adjacency section 7 is about. The ban is still taken, because the figure it
was written against is the rhetorical dash and a rule with an exception clause
is a rule nobody applies. What decision 5 adds is the replacement the ban list
never named: a colon, which does the gloss job with none of the rhetorical
register. `Booleans are true/false values: true or false.` This repository's own
worst offender is `token` at 16% of sentences, which is above MDN.

The gerund case. The Rust book's `ch04-01` opens 15 of its 168 sentences
with a gerund phrase as the grammatical subject. `Freeing memory twice can lead
to memory corruption.` `Accessing data in the heap is generally slower than
accessing data on the stack.` `Returning values can also transfer ownership.`
Each one names an operation that the language performs, and no rewrite with a
concrete actor is shorter or clearer, because the actor is ambiguous by design:
the programmer writes it and the compiler enforces it. The ban list's own
examples are different: `Reading the row costs you` and `Holding the map is not
the same as applying it` are rhetorical, and their gerunds stand in for an
argument with no operation behind them. The ban should be narrowed to that
second kind, and this document recommends it. `apps/docs/content` carries 131
gerund-initial sentences across 2,737, which is 4.8%, against the Rust chapter's
9%, so the site is not currently over-using the construction either way.

The `we` case. The Rust book carries `we`, `us`, `our` or `let's` in 29% of `ch04-01`
and 38% of `ch09-02`, and it is the most praised long-form programming teaching
document in the set. Astro forbids the word outright. This repository is at 0%
and already matches Astro. Nothing changes; it is recorded because a later
reader will find the Rust book and propose the change, and the answer is that
the two sources disagree and this repository picked one.

The antithesis case. Astro's own style guide uses the figure to fence its scope: `It
is not our role to document how React, Tailwind, or JavaScript works. It is our
role to document how to use a UI framework component in Astro`. Split across two
sentences, so `doc-antithesis.test.ts` would not catch it, and it is the figure
the ban list rules out in every form. It is also the clearest statement of scope
in the document. The recommendation is to leave the ban where it is and note
that the guard's one-sentence pattern is the right width: the two-sentence form
is rarer and reads as a definition, with no rhetorical charge on it, and widening the guard
to catch it would fire on honest prose.

The standard's own claim is the fourth. Section 3a's Astro row reads `A written
style guide: no "we", no "let's", imperatives, neutral prose | Yes, and this
repo already writes that way.` Half of that is measured and correct: `we` is at
0%. The other half is not. Astro's rule is `Whenever possible, give the reader a
direct instruction`, and this site names the reader in 9% of its sentences and
opens 4% of its H2 sections on one. The standard's verdict on that row is
corrected here, and decisions 1 through 4 are the correction.

## 9. What a guard could reach, and what rests on a reviewer

`doc-antithesis.test.ts` is the precedent: one figure, one pattern, near-zero
false positives, and its own docblock says the rest is left to a reviewer
because `both have honest uses that a pattern cannot tell from the dishonest
ones.` The same discipline applies here.

Countable, and worth a guard on the ratchet pattern
`doc-prose-budget.json` already uses:

| Rule        | What a guard counts                                                    | Why it is safe                                                           |
| ----------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Decision 3  | Share of prose sentences matching `\byou\b                             | \byour\b`, per page                                                      | A word count. No judgement in it. |
| Decision 4  | H2 sections whose first prose sentence begins with a backticked symbol | Syntactic. A reference page's gloss is exempt by a file-level allowance. |
| Decision 7  | Aside labels outside the closed set of four                            | A closed vocabulary check.                                               |
| Decision 8  | `Exception` labels per H2 section                                      | A count against a constant of one.                                       |
| Decision 12 | Link text against the target heading's text                            | `doc-links.test.ts` already resolves the targets.                        |
| Decision 13 | `difficulty` against the page's prose count, within a section          | Both numbers already exist.                                              |

Resting on a reviewer, because no pattern separates the honest case:

- Decision 1, whether a subject is a thing that acts. `The library does not sign
a document` and `Serialization does not sign a document` differ by judgement.
- Decision 2, whether the reader is the one performing a step.
- Decision 5, whether the first occurrence of a term is a definition.
- Decision 6, whether two phrases name one concept.
- Decision 9, whether a rule sentence carries a metaphor.
- Decision 10, whether a criterion is stated before a choice.
- Decision 11, whether a `you can` is granting permission.
- Decision 14, whether a recap item is a mistake or a topic.

Eight of fourteen rest on a reviewer, which is `docs-reviewer.md`'s work in
phase two and is why this document exists separately from a guard.

## Testing

Nothing here needs code written for it. What phase two needs before it starts:

- The four aside labels exist as one MDX component with a `kind` prop, so
  decision 7 is checkable by grep and decision 8 is countable. Until that
  component exists, no page can comply with decision 7 and a sweep against it
  reports the same finding 76 times.
- The counter that produced the numbers in "What is actually wrong" is committed
  under `tools/repo-checks` before any decision here becomes a guard, so the
  baseline and the guard read the same sentences. The counters in the scratchpad
  split sentences on `[.!?]` after joining hard-wrapped lines and skip fenced
  code, tables and list markers; a guard that split differently would report a
  different 9%.
- A page rewritten under decisions 1 to 4 exists and is reviewed, before the
  other 75 are touched. `luhn/index` is the cheapest candidate: six pages in the
  section, 120 sentences, and 8% of them naming the reader.

## The evidence, and what it does not cover

Measured, by running a counter over the files named:

- Every number about `apps/docs/content`: 2,737 sentences over 76 `.mdx` pages,
  median 15 words, 8% over 30 words, 9% naming the reader, 1% opening on the
  reader, 537 sentences opening on a backticked symbol, 131 opening on a gerund,
  464 H2 sections of which 121 open on a symbol and 20 name the reader, and the
  per-section em-dash shares in "What is actually wrong".
- Every number about react.dev, the Rust book, MDN and docs.astro.build: the
  same counter over the Markdown sources fetched from `reactjs/react.dev`,
  `rust-lang/book`, `mdn/content` and `withastro/docs`. The distinction between the source and the rendered page
  matters for the Rust book, whose source is hard wrapped at 80 columns; a first pass that split on line breaks reported a median
  of 7 words and was wrong.
- The Brass: Birmingham label counts: 14 `Exception:`, 11 `Note:`, 4
  `Remember:`, 3 `Historical Note:` and 4 `(see "…")` cross-references, by grep
  over `pdftotext -layout` output of the v2018.11 English PDF.
- That `apps/docs/content` carries no callout, note, warning or aside component:
  grep for every capitalised JSX tag across the tree returns `WorkshopNotice`,
  `PageSheet`, `Probe`, `Panel` and the package components, and none of the
  others.
- The Andersen et al. figures in section 7, read from the paper's Results and
  Conclusion sections.

Asserted here, and not measured:

- That 25% is the right floor for decision 3. It sits between the Rust book's
  12% and react.dev's 35%, and nothing measured picks the point. A page at 20%
  is not known to be worse than a page at 25%.
- That labelled asides help a reader of a web page. Brass is a printed book with
  no search, and the labels carry more there. No study in this evidence base
  measured a callout.
- That decision 4's purpose sentence helps a reader who arrived from search.
  Brass's design is for a reader who flipped to a page with the table waiting,
  which is the closest analogue anyone in this evidence base built, and it is
  still an analogy.
- That the site's 9% is a defect and not a house voice. The comparison set
  is five documents. Every one of them is above it, and the Rust book is closest,
  and the Rust book is also the one whose median sentence is 22 words. A style
  that is dense and impersonal at once is a coherent choice and this document
  recommends against it on the strength of five samples.
- That decision 13's rung and length should track each other. `PageSheet`'s
  `difficulty` field means how hard the page is, and Stegmaier's rule is about
  how complex the game is. Those are related and not the same, and nobody has
  checked whether the site's current ratings and lengths disagree.

## Where I am guessing

- That the owner wants rulebook craft at sentence level and not more rulebook
  furniture. `PageSheet` already exists, so the furniture reading is the one
  already implemented, and this document takes the other reading because the
  instruction said "on the text prose". If the want was more furniture, sections
  1 through 4 are the wrong half of this document.
- That the Wingspan appendix would not change section 3. It is the praised
  example of a term reference and this session could not open it, so the
  term-of-art rule rests on Brass alone. Somebody with the box should read the
  appendix against decision 5 before phase two sweeps on it.
- That Fantasy Flight's two-booklet split adds nothing Magic's does not. Both
  split a document a reader walks from a document a reader consults, which is
  the structural standard's teaching-versus-reference split, already settled
  there. Fantasy Flight prints the two as physically separate booklets, which is
  a stronger claim than Magic makes, and I could not read either one.
- That decision 3 is achievable without the pages getting longer. Naming the
  reader usually adds a word or two per sentence, and four pages are already
  over the prose budget. A rewrite that satisfies decision 3 and pushes a fifth
  page over the budget has traded one guard's finding for another's.
- That eight reviewer-judged rules is a workable load for `docs-reviewer`. It
  already carries the structural standard's six. Fourteen judgement calls per
  page may be past what one pass can hold, and the order in section 9 is not a
  priority order.
