# docs-redirect-worker

Answers every request to `docs.evanion.com` with a `301` to the same page on `libs.evanion.com/docs`, keeping the query. `src/redirect.js` holds the mapping.

Deploy from this directory with `npx wrangler deploy`, after the Pages custom domain has moved to `libs.evanion.com`. `npx wrangler deploy --dry-run` checks the bundle without deploying.
