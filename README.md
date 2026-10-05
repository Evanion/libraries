# Evanion Open Source Libraries

**High-performance, production-ready tools for modern web architecture.**

The `@evanion` ecosystem provides a suite of libraries designed to eliminate common architectural bottlenecks in distributed systems and complex React applications. From distributed tracing and local authorization to type-safe dynamic layouts, these tools move complexity out of your business logic and into a robust, shared infrastructure.

## 📦 Libraries

### 🛡️ Authorization & Identity
- **[`@evanion/acl`](./libs/acl)**: Local, sync'd authorization across your entire stack. Stop the network round-trips and solve the "divergent logic" problem between your frontend and backend.
- **[`@evanion/react-acl`](./libs/react-acl)**: Context-aware auth hooks for React. Escape "prop-drilling" and manage complex UI permissions without cluttering your component tree.
- **[`@evanion/urn`](./libs/urn)**: Eliminate identifier ambiguity. Replace raw, mysterious IDs with self-describing, RFC-compliant Universal Resource Names.
- **[`@evanion/token`](./libs/token)**: Human-friendly tokens with built-in error detection. Catch typos instantly and locally before they ever hit your database.
- **[`@evanion/luhn`](./libs/luhn)**: The engine behind the check-character. Generate and validate checksums over any alphabet to reject mistyped IDs instantly.

### 🧩 UI Architecture & Composition
- **[`@evanion/widget`](./libs/widget)**: Framework-agnostic structural validation for data-driven layouts. Move your UI orchestration into the data layer and catch layout errors at the edge.
- **[`@evanion/react-widget`](./libs/react-widget)**: Type-safe, dynamic widget regions for React. Render CMS-driven layouts with compile-time prop safety and RSC support.
- **[`@evanion/astro-widget`](./libs/astro-widget)**: Build-time, zero-JS widget regions for Astro. Ship pure HTML layouts with no runtime layout tax.
- **[`@evanion/compose`](./libs/compose)**: Escape "Provider Hell." Flatten nested React providers into a single, type-safe list.

### 🚀 Infrastructure & Observability
- **[`@evanion/nestjs-correlation-id`](./libs/nestjs-correlation-id)**: Transparent request tracing for NestJS. Thread a single, traceable ID through your entire microservices graph.
- **[`@evanion/feature`](./libs/feature)**: Dependency-aware feature flags. Manage complex rollout graphs where features depend on other features.

## 🛠️ Development

This monorepo is built with [Nx](https://nx.dev) for efficient development and build processes.

### Prerequisites
- Node.js (exact version in `.nvmrc`)
- npm

### Getting Started
```bash
# Clone the repository
git clone https://github.com/evanion/libraries.git
cd libraries

# Install dependencies
npm install

# Start development
npm run dev
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
npx nx run-many -t lint test build typecheck

# Only what your changes affect
npx nx affected -t lint test build typecheck

# Start the documentation site
npx nx dev docs
```

## 📖 Documentation
Visit our [documentation site](https://docs.evanion.com) for comprehensive guides, interactive examples, and full API references for every library.

## 🚀 Releasing
Packages publish from the **Release** workflow using npm trusted publishing over OIDC. See [RELEASING.md](./RELEASING.md) for the setup and the release steps.

## 🤝 Contributing
We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License
MIT License - see the [LICENSE](./LICENSE) file for details.

---
Built with ❤️ using [Nx](https://nx.dev)
