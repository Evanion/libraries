# Evanion Open Source Libraries

A collection of high-quality, production-ready libraries and tools built with modern web technologies. This monorepo contains reusable components, and utilities designed to solve common development challenges.

## 📦 Libraries

### [@evanion/react-widget](./libs/widget)

A powerful React library for creating dynamic, reusable widget regions from structured data. Perfect for building CMS-driven layouts, dynamic sidebars, dashboards, and any interface that needs to render different components based on configuration data.

**Key Features:**

- 🎯 **Type-safe**: Full TypeScript support with intelligent type inference
- 🔧 **Flexible**: Support for custom chrome components and wrappers
- ⚡ **Lightweight**: Minimal bundle size with zero dependencies
- 🎨 **Customizable**: Easy theming and styling through wrapper components
- 🔄 **Context-aware**: Built-in React Context support for component sharing

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
