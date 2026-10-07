# Documentation Standard for Agents

Status: companion to `docs/specs/2026-09-25-documentation-standard.md`, which
still governs. This document is the owner's preferred narrative guide: how a page
reads, in what order, and in what voice. It replaces no part of the 2026-09-25
standard. Where the two disagree, the 2026-09-25 standard is right. In
particular these still govern every page:

- the runnable requirement (§ 9): every fence is a `file=… region=…` reference
  to a doctested region, a shell command, or a fence carrying one of the five
  exemption tags (`signature` on an API reference page is one);
- the success moment (§ 6): a result the reader should see is a `// -> value`
  claim or a control the reader operates;
- the guards (§ 14) in `tools/repo-checks/src`, which no rewrite loosens;
- decision 16, the owner's ruling of 2026-09-30: a fading reminder is one clause
  and a link, a stage page's closing is written in its own words under no fixed
  heading, and an H2 section names its package in its first sentence.

Sentence rules belong to `docs/specs/2026-09-20-public-documentation-guidance.md`.

This document describes how a documentation page reads and in what order. The goal is to move away from "word salad" (disconnected technical facts) toward a natural, guided learning experience.

## 1. The Narrative Arc (Progression)

Every package's documentation must follow a three-stage progression:

### Stage 1: The Overview (`index.mdx`)

**Purpose:** Build the mental model.

- **Lead-in:** Start with the "Problem" the library solves. Why does this exist?
- **Conceptual Bridge:** Explain the core philosophy with a simple "Before vs. After" scenario. An analogy may accompany the mechanism, and never stands in for it.
- **The "What":** A clear, concise definition of what the tool is.
- **The Capability Map:** What the package can do, as a list or a table.
- **The Boundary:** What the package does not do.
- **No Install/Config:** The overview should not contain installation commands. It's for understanding, not implementing. It may carry one executed region that shows one call and what it returns.
- **The Handoff:** End by naming what the reader now understands and linking to the Setup article.

### Stage 2: The Setup (`getting-started.mdx`)

**Purpose:** Achieve a first working result.

- **The Promise:** The first sentence says what the reader will have working by the end of the page.
- **Prerequisites:** List only what is absolutely necessary to start: runtime version, module format, peer dependencies.
- **Install and Configure:** The install command in a shell fence, then the minimum configuration that runs. An optional parameter is marked optional or left for a deep-dive.
- **Incremental Wins:** Break the setup into small, verifiable steps. Every step should result in a visible change or a successful test.
- **The "Aha!" Moment:** The user sees the tool work in their own project, as a result on the page: a `// -> value` claim or a control they operate.
- **The Next Task:** End by naming what the reader now has running and linking to one deep-dive that teaches the next task.

### Stage 3: Deep Dives (Feature Pages)

**Purpose:** Mastery of specific components.

- **Contextual Entry:** Assume the reader arrived via search. Start with one sentence that names the task and the call that performs it.
- **Problem → Solution:** Present a common challenge, then show how the feature solves it.
- **Cumulative Learning:** Use concepts from the Overview/Setup, and fade the support: a concept the page before introduced gets a "fading reminder" (one clause and a link), the page after that gets the linked name alone, and later pages get none.

## 2. Structural Rules

### Titles and Headings

- **H1:** One per page. The package name on the Overview (e.g., `@evanion/acl`), and the clear name of the guide on every other page (e.g., `Getting Started`).
- **H2:** Must be standalone. An H2 section should be understandable if read in isolation. Avoid pronouns whose referents are in previous sections, and name the package in the section's first sentence.
- **Action-Oriented:** On a teaching page, prefer "How to X" or "Setting up X" over "X Configuration." An API reference page takes one heading per exported symbol, spelled as the symbol.

### Content Flow

- **The Lead-in Rule:** Never drop the reader into a technical detail without a lead-in.
  - _Bad:_ "The `policy()` function takes three type parameters..."
  - _Good:_ "To define who can access your data, you start by creating a policy. The `policy()` function handles this by..."
- **Results over Descriptions:** Instead of saying "This function returns a decision," show the result: `access.can(bookseller, 'question', 'delete', question).allowed; // -> true`. The claim lives in a README region whose fence carries `@import.meta.vitest`, so CI checks the value the page shows.

## 3. Agent Checklist for Rewrites

When rewriting a page, ask:

1. **Where does the reader come from?** (Overview → Setup → Deep Dive).
2. **Is there a lead-in?** Does the first sentence do its stage's job? The Overview names the problem, the Setup says what will be working, and a deep-dive names the task and its call.
3. **Is it a "word salad"?** Are there sentences that are disconnected facts? Connect them into a narrative. Parallel facts (a member surface, a list of options, prerequisites) go in a list or a table.
4. **Is the H2 standalone?** Can a search engine user find this section and understand it immediately?
