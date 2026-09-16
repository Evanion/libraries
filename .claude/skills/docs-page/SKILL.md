---
name: docs-page
description: Use when writing or retrofitting a page in apps/docs — the verification commands CI actually runs, and the failures that pass locally and break in CI.
---

# Working on a docs page

The rules live in `docs/specs/2026-09-16-documentation-standard.md`. Read the
sections that bear on the page you are touching. Do not work from a summary of
it, and do not copy parts of it into anything else: it is edited often, and a
copy goes stale in the direction that reads as authoritative.

This file is the procedure and the traps. It holds nothing the spec holds.

## Before anything

Three specs govern this area and they defer to each other rather than repeat:

- `docs/specs/2026-09-16-documentation-standard.md` — page shape, teaching
  order, the runnable requirement, guards, the retrofit order in § 13.
- `docs/specs/2026-09-16-diagrams.md` — how a diagram is authored and what it
  costs. The standard defers to this one; if they disagree, this one is right.
- `docs/specs/2026-09-13-released-by-default.md` — what version of a page a
  reader gets.

`apps/docs/AGENTS.md` carries the invariants that apply to every page.

## Pick the work from § 13, not from the page list

The retrofit is thirteen ordered steps over 62 pages, and the order is load
bearing: several steps exist because a later step mounts something an earlier
one has to create first. Taking a page because it looks easy produces work that
step 5 or step 11 then rewrites.

If you are asked for a page rather than a step, check which step it belongs to
before starting.

## Verifying

CI runs this, over every project, with no filter:

```
npx nx run-many -t lint test build typecheck check
```

Run all five targets. Scoping by `--projects` while you iterate is fine; do not
report a page as done on a subset. The recurring failure in this repo is a
local run of `test` alone reporting green on work that fails CI on `typecheck`
— the two are different targets and a test file that runs is not a test file
that compiles.

Then `npx prettier --check .`.

The cache is trustworthy for the repo-checks guards: `nx.json`'s `repoChecks`
named input hashes the workspace, so a docs edit runs them rather than replaying
a pass over content the run never read. `--skip-nx-cache` is for measuring a
build whose output you are reading, not for making a guard honest.

## Traps

Each of these has cost a round trip. None of them shows up in the output of the
thing you were running.

**A stale `dist/` reports the old signatures.** Anything that resolves
`@evanion/*` through published `exports` — the twoslash runner, the docs
typecheck — reads `libs/<pkg>/dist`, not `src`. Against a stale build, a
signature change looks like it did nothing, in either direction. Build the
library first.

**A stale `apps/docs/.next` serves the wrong page to the MDX loader.** The build
fails with one page's content parsed as another's — `capabilities.mdx` receiving
`feature/build-time.mdx`, across eight files at once — and every error names the
page that is fine. `rm -rf apps/docs/.next`.

**The stash is shared across every worktree.** `git stash` in a worktree writes
to the same list as the main checkout and every other worktree, so a bare
`git stash pop` can take an entry somebody else left there. Prefer a temporary
WIP commit. If you do stash, `git stash push -u -m "<tag>"` and then `apply` the
SHA you pushed, rather than `pop`.

**Content fences are empty in the source.** A ` ```ts file=… region=… `
block has no body in the `.mdx`; the region loader fills it at build. Anything
that reads the `.mdx` directly — a generator, an agent surface, a grep for what
an example shows — sees nothing. Expand regions first.

**`twoslash` plus any other meta word renders dead markup.** The transformer
triggers on `/\btwoslash\b/`, and Nextra injects its `Popup` component only when
the meta is exactly `twoslash`. A fence between the two renders hover markup
with no component behind it, and nothing fails.

**A `^?` query must be the last line of its fence.** The popup is absolutely
positioned, so it covers the following line rather than pushing it down.

**`.twoslash-query-presisted` is spelled that way upstream.** It is twoslash's
own typo. Correcting it silently disables the rule that gives a query room.

**`@errors:` is one-directional.** Twoslash throws on an error the fence does
not declare, and says nothing when a declared error stops occurring.
`tools/repo-checks/src/doc-twoslash.test.ts` closes the other direction; keep
that assertion when you touch the runner.

**A mermaid fence needs `caption="…"`.** A repo-check fails the page without
one. A diagram is not verified the way a region fence is — nothing fails when it
describes a flow the code no longer has — so never let a diagram be the only
place a fact is written.

## Committing

Conventional commits, scope from the package or `docs`. Squash is disabled on
this repo and merges are rebase-only, because `nx release` reads the commit
types for changelogs — so each commit on a branch has to stand on its own.

commitlint's `subject-case` rejects capitalised words in the subject, including
acronyms and `READMEs`.

`**/CHANGELOG.md` is in `.prettierignore` on purpose: nx emits trailing
whitespace that prettier collapses.

## Reporting

Say which step of § 13 the work belongs to, what you ran, and what you did not
check. A page is not done because it renders — § 7 defines done, and the guards
in § 12 say which parts of that a test can reach and which rest on a reviewer.
