# Documentation Standard for Agents

This document defines the structural and narrative standards for all documentation in the codebase. The goal is to move away from "word salad" (disconnected technical facts) toward a natural, guided learning experience.

## 1. The Narrative Arc (Progression)

Every package's documentation must follow a three-stage progression:

### Stage 1: The Overview (`index.mdx`)
**Purpose:** Build the mental model.
- **Lead-in:** Start with the "Problem" the library solves. Why does this exist?
- **Conceptual Bridge:** Explain the core philosophy. Use a high-level analogy or a simple "Before vs. After" scenario.
- **The "What":** A clear, concise definition of what the tool is.
- **No Install/Config:** The overview should not contain installation commands. It's for understanding, not implementing.

### Stage 2: The Setup (`getting-started.mdx`)
**Purpose:** Achieve a first working result.
- **The Promise:** Start with a clear goal. "In this guide, you will build X."
- **Prerequisites:** List only what is absolutely necessary to start.
- **Incremental Wins:** Break the setup into small, verifiable steps. Every step should result in a visible change or a successful test.
- **The "Aha!" Moment:** End the page with the user seeing the tool work in their own project.

### Stage 3: Deep Dives (Feature Pages)
**Purpose:** Mastery of specific components.
- **Contextual Entry:** Assume the reader arrived via search. Start with a 1-2 sentence explanation of what this specific feature is and when to use it.
- **Problem $\rightarrow$ Solution:** Present a common challenge, then show how the feature solves it.
- **Cumulative Learning:** Use concepts from the Overview/Setup, but provide a "fading reminder" (a brief clause and a link) if the concept was introduced several pages ago.

## 2. Structural Rules

### Titles and Headings
- **H1:** Must be the name of the package or the clear name of the guide (e.g., `@evanion/acl` or `Getting Started`).
- **H2:** Must be standalone. An H2 section should be understandable if read in isolation. Avoid pronouns whose referents are in previous sections.
- **Action-Oriented:** Prefer "How to X" or "Setting up X" over "X Configuration."

### Content Flow
- **The "BAM" Rule:** Never drop the reader into a technical detail without a lead-in. 
  - *Bad:* "The `policy()` function takes two generics..."
  - *Good:* "To define who can access your data, you start by creating a policy. The `policy()` function handles this by..."
- **Results over Descriptions:** Instead of saying "This function returns a boolean," show the result: `const allowed = access.can(...); // -> true`.

## 3. Agent Checklist for Rewrites

When rewriting a page, ask:
1. **Where does the reader come from?** (Overview $\rightarrow$ Setup $\rightarrow$ Deep Dive).
2. **Is there a lead-in?** Does the first paragraph explain the "Why" before the "How"?
3. **Is it a "word salad"?** Are there sentences that are just lists of facts? Convert them into a narrative.
4. **Is the H2 standalone?** Can a search engine user find this section and understand it immediately?
