# Releasing

Publishing runs through the **Release** workflow
(`.github/workflows/release.yml`), authenticated with npm **trusted publishing**
over OIDC. There is no `NPM_TOKEN` secret in this repository and there should
never be one.

## Why no token

npm is retiring the credential CI used to rely on:

- Since **2026-07-31**, bypass-2FA granular access tokens can no longer change
  package access, maintainers, or trusted publishing configuration.
- **Direct publish** from a bypass-2FA token is targeted for removal in
  **January 2027**.

A token that _requires_ 2FA is not an alternative — 2FA is an interactive
challenge, so unattended automation cannot answer it. Trusted publishing solves
this by removing the long-lived credential entirely: the npm CLI exchanges the
GitHub Actions OIDC token for publish rights that are short-lived and scoped to
this repository and this workflow filename.

It also means provenance is generated automatically, with no `--provenance` flag.

## One-time setup

### 1. Configure a trusted publisher per package

On npmjs.com, for **each** package, under _Settings → Trusted Publisher_:

| Field             | Value             |
| ----------------- | ----------------- |
| Organization/user | `Evanion`         |
| Repository        | `libraries`       |
| Workflow filename | `release.yml`     |
| Environment       | _(leave empty)_   |
| Allowed actions   | **`npm publish`** |

Two things to get right:

- The workflow filename is matched **by name**, not path. Renaming
  `release.yml` breaks publishing until this config is updated.
- Configurations created after 2026-05-20 must explicitly select at least one
  allowed action. Pick `npm publish`. Do **not** select stage-only —
  `nx release publish` runs a plain `npm publish` and a stage-only publisher
  would reject it.

### 2. Bootstrap `@evanion/react-widget`

npm will not let you configure a trusted publisher for a package that does not
exist yet, and `@evanion/react-widget` has never been published. It needs one
manual publish first, from a maintainer's machine with their own 2FA:

```bash
npm login                       # if not already authenticated
npx nx run-many -t build
npm run verify:packaging        # same check CI runs before publishing
cd libs/<name>
npm publish --access public --no-provenance --otp=<code-from-your-authenticator>
```

Both extra flags are needed:

- `--no-provenance` overrides `publishConfig.provenance: true`, which fails
  locally with _"Automatic provenance generation not supported for provider:
  null"_ because provenance requires a CI provider. That setting is a deliberate
  guardrail against accidental local publishing, so a bootstrap has to opt out of
  it explicitly. The published version will have no attestation — this is the one
  unavoidable cost of bootstrapping, and every release after it is attested.
- `--otp` avoids npm's browser auth flow. That flow is worth avoiding here: npm
  redacts the auth URL to `***` whenever stdout is not a TTY, so it is
  unrecoverable from any captured output or from npm's own debug log. It only
  appears in a live terminal. If your 2FA is web-only rather than TOTP, run the
  publish in a real terminal rather than through a tool that captures output.

Then configure its trusted publisher as above. Every subsequent release goes
through OIDC.

`@evanion/compose`, `@evanion/urn` and `@evanion/react-widget` all exist on npm
now, so no further bootstrapping is needed — configure their trusted publishers
and they are ready. The steps above are kept for the next new package added to
this repo.

## Cutting a release

1. Land the work on `main`. Commits must be
   [conventional](./CONTRIBUTING.md) — the version bump is inferred from them.

   **Breaking changes need a `BREAKING CHANGE:` footer.** Without it a breaking
   change is inferred as a minor bump. This is not hypothetical: the first
   release from this repo had to have its versions set by hand, because the
   migration commits described breaking changes in prose without the footer and
   `nx release` proposed minor bumps for all three packages.

2. Run **Release** with `dry-run: true`. Check the proposed versions, changelog
   entries and tag names.

3. Re-run with `dry-run: false`.

`first-release: true` is only needed when a package has no git tag yet. It tells
`nx release` not to look for a previous tag and not to check whether the version
already exists on the registry.

## Verifying a release worked

```bash
npm view @evanion/compose version
npm view @evanion/compose dist.attestations   # non-null means provenance landed
npm view @evanion/compose repository          # should point at Evanion/libraries
```

`dist.attestations` returning `null` means the package published without
provenance — the OIDC exchange did not happen. Check that `id-token: write` is
still granted and that the trusted publisher's workflow filename still matches.

## If a release fails

- **`ENEEDAUTH` / 401 on publish** — usually the trusted publisher is not
  configured for that package, or its workflow filename no longer matches.
- **Publishing works but `dist.attestations` is `null`** — the CLI fell back to
  something other than OIDC. Check the npm version guard step passed.
- **`nx release` proposes the wrong version** — a breaking change is missing its
  `BREAKING CHANGE:` footer. Fix the version by hand for that release rather
  than publishing a wrong one; npm versions are immutable.
