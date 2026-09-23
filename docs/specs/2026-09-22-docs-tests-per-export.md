# The behaviours a suite states, on the export's reference entry

Status: proposed. Research and design. The owner asked for the coverage report
to be connected to the API references, so a reader looking up an export on
`/acl/api/` can see the tests that exercise it. The brief that reached me added
a second half, per-export coverage percentages, and a warning that per-test
attribution is impossible. One of those two survives measurement and the other
does not, in the direction nobody expected: per-test attribution is possible and
cheap, and it is the worse answer. § 1 and § 2. The owner then sharpened the
feature twice while this was being measured, first to a behaviour catalogue
composed from the `describe` chain and the `it` name, then to a convention where
the `describe` states which export it is about. Both revisions are folded in and
both improve the design. § 3 is the second one, and it is the document's spine.
Packages: `apps/docs` gains one build step and one rendered block per reference
entry. `tools/doc-examples` gains one reader beside `declarations.mjs`.
`tools/repo-checks` gains one check, G11. `libs/acl` gains four `describe`
blocks and nothing else. No published library changes its runtime, its types or
its exports.
Depends on: `tools/doc-examples/src/mdx-reference-loader.mjs:52-53` (the
`<!-- reference @evanion/acl#hydratePolicy example=… -->` directive every entry
already carries) and `:372-391` (the loader entry point, whose `addDependency`
calls are what a new input has to join),
`tools/doc-examples/src/declarations.mjs:145-171` (`programOf`, which builds its
program over the published `.d.ts` and therefore cannot supply a source line
range), `:392-457` (`readReference`, the shape a behaviour list sits beside),
`tools/repo-checks/src/doc-export-coverage.test.ts:145-209` (`exportsOf`, the
program over `@evanion/source` entry points that § 7 reuses verbatim) and
`:25-36` (G10's two rules, which § 11 sits beside),
`tools/repo-checks/src/security-register.test.ts:7-33` (the three copies the
register holds together, and the reason § 5 exempts that suite),
`libs/acl/SECURITY.md:28-30` (the tier table, which states what a test in each
tier may claim), `apps/docs/next.config.ts:64` (`output: 'export'`),
`apps/docs/content/acl/api.mdx:13-16` (the entry shape),
`libs/acl/vite.config.ts:25-28` (the coverage block, which § 2 concludes needs
no change), `nx.json:142-151` (`release.projects` is `["libs/*"]`, the scope § 0
adopts), PR #270 on branch `docs/test-statistics`, specifically
`apps/docs/package.json` (the `testing-data` target and the `build` target that
depends on it) and `apps/docs/tools/test-statistics.mjs:86-101` (the sweep, and
the `--coverage.reporter=json-summary` flag § 2.4 measures the effect of),
`docs/specs/2026-09-21-docs-api-reference.md` (the entry this renders into),
`docs/specs/2026-09-21-docs-test-statistics.md` (the section whose numbers § 13
reconciles against).
Measured against: this worktree at `9511355`, Node v24.16.0, TypeScript 6.0.3,
Vitest 4.1.9, `@vitest/coverage-v8` 4.1.9, Nx 23.1.1, Next 16.3.4, macOS 26.6.2,
Apple M1 Pro. Every count, percentage and duration below came from running
something against that tree in this session. The evidence sections at the end
separate what I ran from what I read and from what I am guessing.

## What is actually being asked

**A reader on `/acl/api/#pickallowedfields` wants to know what the suite says
about `pickAllowedFields`.** Not how many lines ran. The owner's own example is
the shape of the answer: "refuses a key the document never held" is a sentence
about behaviour, and a list of those sentences is a behaviour catalogue an
engineer can read and disagree with.

The brief I was given asked for two derivable things, which tests name an export
and how well an export's own lines are covered, and asked me to establish
properly that a v8 coverage report cannot say which test exercised what. Three
measurements changed the shape of the answer.

**Per-test attribution is possible.** Not from the report as configured, which
is aggregate over the run, but from one coverage run per test file, which costs
23 seconds for `libs/acl`'s 25 test files. § 1.3. It is possible and it is the
wrong tool, because what it reports is execution and not intent: `ruleId`'s
lines are executed by 19 of acl's 25 test files and named by 3, and the other 16
build a matrix. § 1.4.

**Per-export coverage is derivable and says almost nothing.** 43 of the 45
callable exports of `@evanion/acl` sit at 100% statement coverage of their own
declaration range, while the package sits at 98.17%. An export's own range holds
30.5% of the package's statements and 18.8% of its branches, and 15 of the 21
uncovered statements sit outside every export range. § 2. A page that printed
"100%" beside 43 entries would be hiding the uncovered code rather than
reporting it.

**The suite already writes its names as statements, and the owner's convention
makes attribution stated rather than inferred.** 767 of 1,007 `it` titles under
`libs/` read as a statement of what must hold, and all 514 of `@evanion/acl`'s
do. § 8. And 33 of the 57 non-error callable exports across the eleven libraries
already sit under a `describe` that spells their name exactly. The whole
remaining backfill is 24 `describe` blocks, four of them in `@evanion/acl`. § 4.

So the feature is a behaviour catalogue, derived from test sources, attributed
by a convention the repository has half-adopted by accident. The coverage half
is dropped.

## Decisions

Twenty-six. Decision A is what the entry claims and decision B is where the
claim comes from; the rest derive from those two. 1 through 6 settle the
coverage question and close it. 7 through 12 settle the convention and its cost.
13 through 18 settle the rendering. 19 through 23 settle the machinery. 24
through 26 are the guard and the two pages' relationship. Decision 26 is put to
the owner undecided.

### The two the rest are derived from

A. **An entry claims "the suite states this", and never "this is tested".** The
sentences on an entry are the sentences the suite's own authors wrote about that
export. The page reports them and adds nothing. Where the page would have to
infer, it renders nothing instead. § 14.

B. **Attribution is stated by the test, not inferred from it.** A case belongs
to an export when a `describe` in its chain spells that export's name exactly.
No reference walk, no coverage overlap, no heuristic. § 3.

### The numbered decisions

1. **The v8 coverage report cannot attribute a line to a test, as configured.**
   Vitest starts the profiler once per worker and takes coverage in
   `onAfterRunFiles`, once per batch of files
   (`node_modules/vitest/dist/chunks/index.DXx9Dtk7.js:171-180`). No per-case
   boundary exists in the data. § 1.1.
2. **Per-test-file attribution is possible and costs 23 seconds for
   `libs/acl`.** Measured: 25 separate `vitest run <file> --coverage` runs, 0.92
   s each. § 1.3.
3. **Per-case attribution costs about 16 minutes for `libs/acl` alone.**
   Measured: a single-case run under `-t` takes 0.87 s to 1.20 s, and acl holds
   1,095 cases. § 1.3.
4. **Coverage-based attribution is dropped, because it reports execution and
   the reader will read it as intent.** Measured over the 45 callable exports:
   the set of test files naming an export and the set executing its lines agree
   for 27 and disagree for 18. `ruleId` is named by 3 files and executed by 19.
   § 1.4.
5. **Per-export coverage percentages are dropped.** 43 of 45 callable exports
   report 100% statements against a package at 98.17%, and an export's own range
   holds 30.5% of the package's statements. § 2.
6. **`libs/acl/vite.config.ts:25-28` needs no change, and PR #270's coverage
   flags need no change.** Both follow from decision 5. Measured separately:
   the default reporter list does emit `coverage-final.json`, which is what a
   per-export figure would have read, and #270's
   `--coverage.reporter=json-summary` replaces that list rather than extending
   it. § 2.4.
7. **A case belongs to an export when some `describe` in its chain is exactly
   that export's name.** Exactly: `describe('hydratePolicy')` owns, and
   `describe('the hydratePolicy seam')` does not. § 3.1.
8. **Any depth in the chain counts, not only the outermost.** Measured: 380 of
   1,007 cases already sit under such a `describe` at some depth, against 38 of
   172 top-level `describe` blocks that carry one. Requiring the outer level
   would discard `hydratePolicy > canFields decides a proposed key the object
does not carry`. § 3.2.
9. **A case may belong to more than one export, and the page renders it on each
   entry.** A nested `describe('hydratePolicy') > describe('canFields')` states
   both. § 3.3.
10. **An error class is exempt from the convention.** 38 of the 95 callable
    exports across the libraries are error classes, and an error's behaviour is
    stated by the function that throws it. § 3.4.
11. **The backfill is 24 `describe` blocks across the eleven libraries, four of
    them in `@evanion/acl`.** Measured: 57 non-error callable exports, 33
    already owned. acl needs `applyDenyOverlay`, `policy`, `assertNoContractDrift`
    and `contractDrift`. § 4.
12. **The convention is backfilled for `@evanion/acl` in this change and adopted
    going forward everywhere else.** The four acl blocks are written; the other
    20 are recorded in G11's allowance and written when their suite is next
    touched. § 4.2.
13. **The adversarial suite under `libs/acl/src/security` is exempt and says
    so.** Its 36 `describe` titles carry the register identifier,
    `security-register.test.ts` holds the register, the suite and the published
    page together on that identifier, and the tier decides what the test may
    claim. Renaming those `describe`s to export names breaks all three. § 5.
14. **The rendered sentence is the chain below the owning `describe`, joined,
    with the owning `describe` removed.** `pickAllowedFields > drops a key the
decision never decided` renders as "drops a key the decision never decided"
    on `pickAllowedFields`'s entry, where the reader is already. § 7.1.
15. **A `describe` whose children carry computed titles renders as one
    sentence, and the entry's count counts it as one.** Measured: 450 of acl's
    1,095 cases are `it.each` seeds under
    `an overlay that matches nothing changes no decision`, and that title is
    already a statement. A count beneath such a block would be the only number
    on the entry that was not the number of sentences above it. Settled
    2026-09-23: one count per entry and none anywhere else. § 7.2, § 13.
16. **The sentences are read from the test sources, not from a test run.**
    Measured: all 514 statically read titles appear verbatim in the run's
    `fullName` set, so the static read is a strict subset with no invented
    sentence. It costs 0.83 s for acl against 20.1 s for the sweep, and it means
    the reference pages build without running a test. § 10.1.
17. **A separate check holds the static read against the run.** Every sentence
    the pages would render has to appear in the run's report, which is the same
    shape `security-register.test.ts` uses to hold three copies of one claim
    together. § 10.3.
18. **An export with no stated behaviour renders a sentence saying so, not a
    blank.** "No test in this package states a behaviour under this name." § 9.
19. **The data is one JSON file per package, written by a new
    `docs:behaviour-data` Nx target, read by `mdx-reference-loader.mjs` during
    `next build`.** The static export has no server, so the read happens at
    build time, which is where the loader already reads declarations. § 10.2.
20. **The target is separate from #270's `docs:testing-data` and does not depend
    on it.** `testing-data` runs the suites; this one parses them. Coupling a
    reference page's rebuild to a 20-second sweep buys nothing. § 10.2.
21. **An unreadable or missing behaviour file fails the docs build.** The loader
    already throws on an unresolved symbol and a missing README region. § 10.4.
22. **The block sits below the signature fence and above the example.** The
    signature says what the export is, the behaviours say what it does, the
    example shows a call. § 7.3.
23. **A "happy path" and "sad path" intermediate `describe` is offered and not
    required, and nothing infers the split.** Measured: 54 second-level
    `describe` titles exist across the libraries and none of them is such a
    split. Deriving it from the verb was considered and refused in § 8.3.
24. **G11 reports rather than fails, with a ratcheting allowance.** Every
    non-error callable export has a `describe` naming it. The allowance lands
    holding the 20 exports outside `@evanion/acl`, and the second test refuses
    an entry no longer needed, which is the mechanism
    `doc-export-coverage.test.ts` already uses. § 11.
25. **A test-name shape guard is specified and not adopted now.** Measured: 239
    of 1,007 titles begin "should", 104 of them in `@evanion/urn` alone and 0 in
    `@evanion/acl`. Rewriting them is a separate change with its own argument.
    § 8.2.
26. **Whether the behaviour block appears for a package that has not adopted the
    convention is the owner's to settle.** The recommendation is per-package
    opt-in through `navigation.ts`, so a page shows a full catalogue or no block
    at all. § 12. Put to him undecided because it decides whether ten packages
    ship a worse page on the day acl ships a better one.

## 0. Scope

The packages are the ones `nx.json:151`'s `release.projects` matches, which is
`libs/*`, eleven libraries. The docs app, the demo apps, the design system under
`internal/` and `tools/repo-checks` are outside it, the same boundary
`docs/specs/2026-09-21-docs-test-statistics.md` § 0 adopts and for the same
reason: the predicate is the release predicate, so a twelfth library joins on
the day it is released and nothing here is edited.

Within a package the subject is its published exports, read from the `exports`
map of its `package.json` through the `@evanion/source` condition, which is what
`doc-export-coverage.test.ts:145-171` already does. A wildcard pattern is
skipped: `@evanion/astro-widget` publishes `./components/*` as `.astro` files
with no export list behind them.

## 1. Why a coverage report cannot answer the question, and what it costs to make it

### 1.1 What the report is

`@vitest/coverage-v8` connects one inspector session per worker and calls
`Profiler.startPreciseCoverage` once
(`node_modules/@vitest/coverage-v8/dist/index.js:10-21`). Vitest calls
`takeCoverage` from `onAfterRunFiles`
(`node_modules/vitest/dist/chunks/index.DXx9Dtk7.js:171-180`), once per batch of
files a worker finished, and ships the result to the reporter. No hook sits
between two cases. The counters the report carries are sums over everything the
worker ran.

So the aggregate report answers "this line executed during the run". It does not
carry the identity of the case that executed it, and no configuration of the
existing provider adds one. The brief's premise is correct about the report.

### 1.2 What the report does carry

`coverage-final.json`, which the default reporter list emits, is Istanbul-shaped
per file: `statementMap`, `fnMap` and `branchMap` giving line and column ranges,
and `s`, `f` and `b` giving hit counts. Measured on `libs/acl`, 25 files, 301 KB.
`src/evaluate.ts` alone carries 52 statements, 4 functions and 19 branches with
their line ranges. That is enough to answer a range question, which § 2 uses, and
not enough to answer a per-test question.

### 1.3 The cost of making it answer

Two ways exist and both were measured rather than estimated.

**One coverage run per test file.** 25 `vitest run <file> --coverage` invocations
over `libs/acl`, 23 seconds of wall clock, 0.92 s each. Every run produced a
`coverage-final.json` holding only the files that test file touched. This is
cheap, it works, and it is the thing the brief called absurd.

**One coverage run per case.** Three timed runs of `vitest run
src/evaluate.test.ts -t 'denies' --coverage` took 1.20 s, 0.91 s and 0.87 s.
`libs/acl` holds 1,095 cases, which puts the package at roughly 16 minutes and
the eleven libraries, at 1,795 cases, at roughly 27 minutes. That is the absurd
one, and the difference between the two is a factor of 44.

A custom provider calling `Profiler.takePreciseCoverage` between cases is the
third way. The profiler call itself is not the cost: measured in a Node process
with `libs/acl/dist/index.js` loaded, `takePreciseCoverage` returns in 0.198 ms
over 200 calls. The cost is the 1,095 payloads and the source-map remapping of
each one, which I did not measure and which § "Asserted and not measured" records
as unmeasured.

### 1.4 Why it is dropped anyway

The 25 per-file reports were compared against a static walk of the same test
sources, over the 45 callable exports of `@evanion/acl`.

| Relationship between the two sets          | Exports |
| ------------------------------------------ | ------- |
| The same test files name it and execute it | 27      |
| Executed by a file that never names it     | 15      |
| Named by a file that does not execute it   | 5       |

129 (export, test file) pairs come from naming and 173 come from execution. The
extra 44 are the problem. `ruleId` is named in 3 test files and its lines are
executed by 19, because almost every acl test builds a matrix and matrix
construction derives rule identifiers. `AclConfigError` is named in 5 and
executed by 15. An entry claiming those 19 files as `ruleId`'s tests would be
claiming that `clock.test.ts` tests rule identifiers, which it does not.

The five in the other direction are the honest half: four are `.test-d.ts` type
tests, which execute nothing at runtime by design, and the fifth is `serialize`,
for the reason § 2.2 gives.

Execution is a weaker signal than naming, and naming is a weaker signal than a
`describe` that states the subject. The design goes to the strongest of the
three.

## 2. Per-export coverage, measured and dropped

### 2.1 It is derivable

A declaration's source line range plus `coverage-final.json`'s per-statement
ranges gives per-export statements and branches. Built and run against
`libs/acl`: 88 of 106 exports have a declaration in a file that carries a
coverage row, and 45 have at least one statement inside their own range.

One catch sits in `declarations.mjs`. `programOf` builds its program over the
published `.d.ts` (`:145-171`), so the line range `readReference` could report is
a range in `dist/acl.d.ts` and has no relation to `src/evaluate.ts`, which is
where coverage is measured. A second program over the `@evanion/source` entry
points supplies source ranges directly, which is what
`doc-export-coverage.test.ts:145-171` builds already. Declaration maps are the
other route and are unnecessary.

### 2.2 What it says

| Result over the 45 callable exports of `@evanion/acl` | Count |
| ----------------------------------------------------- | ----- |
| 100% of the statements in their own range             | 43    |
| Below 100%                                            | 2     |

The two are `diffMatrix` at 24/26 statements and 14/22 branches, and
`hydratePolicy` at 79/83 statements and 31/31 branches. Branch coverage adds one
more name, `AmbiguousRuleIdError` at 2/4.

So the feature would render "100%" on 43 of 45 entries. The information content
of the whole rendered column is three numbers.

One export, `serialize`, reports zero statements in range. Its first declaration
is an overload signature at `libs/acl/src/serialize.ts:102` with no body, and a
signature holds no statements. Any per-export coverage implementation has to
handle that, and the handling is more code than the result is worth.

Eighteen exports have no coverage row at all, every one of them declared in
`libs/acl/src/types.ts`, which emits nothing.

### 2.3 Why it is worse than saying nothing

The package's own totals, computed from the same file: statements 1124/1145
(98.17%), branches 779/825 (94.42%), functions 233/238 (97.90%).

An export's own declaration range holds 349 of the package's 1,145 statements
(30.5%) and 155 of its 825 branches (18.8%). The other 796 statements sit in
module-level helpers the exports call. Of the 21 uncovered statements, 6 fall
inside an export's range and 15 do not.

A reader looking at 43 entries marked 100% would conclude that
`@evanion/acl` is fully covered. The uncovered code is in
`hydrate-policy.ts` (5 statements), `diff-matrix.ts` (4), `schema.ts` (4),
`conditions.ts` (3), `validate.ts` (2), `testing/drift.ts` (2) and `canonical.ts`
(1), and almost all of it is invisible to the per-export view. On a page built
for a reader who already suspects the numbers, a figure that reads as complete
while the package is not is the worst available output. Decision 5.

### 2.4 What that saves

`libs/acl/vite.config.ts:25-28` sets `reportsDirectory` and `provider` and
nothing else, so the reporter list is Vitest's default. Measured by deleting the
output directory and running the target: the default list writes
`coverage-final.json`, `clover.xml`, `index.html` with its assets, and the text
summary. It does not write `coverage-summary.json`.

PR #270 passes `--coverage.reporter=json-summary`. Measured by running exactly
those flags: the output directory then holds `coverage-summary.json` and
`report.json` and nothing else. A CLI reporter flag replaces the configured
list rather than extending it, so #270's sweep produces no `coverage-final.json`.

Shipping per-export coverage would have meant adding `--coverage.reporter=json`
to #270's sweep, carrying a second 301 KB artefact per package, and reconciling
it with the summary the `/testing` page already quotes. Decision 5 removes all
three. Decision 6.

## 3. The convention

### 3.1 The rule

A case belongs to an export when a `describe` in its chain is exactly that
export's name. `describe('hydratePolicy')` owns every case beneath it.
`describe('the hydratePolicy seam')` owns nothing, and `describe('hydrate')`
owns nothing.

Exactness is the whole value. A substring rule would attach
`the diffMatrix seam` to `diffMatrix` and `applyDenyOverlay refuses at apply
time, naming the key` to `applyDenyOverlay`, both of which happen to be right
today and neither of which the page can rely on. An exact match is a statement
the test author made on purpose, and a guard can hold it.

### 3.2 Any depth, not only the outermost

Measured across the eleven libraries: 38 of 172 top-level `describe` blocks
spell an export name exactly. 380 of 1,007 cases sit under such a `describe` at
some depth. The gap is where the good material lives:

```
hydratePolicy > canFields decides a proposed key the object does not carry
diffMatrix > a widening > reports an added allow branch as granted, naming the branch
```

The second of those is three levels, and the middle level is exactly the
structure the owner asked about. A rule fixed to the outer level would throw it
away. Decision 8.

Per package, the share of cases already owned at any depth:

| Package                          | Cases | Owned | Share |
| -------------------------------- | ----- | ----- | ----- |
| `@evanion/urn`                   | 104   | 104   | 100%  |
| `@evanion/compose`               | 25    | 21    | 84%   |
| `@evanion/nestjs-correlation-id` | 46    | 37    | 80%   |
| `@evanion/widget`                | 26    | 20    | 77%   |
| `@evanion/luhn`                  | 43    | 20    | 47%   |
| `@evanion/feature`               | 68    | 26    | 38%   |
| `@evanion/acl`                   | 514   | 137   | 27%   |
| `@evanion/token`                 | 68    | 15    | 22%   |
| `@evanion/astro-widget`          | 7     | 0     | 0%    |
| `@evanion/react-acl`             | 23    | 0     | 0%    |
| `@evanion/react-widget`          | 83    | 0     | 0%    |

`@evanion/urn`'s 100% is an artefact worth naming: all 104 cases sit under one
`describe('URN')`, and `URN` is one of its nine exports. High ownership of cases
and low ownership of exports are different things, and § 4 measures the one that
matters.

### 3.3 One case, more than one export

A case under `describe('hydratePolicy') > describe('canFields')` states
something about both, when both are exports. It renders on both entries, with
the rest of the chain each time. Nothing deduplicates, because the reader on
`canFields`'s entry and the reader on `hydratePolicy`'s entry each want it.

### 3.4 Errors are exempt

Of the 95 callable exports across the eleven libraries, 38 are error classes.
`@evanion/acl` alone publishes 26 of them, and 26 of the 30 acl callable exports
with no `describe` are errors.

An error class has no behaviour of its own worth a `describe`. What a reader
wants to know about `InvalidConditionError` is which call throws it and when,
and that sentence belongs under the function: `hydratePolicy > refuses an
operand the engine would ignore`. The repository already separates the two kinds:
`declarations.mjs:182-198` gives `error` its own kind, on the evidence of 38
classes whose name ends `Error` against 4 that do not.

So an error's entry carries no behaviour block and G11 does not ask for one. An
error's entry showing the sentences of the functions that throw it was
considered and is § 12's open ground, not this change.

## 4. What the convention costs

### 4.1 The number

The subject of the convention is the non-error callable exports. Measured:

| Package                          | Callable | Errors | Subject | Owned | To write |
| -------------------------------- | -------- | ------ | ------- | ----- | -------- |
| `@evanion/acl`                   | 45       | 26     | 19      | 15    | 4        |
| `@evanion/react-acl`             | 6        | 0      | 6       | 0     | 6        |
| `@evanion/react-widget`          | 5        | 0      | 5       | 0     | 5        |
| `@evanion/feature`               | 13       | 4      | 9       | 7     | 2        |
| `@evanion/astro-widget`          | 2        | 0      | 2       | 0     | 2        |
| `@evanion/urn`                   | 5        | 2      | 3       | 1     | 2        |
| `@evanion/nestjs-correlation-id` | 5        | 0      | 5       | 4     | 1        |
| `@evanion/compose`               | 2        | 0      | 2       | 1     | 1        |
| `@evanion/widget`                | 4        | 0      | 4       | 3     | 1        |
| `@evanion/luhn`                  | 4        | 3      | 1       | 1     | 0        |
| `@evanion/token`                 | 4        | 3      | 1       | 1     | 0        |
| Total                            | 95       | 38     | 57      | 33    | 24       |

Twenty-four `describe` blocks. The brief warned that this is a change to how
tests are written across eleven libraries proposed so a documentation page can
be built, and that warning is right about the principle and wrong about the
scale. The suites already do this 33 times out of 57. The convention is a name
for a habit the repository has, plus 24 blocks.

The four in `@evanion/acl`: `applyDenyOverlay`, `policy`, `assertNoContractDrift`
and `contractDrift`. Each is a `describe` inserted around cases that already
exist, changing no assertion.

Two things this does not cost. It does not ask any existing `describe` to be
renamed: `describe('an overlay only ever subtracts')` stays exactly as it is,
nested inside a new `describe('applyDenyOverlay')`. And it does not ask for a
test to be written.

### 4.2 Backfill acl, adopt the rest going forward

`@evanion/acl` is the package the request is about, it is the package with an API
reference a reader actually visits, and its backfill is four blocks. Write them
here.

The other 20 are recorded in G11's allowance and written when their suite is next
touched, which is the ratchet `doc-export-coverage-allowance.json` already
implements and `doc-floor.test.ts` established. A name added to an allowance is a
sentence somebody writes in a pull request, and a name removed never comes back,
because G11's second test refuses an entry that is no longer needed.

The alternative, backfilling all 24 now, was considered. It is half a day and it
would put `@evanion/react-acl`'s six hooks under `describe` blocks written by
somebody who is not reading those tests for their own sake. The ratchet gets the
same place with the work done by whoever is already there.

## 5. The adversarial suite is exempt, and why

`libs/acl/src/security` holds 36 top-level `describe` blocks, one per register
entry, named like this:

```
SEC-007 a narrowed write never carries a prototype setter (CWE-1321)
```

Three things depend on that spelling. `libs/acl/SECURITY.md` names the test for
each of its 36 entries in the last column of its tier tables.
`tools/repo-checks/src/security-register.test.ts:7-33` holds the register, the
suite and `apps/docs/content/acl/register.mdx` together on the identifier, and
checks that a tier's entries live in that tier's file. And the tier decides what
the test may claim: `SECURITY.md:22-23` says a tier 3 entry carries no passing
defence, because a passing test there would imply one.

A `describe` renamed from `SEC-007 …` to `pickAllowedFields` loses the
identifier, breaks the register check, and drops the tier. The register's claim
is stronger than anything this change produces, and it is made by a person.
Decision 13: the suite keeps its names, and G11 skips `src/security`.

What the exemption costs is real and worth stating. `pickAllowedFields` has 23
cases naming it, and 8 of them are in the adversarial suite, including "withholds
the excluded key from the narrowed write" and "never picks a key the decision did
not mark allowed". Those are among the best sentences the suite contains, and
they will not appear on `pickAllowedFields`'s entry under this design.

The repair is available and is not this change: a SEC- `describe` may carry a
nested `describe('pickAllowedFields')` inside it, which satisfies the convention
at depth 2 and leaves the identifier where the register reads it. § 12 records it
as open.

## 6. Tests that belong to no export

Four kinds, and the design covers none of them, on purpose.

**Documentation examples.** 36 of acl's 1,095 cases come from `libs/acl/README.md`
through `includeSource`. Their `describe` titles are README headings and a heading
is not an export name. They are already published, as the fences the reference
entries render.

**Packaging and surface verification.** `describe('the package entry')` asserts
that the entry point exports exactly the documented surface. It is about all
exports at once and belongs to none.

**Behaviour that emerges from two exports.** `describe('a builder-authored policy
published as a contract')` runs `policy` into `serialize` into `parseMatrix`. Any
single owner would be a lie about the other two. A test author who wants one of
these on an entry nests a `describe` naming that export inside, deliberately.

**Repo checks.** `tools/repo-checks` is outside § 0's scope entirely.

G11 asks that every non-error callable export has a `describe`. It never asks
that every `describe` names an export, and it never asks that every case has an
owner. 627 of the 1,007 cases will continue to belong to no export, and that is
the correct number, not a gap.

## 7. Composing the sentence

### 7.1 The chain

For a case owned by `describe('diffMatrix')` at depth 1:

```
diffMatrix > a widening > reports an added allow branch as granted, naming the branch
```

The rendered line drops the owning segment and everything above it, and joins
the rest:

```
a widening · reports an added allow branch as granted, naming the branch
```

The separator is the interpunct `mdx-reference-loader.mjs:120` already joins a
tag line with, so an entry carries one separator and not two.

The owning segment is dropped because the reader is on `diffMatrix`'s entry and
has just read its name in the heading and its signature in the fence. The
segments below it are kept because they carry the condition the sentence holds
under, which is exactly the "intermediate describe" value the owner named.

Where the chain has nothing below the owner, the `it` title stands alone:

```
drops a key the decision never decided
```

### 7.2 Generated cases

450 of acl's 1,095 cases have computed titles. They are `it.each` seeds under a
`describe` that is already a full statement:

```
an overlay that matches nothing changes no decision > seed 1
```

The page renders the `describe` once and the entry's count counts it as one. A
list of 450 lines reading `seed 1` through `seed 450` would bury the entry. The
parent title is a better sentence than any of them anyway, and the pane shows
the whole `it.each` call, seeds included, so a reader who opens that sentence
sees what the 450 rows do.

Measured: all 514 of acl's statically readable `it` titles appear verbatim in the
run's report, and the 581 runtime cases with no static title break down as 450
`it.each` seeds in `deny-overlay.test.ts`, 38 in `tier1-prevented.test.ts`, 36
README examples, 33 in `authoring.test-d.ts`, 11 in `schema.test.ts`, 9 in
`types.test-d.ts` and 4 in `fields.test.ts`.

### 7.3 Where it renders

Inside the `docs-api-entry` element `mdx-reference-loader.mjs:344-357` already
emits, below the signature fence and above the example fence. The order is what
the reader needs in order: the signature says what the export is, the behaviours
say what it does, the example shows a call.

As a rail and a pane, in a frame of one height. Settled 2026-09-23, after the
owner read the first version: a flat grouped list left a reader unable to see
what any sentence checks, and `policy`'s 32 sentences pushed the next entry off
the screen. The rail lists the sentences under the `describe` labels the suite
wrote, the pane carries the case behind the selected one verbatim, and the frame
is the same height whether the export states 3 sentences or 32. Arrow keys move
the selection; it is a listbox, not a tab set, because these labels are
sentences and there can be 32 of them.

The pane shows the case and never a distillation of it. "Asserts that the
finding names the branch" would be the page's own reading of a suite it did not
write, which decision A refuses.

One count of sentences appears, at the head of the block. § 13.

## 8. What the names are actually like

### 8.1 The measurement

Every `it` and `test` call with a literal title, across all `.test.ts`,
`.spec.ts`, `.test.tsx` and `.spec.tsx` under `libs/*/src`: 1,007 cases in 66
files.

| Shape                | Count | Share |
| -------------------- | ----- | ----- |
| Reads as a statement | 767   | 76.2% |
| Begins "should"      | 239   | 23.7% |
| Two words or fewer   | 1     | 0.1%  |

Median title length 8 words, p90 11, max 15. The leading word, top five:
`should` 239, `refuses` 70, `reports` 40, `rejects` 39, `names` 20.

The split by package is not a spread, it is two groups:

| Package                          | Cases | Statement | "should" |
| -------------------------------- | ----- | --------- | -------- |
| `@evanion/acl`                   | 514   | 514       | 0        |
| `@evanion/feature`               | 68    | 68        | 0        |
| `@evanion/widget`                | 26    | 26        | 0        |
| `@evanion/react-acl`             | 23    | 23        | 0        |
| `@evanion/astro-widget`          | 7     | 7         | 0        |
| `@evanion/nestjs-correlation-id` | 46    | 44        | 2        |
| `@evanion/react-widget`          | 83    | 53        | 30       |
| `@evanion/token`                 | 68    | 22        | 46       |
| `@evanion/luhn`                  | 43    | 6         | 36       |
| `@evanion/compose`               | 25    | 4         | 21       |
| `@evanion/urn`                   | 104   | 0         | 104      |

`@evanion/acl` is 514 for 514. Every sentence this feature would render on
`/acl/api/` is already written the way the owner wants it, which is why the
feature works at all. `@evanion/urn` is 0 for 104: `should stringify basic URN`,
`should reject a scheme or NID that contains the separator`.

The single short title is `@evanion/luhn`'s `should be frozen`.

### 8.2 The shape guard, specified and not adopted

The check is one file in `tools/repo-checks`: no `it` title begins "should", and
none is shorter than three words. It lands as a ratchet with an allowance holding
239 names, 104 of them in one package.

It is not adopted in this change, for one reason. Rewriting 239 test names is a
change to eleven suites with its own argument to make, and folding it into a
documentation feature would hide it. The measurement is here so that the change
can be proposed with its cost already known.

What happens meanwhile: a "should" title renders on the page as written.
`should reject a scheme or NID that contains the separator` is a worse sentence
than `refuses a scheme or NID that contains the separator` and it is not noise. A
reader can read it. The decision to render it rather than filter it follows from
decision A: the page reports what the test says.

### 8.3 The happy and sad split

The owner asked about an intermediate `describe` separating the paths that work
from the paths that refuse, and noted that for this library the refusals are the
interesting half.

Measured: 54 second-level `describe` titles exist across the eleven libraries.
None of them is such a split. The closest are `diffMatrix`'s three,
`a widening`, `a narrowing` and `what it refuses to classify`, which are a
three-way domain split rather than a two-way outcome split.

Deriving the split from the verb was considered. acl's refusal verbs are visible
in the leading-word counts, `refuses` 70 and `rejects` 39, and a classifier over
them would be about 80% right. It is refused, because an 80% classifier puts
`reports nothing when the rules are reordered` under the wrong heading and the
page has no way to say it is unsure. Decision B holds: the page reports what the
test states.

So the intermediate `describe` is offered as a convention and required by
nothing. Where an author writes one, § 7.1 renders it as the clause it is. Where
nobody writes one, the entry is a flat list. Decision 23.

## 9. The export with nothing stated

This is the sharpest output the feature has and it is the reason to build it.

An entry whose behaviour block is empty renders one sentence:

> No test in this package states a behaviour under this name.

Not a blank, not a dash, not a hidden block. The sentence is a finding about the
suite, published on the page a reader came to trust, and it is the only claim on
the whole page that costs the project something to make.

Three things have to be true for it to be honest.

**It is only said where it means something.** For an error class, exempt by
decision 10, no block appears at all. For a type, no block appears: a test
asserting on a `MatrixDiff` never writes the name `MatrixDiff`, and measured, 36
of acl's 106 exports are named by no test file at all and every one of them is a
type or a constant. Absence there is an artefact of type inference and says
nothing about the suite.

**It is bounded.** After § 4.2's backfill, `@evanion/acl` has 19 non-error
callable exports and all 19 carry a `describe`. The sentence appears zero times
on `/acl/api/` on the day this ships. It appears when somebody adds an export and
writes no test that states its name, which is the moment it is worth reading.

**It never reads as "untested".** It says no test states a behaviour under this
name. `applyDenyOverlay` before § 4.2's backfill had 36 references across 4 test
files and 25 sentences available through the reference walk. What it lacked was a
`describe`. The wording has to carry that distinction, and § 14 holds it.

## 10. Where the data comes from

### 10.1 Sources, not a run

The sentences are read from the test sources with the TypeScript API, the same
way `doc-export-coverage.test.ts` reads exports. Measured: 0.83 s for
`@evanion/acl`, against 20.1 s for a full coverage sweep over the eleven
libraries and 1.84 s for acl's own suite.

Reading from #270's `report.json` was the alternative, and it is tempting: that
file carries `ancestorTitles`, `fullName`, `title` and `status` per case, which
is the composed sentence plus its result, already produced by a target #270
built. It is declined for two reasons. A reference page would then depend on a
20-second test sweep to rebuild, and § 10.2 gives that up for nothing. And the
run's report carries the 450 `seed N` titles § 7.2 has to collapse anyway.

The risk in reading sources is that the page publishes a sentence from a test
that does not pass. Two things already close it. CI runs `nx run-many -t lint
test build typecheck check` on every change, and #270's `docs:build` depends on
`docs:testing-data`, which runs the suites, so a deploy carrying a failing test
does not happen. § 10.3 adds the third.

### 10.2 The target

A new Nx target on `apps/docs`, `behaviour-data`, running
`node tools/behaviour-data.mjs`, writing one JSON file per package under
`apps/docs/components/api/`. Its inputs are the libraries' test sources and their
`package.json` exports maps; its output is the JSON. `docs:build` depends on it,
beside #270's `testing-data`.

It does not depend on `testing-data` and `testing-data` does not depend on it.
One runs the suites, the other parses them. They share the package list, which
both resolve through the Nx project graph from `release.projects`, the way
`docs-navigation.test.ts:88-109` does.

`mdx-reference-loader.mjs` reads the JSON while expanding a directive, and calls
`this.addDependency` on the test sources behind the entry, beside the
`addDependency` calls it already makes for the declaration file, the README and
the preamble (`:372-391`). Editing a test then rebuilds the page quoting it.

The static export decides all of this. `apps/docs/next.config.ts:64` is
`output: 'export'`, so nothing is fetched at request time and every byte a reader
sees was produced during `next build`. The loader is already the place the build
reads a package's own files, so this joins it rather than opening a second route.

### 10.3 Holding the copies together

One check in `tools/repo-checks`: every sentence the behaviour data carries
appears in the run's report as an `ancestorTitles` chain plus `title`, or as the
parent of a generated group.

This is the shape `security-register.test.ts` uses. Three copies of one claim
exist, in the test source, in the generated JSON and on the built page, and a
check that holds them together is what keeps the page from making a claim the
suite stopped supporting. Measured today: all 514 of acl's static titles match a
runtime case exactly, and 0 static titles have no runtime match, so the check
passes on the day it lands.

### 10.4 Failure

A missing or unparseable behaviour file fails the docs build. The loader already
throws when a symbol does not resolve and when a README region is missing
(`mdx-reference-loader.mjs:329-335`), so an entry never renders half-filled. An
empty block for one export is a rendered sentence (§ 9) and a missing file for a
package is a failed build.

## 11. G11

**G11 — every non-error callable export has a `describe` naming it.** For each
package in § 0's scope, every export the type checker reports as callable, whose
name does not end `Error`, has at least one `describe` in that package's tests
whose title is exactly that name. `src/security` is skipped (§ 5).

It reports rather than fails, with an allowance in
`tools/repo-checks/src/doc-behaviour-allowance.json`, and a second test that
refuses an entry no longer needed. The allowance lands holding the 20 exports of
§ 4.1 outside `@evanion/acl`, and `@evanion/acl` is absent from it.

Reporting rather than failing, for the same reason G8 reports: the rule is about
how tests are organised, and a hard failure would make somebody insert a
`describe` around one case at the moment they were trying to land something else.
The allowance is the pressure, and it only moves one way.

**Why this is not part of G10.** G10 holds every export to a `##` heading and
every callable one to an executable fence, reading `apps/docs/content` and the
export lists. G11 reads `libs/*/src/**/*.test.ts` and the export lists. The
inputs differ, so the Nx cache keys differ, and a change to a test would
invalidate G10 for no reason. They share the export enumeration, which moves into
a module both import rather than being copied a third time.

**What G11 does not do.** It does not ask that every `describe` name an export
(§ 6). It does not ask that a type have one. It does not read the `it` titles at
all, which is § 8.2's separate guard.

## 12. Against the security register

`libs/acl/SECURITY.md` and this feature are the same idea at two different
strengths, and the page has to be clear about which it is showing.

The register carries 36 entries in three tiers. Each names an attack class, the
mechanism that meets it, a CWE and sometimes an OWASP identifier, and the test
that proves it. A person wrote every row, a person chose its tier, and the tier
states what a passing test under it may claim. `SECURITY.md:22-23` says tier 3
carries no passing defence, because a passing test there would imply one. That
is a claim a human stands behind, and no derivation produces it.

The behaviour list is the mechanical sibling. It reports what the suite says
about itself, over every export instead of over one class of threat, and it
stands behind nothing. Its value is coverage of the surface and freshness: it
cannot go stale, because it is the test file.

Where each belongs. A claim about what an attacker cannot do goes in the
register, by hand, with a tier. A claim about what a function does goes on the
reference entry, derived. A reader who wants to know whether `@evanion/acl` is
safe reads the register. A reader who wants to know what `pickAllowedFields` does
reads the entry.

Two things stay open and are not decided here. Whether a SEC- `describe` may
carry a nested `describe` naming an export, which would put § 5's eight best
sentences on `pickAllowedFields`'s entry without touching the register. And
whether an error's entry should list the sentences of the functions that throw
it, which needs a way to state that relationship rather than infer it.

## 13. Against the `/testing` section

PR #270 builds a `/testing` section making per-package claims from a full run:
1,795 cases over 84 files in eleven libraries, measured here from the same sweep
and matching what that spec states. Two pages quoting different numbers from one
source would be worse than either alone, so three rules.

**The entry prints one count, at the head of the block, labelled
`behaviours`.** Settled by the owner on 2026-09-23, reversing this section's
first answer, which was that the entry prints none.

The first answer was arithmetic: 380 of the 1,007 statically titled cases have
an owning `describe`, and the sum of every entry's list across `/acl/api/` is
137 cases against a suite of 1,095, so a reader who added the entries up would
land somewhere that is not the suite. What the rendered page showed is that the
risk was the wrong way round. A reader meeting a rail of sentences wants to know
how much of it there is before reading a line, and the word `behaviours` is what
stops the number being read as a share of anything: it counts the sentences on
this entry, which is a quantity the block itself can be checked against. No
"8 of 1,095 cases", no percentage, no count per group and none per generated
block. One number, and it says what it counts.

**The `/testing` section holds every total.** Case counts, file counts, coverage
percentages and the commands that reproduce them stay there, and the reference
entries link to it rather than restating any of it.

**The two targets share a package list and nothing else.** Both resolve
`release.projects` through the project graph. Neither reads the other's output.
Decision 20.

One thing #270 gains from this document at no cost: § 2.4's measurement that its
`--coverage.reporter=json-summary` flag replaces the default reporter list, so
its sweep writes no `coverage-final.json` and no HTML report. That is correct for
what it needs and worth knowing.

## 14. What the page may say

The block's heading is **What the tests state**. Not "tested by", not "verified
by", not "covered by".

Three sentences are available and their differences are the whole honesty
argument.

> **What the suite states.** Sentences the tests wrote about this export. True
> by construction: the sentence is the test's own name.

> **What the suite verifies.** Would require reading the assertions. Nothing
> here does that, and nothing on the page claims it.

> **What the tests cover.** Would require coverage attribution, which § 1.4
> measured and § 2 dropped.

The empty case, from § 9:

> No test in this package states a behaviour under this name.

And the wording that is refused, with the reason. "Untested" is refused because
an export with no `describe` may have 36 references across 4 test files, as
`applyDenyOverlay` did before § 4.2. "Not covered" is refused because coverage is
a different measurement this page does not make. "0 tests" is refused because a count of
cases is not what § 13's count counts, and because an export with nothing stated
gets no count at all: a `0` invites a reader to subtract it from something.

One line of prose sits under the block heading on every entry that has one, and
it is the same line everywhere:

> These are the names the package's own tests carry. A test states a behaviour;
> whether it proves one is a question the test's source answers.

## Measured

Everything in this list was produced by running something against this worktree
at `9511355` during this session.

- **Vitest takes coverage once per file batch.** Read from
  `node_modules/vitest/dist/chunks/index.DXx9Dtk7.js:171-180`, where
  `takeCoverageInsideWorker` is called from `onAfterRunFiles`, and
  `node_modules/@vitest/coverage-v8/dist/index.js:10-44`, where the provider
  starts the profiler once and stops it once.
- **`takePreciseCoverage` costs 0.198 ms.** Mean over 200 calls in a Node process
  with `libs/acl/dist/index.js` loaded, 5 scripts in the result, 40,875 bytes in
  the first payload.
- **The default coverage reporter list.** Deleted `libs/acl/test-output` and ran
  `nx test @evanion/acl --coverage --coverage.enabled --skip-nx-cache`. Output:
  `coverage-final.json`, `clover.xml`, `index.html` and its assets. No
  `coverage-summary.json`.
- **A CLI reporter flag replaces the list.** Ran #270's flags exactly
  (`--coverage.reporter=json-summary --reporter=json --outputFile=…`). Output:
  `coverage-summary.json` and `report.json`, nothing else.
- **`coverage-final.json` shape.** 25 files for `libs/acl`, 301,490 bytes.
  `src/evaluate.ts`: 52 statements, 4 functions, 19 branches, each with a line
  range.
- **`libs/acl` totals from that file.** Statements 1124/1145 (98.17%), branches
  779/825 (94.42%), functions 233/238 (97.90%).
- **Per-export coverage.** 106 exports, 45 callable. 88 have a declaration in a
  covered file; 18 do not, all in `src/types.ts`. 45 have at least one statement
  in range, 44 of them callable. 43 at 100% statements. Below 100%: `diffMatrix`
  24/26 statements and 14/22 branches, `hydratePolicy` 79/83 statements.
  `AmbiguousRuleIdError` 2/4 branches. `serialize` has zero statements in range
  because its first declaration is the overload signature at
  `libs/acl/src/serialize.ts:102`.
- **Export ranges against the package.** 349 of 1,145 statements (30.5%) and 155
  of 825 branches (18.8%) fall inside an export's own declaration range. 21
  statements are uncovered; 6 inside a range, 15 outside. By file:
  `hydrate-policy.ts` 5, `diff-matrix.ts` 4, `schema.ts` 4, `conditions.ts` 3,
  `validate.ts` 2, `testing/drift.ts` 2, `canonical.ts` 1.
- **Per-file coverage runs.** 25 `vitest run <file> --coverage` invocations over
  `libs/acl`, 23 seconds total, all 25 succeeded, each writing a
  `coverage-final.json` of about 38 KB.
- **Per-case coverage runs.** `vitest run src/evaluate.test.ts -t 'denies'
--coverage` timed three times: 1.20 s, 0.91 s, 0.87 s.
- **Named against executed, 45 callable acl exports.** Identical sets 27,
  executed by a file that does not name it 15, named by a file that does not
  execute it 5. 129 naming pairs, 173 executing pairs. `ruleId` named by 3 files
  and executed by 19; `AclConfigError` 5 and 15; `hydratePolicy` 10 and 17;
  `parseMatrix` 12 and 15. The five in the other direction: `hydratePolicy`,
  `parseMatrix`, `federatedPolicies` and `policy` from `authoring.test-d.ts`, and
  `serialize`.
- **The reference walk over acl.** 106 exports, 45 callable, 27 test files. 70
  named by at least one test file, 36 named by none, and all 36 of those are
  types or constants. Median 5 references per named export, p90 28, max 109
  (`Matrix`). 806 of 904 references sit inside a titled block.
- **Behaviour sentences under the reference walk.** Median 1 per export, p90 18,
  max 63 (`Matrix`). 47 exports with zero, one of them callable.
- **Test names across `libs/`.** 1,007 `it`/`test` calls with literal titles in
  66 files across 11 libraries. 767 read as a statement, 239 begin "should", 1 is
  two words or fewer. Median length 8 words, p90 11, max 15. Leading word:
  `should` 239, `refuses` 70, `reports` 40, `rejects` 39, `names` 20. The
  per-package split is the table in § 8.1.
- **Top-level `describe` blocks.** 172 across `libs/`. 38 spell an export name
  exactly, 1 has one as its first word, 6 mention one, 127 do neither.
- **Ownership at any depth.** 380 of 1,007 cases sit under a `describe` spelling
  an export name exactly. Per package, the table in § 3.2. Exports named by such
  a `describe`: acl 14/106, react-acl 0/26, react-widget 0/23, astro-widget 0/9.
- **The backfill.** 95 callable exports across the eleven libraries, 38 error
  classes, 57 non-error subjects, 33 already owned, 24 to write. Per package, the
  table in § 4.1. `@evanion/acl` needs `applyDenyOverlay`, `policy`,
  `assertNoContractDrift`, `contractDrift`.
- **Second-level `describe` titles.** 54 across `libs/`, none of them a
  happy-path and sad-path split.
- **Static titles against the run.** 514 static `it` calls in `libs/acl`, all 514
  matching a runtime case exactly, 0 static calls with no runtime match. 581
  runtime cases with no static match: 450 in `deny-overlay.test.ts`, 38 in
  `tier1-prevented.test.ts`, 36 in `README.md`, 33 in `authoring.test-d.ts`, 11
  in `schema.test.ts`, 9 in `types.test-d.ts`, 4 in `fields.test.ts`.
- **The run's report shape.** `report.json` assertions carry `ancestorTitles`,
  `fullName`, `status`, `title`, `duration`, `failureMessages`, `meta` and `tags`.
- **Timings.** Static analysis over acl's 2 entry points and 27 test files: 0.83
  s wall. `nx test @evanion/acl` with coverage, cache skipped: 10.3 s through Nx,
  1.84 s inside Vitest. `nx run-many --target=test --projects=libs/* --coverage`,
  cache skipped: 20.1 s for 11 projects.
- **The sweep's totals.** 1,795 cases over 84 files in 11 libraries. Per package:
  acl 1,095/28, urn 139/5, react-widget 110/16, feature 90/7, luhn 75/5, token
  74/5, compose 53/3, widget 48/5, nestjs-correlation-id 46/5, react-acl 46/3,
  astro-widget 19/2.
- **`libs/acl`'s `describe` inventory.** 95 top-level blocks, 36 of them `SEC-`.
- **A fresh worktree needs `nx typecheck` before `nx test @evanion/acl`.** With
  `node_modules` installed and nothing built, the run fails with
  `Output file 'tools/doc-examples/dist/src/index.d.ts' has not been built from
source file`. `nx run-many -t build` does not produce it and
  `nx run-many -t typecheck` does. This is adjacent to what #270's author found
  and the cause is a different target.

## Read here and not run

- `docs/specs/2026-09-21-docs-api-reference.md` and
  `docs/specs/2026-09-21-docs-test-statistics.md`, both merged, for the entry
  shape and the `/testing` section's decisions.
- PR #270 on `docs/test-statistics`, three commits ahead of `main`, 25 files.
  `apps/docs/tools/test-statistics.mjs` and the `testing-data` target in
  `apps/docs/package.json` were read in full. The branch was not checked out and
  its targets were not run.
- `tools/doc-examples/src/declarations.mjs` and
  `tools/doc-examples/src/mdx-reference-loader.mjs` in full.
- `tools/repo-checks/src/security-register.test.ts:1-80` and
  `libs/acl/SECURITY.md` in full.
- `tools/repo-checks/src/doc-export-coverage.test.ts:1-250`.
- Vitest 4.1.9's runner chunks and `@vitest/coverage-v8`'s provider, from
  `node_modules`, to establish § 1.1. No Vitest documentation was consulted and
  no upstream issue was searched.

## Asserted and not measured

- **A custom provider resetting the profiler between cases.** § 1.3 measures the
  profiler call at 0.198 ms and asserts, without measuring, that the source-map
  remapping of 1,095 payloads is the cost. I did not build one. The assertion
  does not change any decision, because § 1.4 drops coverage attribution on
  correctness rather than on cost.
- **That `addDependency` on a test source rebuilds the page.** The loader uses
  the same call for the declaration file and the README
  (`mdx-reference-loader.mjs:380-386`) and Turbopack treats loader dependencies
  uniformly. I did not add one and run a watch.
- **That the behaviour block does not break the page's word budget.** G8 counts
  prose and `doc-prose-budget.ts:14` skips fenced blocks. The behaviour list is
  prose, not a fence, so it counts. `acl/api.mdx` is exempt from the budget under
  `docs/specs/2026-09-21-reference-page-budget.md`, which I read and did not test
  against a page carrying the block.
- **That 0.83 s for acl scales to the eleven libraries.** acl is the largest
  suite by a factor of five and the others are smaller programs. I ran the static
  analysis per package for the adoption tables and did not time the combined run.
- **That the four acl `describe` blocks of § 4.2 can be inserted without moving
  an assertion.** I read the files and did not write them.

## Where I am guessing

- **Whether 137 owned cases is enough material to be worth a page.** After § 4.2
  adds four `describe` blocks, 19 acl exports carry a list. I do not know how
  many sentences each will hold, because the four new blocks will pull in cases
  the current measurement counts as unowned. `applyDenyOverlay` has 36 references
  across 4 files and 25 sentences under the reference walk, so it is probably
  well covered, and `policy` similarly at 57 and 34. The two `contractDrift`
  exports I have no read on. If the answer turns out to be three sentences each,
  the feature is thinner than this document implies.
- **Whether the security exemption is a hole a reader will notice.** § 5 costs
  `pickAllowedFields` eight of its best sentences, and the same applies to every
  export the adversarial suite exercises. A reader comparing the entry against
  `SECURITY.md` will see material in one and not the other. I think the nested
  `describe` repair in § 12 is right and I have not thought it through against
  `security-register.test.ts`'s tier check.
- **Whether "what the tests state" survives contact with a reader.** § 14 puts a
  lot of weight on one heading and one line of prose. I cannot measure whether a
  reader reads "states" as "proves". The register exists partly because the owner
  already decided a claim like this needs a human, and this page is making a
  weaker version of it mechanically. If the wording is wrong the feature is
  harmful rather than merely thin, and that is the risk I am least able to
  bound.
- **Decision 26, which packages show the block.** I recommend per-package opt-in
  and I am not confident. Ten packages showing "no test states a behaviour under
  this name" on most entries is a bad page. Ten packages showing nothing is a
  page that quietly exempts itself. The third option, showing the block
  everywhere and accepting the empty sentences as pressure, is the one the
  ratchet argument favours and the one a sceptical reader would respect most. I
  put it to the owner rather than deciding it.
- **Whether the "should" titles should be filtered rather than rendered.** § 8.2
  renders them. 104 `should` sentences on `/urn/api/` would read worse than
  `@evanion/acl`'s 514 statements, and decision 26 may make that moot by keeping
  urn out entirely. If both decisions go the other way, the page's quality is set
  by its weakest package.
- **The exact-match rule against a rename.** If somebody renames an export, G11
  reports the new name as missing and the old `describe` becomes an orphan
  nothing notices, because § 6 deliberately does not check that every `describe`
  names an export. I think that is the right trade and I have not seen it happen
  yet.
