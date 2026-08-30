# Security Policy

## Reporting a Vulnerability

**Do not open a public issue for a security problem.** A public issue is visible
to everyone, including anyone who would misuse it, before there is a fix to
upgrade to.

Report it privately through GitHub's private vulnerability reporting:

**<https://github.com/Evanion/libraries/security/advisories/new>**

That opens a private advisory visible only to you and the maintainer. If you
cannot use it for any reason, email <evanion86@gmail.com> instead.

Please include:

- Which package is affected and its version.
- What an attacker can do with it — the impact, not just the mechanism.
- The smallest reproduction you can manage.

## What to Expect

- **Acknowledgement within 7 days.** This is a spare-time project, not a funded
  one; that is a realistic commitment rather than an optimistic one.
- An assessment of whether it is exploitable and how severe it is.
- A fix released to npm, and a GitHub Security Advisory published with a CVE
  where the severity warrants one.
- Credit in the advisory, unless you would rather stay anonymous.

Please give the fix a reasonable window before disclosing publicly. If you do
not hear back within 14 days, escalating publicly is fair.

## Supported Versions

This policy covers **every `@evanion/*` package published from this
repository**. It is deliberately not a list: packages get added here over time,
and a list would quietly go stale and read as if a new package were unsupported.
The authoritative set is whatever is currently published — the non-private
`package.json` files under the directories named in `nx.json`'s
`release.projects`.

Only the **latest published version** of each receives security fixes. There
are no long-term support branches. Fixes land on `main` and go out in the next
release.

## Scope

In scope: anything in a published package — code injection, prototype
pollution, an unsafe default, a dependency vulnerability that is actually
reachable through this code.

Out of scope: the docs site's content, anything in this repository that is not
published to npm (demo apps and internal tooling), vulnerabilities in
dependencies that no published code path can reach, and anything that requires
an attacker to already control the machine running the code.

## How This Repository Is Protected

For anyone auditing the supply chain:

- `main` is protected: every change goes through a pull request with maintainer
  approval and green CI. Force-pushes and branch deletion are blocked.
- Releases are published by a manually dispatched workflow, which only users
  with write access can trigger.
- npm publishing uses **trusted publishing (OIDC)**. There is no long-lived npm
  token stored in this repository, and published packages carry provenance
  attestation you can verify with `npm audit signatures`.
- Every GitHub Action is pinned to a full commit SHA, and the repository
  requires SHA pinning, so a compromised or retagged action version cannot
  silently enter the release path.
