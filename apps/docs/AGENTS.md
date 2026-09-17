<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Diagrams

A ```mermaid fence renders as a figure in the site's own colours. `caption="…"`
on the fence is required and a repo-check fails the page without one.

A diagram here is **not verified**. A `file=… region=…` fence is: the region has
to exist and its values came from a test run. Nothing fails when a diagram
describes a flow the code no longer has. So never let a diagram be the only place
a fact is written — it is drawn in the browser, which also means search does not
index it and a reader with no JavaScript never sees it.

`docs/specs/2026-09-16-diagrams.md` has the rest: `:::accent`, why the palette
works the way it does, and which pictures want Twoslash or box-drawing
characters instead.

# Pages

`docs/specs/2026-09-16-documentation-standard.md` is the standard. Read the
sections that bear on the page you are touching rather than working from a
summary, and do not copy parts of it anywhere: it is edited often and a copy
goes stale in the direction that reads as authoritative.

Four things hold on every page, and they are the ones easiest to violate by
accident:

**Teaching pages are cumulative, and support fades rather than stops.** A page
may use what an earlier page taught. A concept introduced on one page carries a
short reminder on the next, a shorter one after that, and none thereafter.
Assuming it silently is the rule Carroll shipped, tested, and replaced.

**A link costs a reader a thread, and only a reader who has one can be charged
for it.** On a teaching page a link out is that cost. On a reference page,
question page or platform guide the link is the point, and re-teaching inline is
the error.

**An H2 section has to stand on its own.** Retrieval hands an agent a section,
not a page: no pronoun whose referent is in a previous section, a heading that
names the package as well as the operation, and a fact kept next to the sentence
that uses it.

**A playground does not replace prose.** Text, diagrams and code teach the
concept; the interactive control is where a reader takes that concept and works
it. A page that explains only by letting the reader poke at something has not
explained it.

`.claude/skills/docs-page/SKILL.md` has the procedure — the retrofit order, what
CI actually runs, and the failures that pass locally.
