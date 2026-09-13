# Evanion Open Source Libraries

A collection of high-quality, production-ready libraries and tools built with modern web technologies. This monorepo contains reusable components, and utilities designed to solve common development challenges.

## 📦 Libraries

### [@evanion/widget](./libs/widget)

The framework-free half of a widget region: the item shape, the registry and the validator every widget renderer shares. It renders nothing and imports no framework, so it also runs where no renderer does — a webhook checking a CMS payload, a build script, a test.

**Key Features:**

- 🧱 **One item shape**: the same array renders through every renderer below
- 🛡️ **Validation**: structural checks plus a map of props each type must supply
- 🌍 **Universal**: no framework import at all, enforced by the packaging check
- 🪶 **Zero dependencies**

### [@evanion/react-widget](./libs/react-widget)

The React renderer. Dynamic, reusable widget regions from structured data, for CMS-driven layouts, dynamic sidebars, dashboards, and any interface that renders different components from configuration data.

**Key Features:**

- 🎯 **Type-safe**: an item's `props` are checked against its component at compile time
- 🔧 **Flexible**: custom chrome per item and per region, the region chrome told what is in it
- ⚡ **Server-component ready**: no `'use client'`, no context, importable from an RSC
- 🎨 **Customizable**: placement travels in `meta`, which never reaches a widget

### [@evanion/compose](./libs/compose)

A React component that gets you out of provider hell by flattening nested providers into a single, readable list — with the props of each provider checked against its component.

**Key Features:**

- 🧩 **Flat**: Replace a pyramid of nested providers with one array
- 🎯 **Type-safe**: Missing, wrong, or unknown provider props are compile errors
- 🔤 **Two APIs**: `provider()` for full IntelliSense, or plain tuples for brevity
- 📖 **Natural order**: The first provider is the outermost, matching how you'd nest them
- 🪶 **Zero dependencies**

### [@evanion/urn](./libs/urn)

A URN Library that makes it easier to work with more meaningful identifiers. The API is inspired by, and designed to be as simple as the JSON class.

**Key Features:**

- 📝 **Simple API**: JSON-inspired API for easy adoption
- 🔍 **URN Parsing**: Parse URN strings into structured components
- 🏗️ **URN Stringifying**: Create URN strings from components
- 🎨 **Custom Schemes**: Support for custom URN schemes beyond the standard `urn:`
- 🏷️ **Namespace Support**: Handle custom namespaces and identifiers
- 🔧 **Class Inheritance**: Extend the base URN class for domain-specific implementations

## 🛠️ Development

This monorepo is built with [Nx](https://nx.dev) for efficient development and build processes.

### Prerequisites

- Node.js 20+ (CI runs 24; see `.nvmrc`)
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

### Project Structure

```
├── apps/
│   └── docs/                # Documentation site (Next.js + Nextra)
└── libs/
    ├── compose/             # Provider composition
    ├── urn/                 # URN library
    └── widget/              # React Widget library
```

## 📖 Documentation

Visit our [documentation site](https://docs.evanion.com) for:

- 📚 **Comprehensive guides** for each library
- 🎮 **Interactive examples** and playgrounds
- 📋 **API references** with TypeScript definitions
- 🚀 **Getting started** tutorials

## 🚀 Releasing

Packages publish from the **Release** workflow using npm trusted publishing over
OIDC — there is no publish token in this repository. See
[RELEASING.md](./RELEASING.md) for the setup and the release steps.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on:

- 🐛 **Reporting bugs**
- 💡 **Suggesting features**
- 🔧 **Submitting pull requests**
- 📝 **Improving documentation**

## 📄 License

These projects are licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🔗 Links

- 📖 **Documentation**: [docs.evanion.com](https://docs.evanion.com)
- 🐛 **Issues**: [GitHub Issues](https://github.com/evanion/libraries/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/evanion/libraries/discussions)

---

Built with ❤️ using [Nx](https://nx.dev)
