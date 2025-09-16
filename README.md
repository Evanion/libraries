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

- Node.js 18+
- npm

### Getting Started

```bash
# Clone the repository
git clone https://github.com/evanion/libraries.git
cd open-source

# Install dependencies
npm install

# Start development
npm run dev
```

### Available Commands

```bash
# Build all libraries
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Type check
npm run typecheck

# Start documentation site
npm run docs:dev
```

### Project Structure

```
├── apps/
│   └── docs/                 # Documentation site
├── libs/
│   ├── widget/              # React Widget library
│   └── urn/                 # URN library
├── tools/                   # Build tools and configurations
└── docs/                    # Documentation content
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
