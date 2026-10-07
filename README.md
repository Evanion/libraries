# Evanion Open Source Libraries

**Focused, type-safe TypeScript libraries, one problem each.**

The `@evanion` ecosystem provides a suite of TypeScript libraries, each one aimed at a problem that recurs in distributed systems and complex React applications. From request correlation and local authorization to type-safe dynamic layouts, each package takes one of those jobs out of your business logic and into a shared, tested package.

## 📦 Libraries

### 🛡️ Authorization & Identity

- **[`@evanion/acl`](./libs/acl)**: Local, synchronous authorization across your entire stack. One serializable policy answers on the server and in the browser with no network round-trip, so your frontend and your backend evaluate the same rules. A browser decision decides what the page draws and enforces nothing, so every layer decides for itself.
- **[`@evanion/react-acl`](./libs/react-acl)**: The React binding for `@evanion/acl`: a provider and hooks over an already-built policy. Read decisions with hooks, without passing the policy, the user and the clock through props.
- **[`@evanion/urn`](./libs/urn)**: Typed, self-describing identifiers. Replace a bare `brass-birmingham` with a Uniform Resource Name such as `urn:game:brass-birmingham`, parsed and written to the RFC 8141 grammar.
- **[`@evanion/token`](./libs/token)**: Human-friendly codes with built-in error detection. The alphabet leaves out characters people misread, and a check character rejects a mistyped code before it reaches your database.
- **[`@evanion/luhn`](./libs/luhn)**: The engine behind the check character. Generate and validate a Luhn check character over an alphabet you choose: an even number of distinct characters, with no case pairs when the check ignores case. A mistyped ID is rejected locally.

### 🧩 UI Architecture & Composition

- **[`@evanion/widget`](./libs/widget)**: The framework-free core of the widget packages: the item shape, the registry and the validator. Move your layout into the data layer, and check a CMS payload in a webhook, a build script or a test, where no renderer runs.
- **[`@evanion/react-widget`](./libs/react-widget)**: Type-safe, dynamic widget regions for React. Render CMS-driven layouts with compile-time prop checks and React Server Component support.
- **[`@evanion/astro-widget`](./libs/astro-widget)**: Widget regions for Astro. Items render when Astro renders the page, and the package ships no JavaScript to the browser. Run `validateItems` in a build script to fail the build when an item names an unknown type or leaves out a prop you list as required. An `.astro` component's type carries no props for the compiler to check.
- **[`@evanion/compose`](./libs/compose)**: Replace nested React providers with one array, each provider's props checked against its component.

### 🚀 Infrastructure & Observability

- **[`@evanion/nestjs-correlation-id`](./libs/nestjs-correlation-id)**: Correlation IDs for NestJS. Thread one ID from the incoming request through everything it awaits and onto outgoing calls through the `HttpService` from `HttpModule.registerAsync(withCorrelation())`, so log lines across services name the same request.
- **[`@evanion/feature`](./libs/feature)**: Dependency-aware feature flags. Manage rollout graphs where features depend on other features: turning one flag off turns off the flags that need it. Not published to npm yet.

## 🛠️ Development

This monorepo is built with [Nx](https://nx.dev) for efficient development and build processes.

### Prerequisites

- Node.js (exact version in `.nvmrc`). Every CI job reads that file, and the npm bundled with a different patch release can disagree about whether the lockfile is valid.
- npm

### Getting Started

```bash
# Clone the repository
git clone https://github.com/evanion/libraries.git
cd libraries

# Install dependencies
npm ci

# Start the documentation site
npx nx dev docs
```

### Available Commands

Tasks run through Nx rather than root npm scripts:

```bash
# Build every library
npx nx run-many -t build

# Run tests (unit + type-level)
npx nx run-many -t test

# Lint
npx nx run-many -t lint

# Type check
npx nx run-many -t typecheck

# Everything CI runs
npx nx run-many -t lint test build typecheck check

# Only what your changes affect
npx nx affected -t lint test build typecheck check

# Start the documentation site
npx nx dev docs
```

## 📖 Documentation

Visit our [documentation site](https://docs.evanion.com) for guides, interactive examples, and full API references for every library.

## 🚀 Releasing

Packages publish from the **Release** workflow using npm trusted publishing over OIDC. There is no publish token in this repository. See [RELEASING.md](./RELEASING.md) for the setup and the release steps.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

MIT License - see the [LICENSE](./LICENSE) file for details.

---

Built with ❤️ using [Nx](https://nx.dev)
