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
