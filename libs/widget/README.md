# @evanion/react-widget

A powerful React library for creating dynamic, reusable widget regions from structured data. Perfect for building CMS-driven layouts, dynamic sidebars, dashboards, and any interface that needs to render different components based on configuration data.

## Features

- 🎯 **Type-safe**: Full TypeScript support with intelligent type inference
- 🔧 **Flexible**: Support for custom chrome components and wrappers
- ⚡ **Lightweight**: Minimal bundle size with zero dependencies
- 🎨 **Customizable**: Easy theming and styling through wrapper components
- 🔄 **Context-aware**: Built-in React Context support for component sharing
- 📦 **Tree-shakable**: Only import what you need

## Installation

```bash
npm install @evanion/widget
# or
yarn add @evanion/widget
# or
pnpm add @evanion/widget
```

## Quick Start

```tsx
import { createWidgets } from '@evanion/widget';
import { PropsWithChildren } from 'react';

// Define your widget components
const NewsTeaser = ({ title, publishedAt, body }: NewsProps) => (
  <article>
    <h3>{title}</h3>
    <time>{publishedAt.toLocaleDateString()}</time>
    <p>{body}</p>
  </article>
);

const UserSidebar = ({ username, avatar, messages }: UserProps) => (
  <div className="user-info">
    <img src={avatar} alt={username} />
    <span>{username}</span>
    <span>{messages} messages</span>
  </div>
);

// Create your widget configuration
const { Widgets } = createWidgets({
  components: {
    news: NewsTeaser,
    userInfo: UserSidebar,
  },
  chrome: {
    wrapper: ({ children }: PropsWithChildren) => (
      <aside className="sidebar">{children}</aside>
    ),
  },
});

// Define your widget data
const items = [
  {
    id: 'userinfo',
    type: 'userInfo',
    props: {
      username: 'Evanion',
      avatar: 'https://evanion.com/avatar.jpg',
      messages: 5,
    },
  },
  {
    id: 'news1',
    type: 'news',
    props: {
      title: 'Breaking News',
      publishedAt: new Date(),
      body: 'This is a sample news article...',
    },
  },
];

// Use in your layout
function MyLayout({ children }: PropsWithChildren) {
  return (
    <main>
      <article>{children}</article>
      <Widgets items={items} />
    </main>
  );
}
```

## API Reference

### `createWidgets<Items>(config)`

Creates a widget system with the given configuration.

#### Parameters

- `config.components` - Object mapping widget types to React components
- `config.chrome` - Optional wrapper components for styling
- `config.context` - Optional React Context for component sharing

#### Returns

- `Widgets` - Component for rendering widget items
- `WidgetsProvider` - Context provider for sharing components
- `useWidgets` - Hook for accessing widget components in context

### `Widgets` Component

Renders a list of widget items.

#### Props

- `items` - Array of widget items to render
- `components` - Optional override components for this instance
- `chrome` - Optional chrome overrides for this instance

### Widget Item Structure

```tsx
interface WidgetItem {
  id: string; // Unique identifier
  type: string; // Widget type (must match component key)
  props: object; // Props to pass to the component
  children?: WidgetItem[]; // Nested widgets (future feature)
}
```

## Advanced Usage

### Custom Chrome Components

```tsx
const { Widgets } = createWidgets({
  components: {
    /* your components */
  },
  chrome: {
    wrapper: ({ children }) => (
      <div className="widget-container">
        <header>My Widgets</header>
        <div className="widget-content">{children}</div>
      </div>
    ),
    item: ({ children }) => <div className="widget-item">{children}</div>,
  },
});
```

### Using Context for Component Sharing

```tsx
import { createContext } from 'react';

const MyWidgetContext = createContext({});

const { Widgets, WidgetsProvider } = createWidgets({
  components: {
    /* your components */
  },
  context: MyWidgetContext,
});

// Use the context in your app
function App() {
  return (
    <WidgetsProvider>
      <MyLayout />
    </WidgetsProvider>
  );
}
```

### Instance-specific Component Overrides

```tsx
function MyPage() {
  const specialNewsComponent = ({ title, ...props }) => (
    <div className="featured-news">
      <h2>Featured: {title}</h2>
    </div>
  );

  return <Widgets items={items} components={{ news: specialNewsComponent }} />;
}
```

### Nested Widgets

Use the `<Output />` component to render nested widgets within your components:

```tsx
const { Widgets, Output } = createWidgets({
  components: {
    card: CardWidget,
    text: TextWidget,
  },
});

// Card component that can contain nested widgets
const CardWidget = ({ title, Output }) => (
  <div className="card">
    <h3>{title}</h3>
    <Output />
  </div>
);

const TextWidget = ({ content }) => <p>{content}</p>;

// Usage with nested widgets
const items = [
  {
    id: 'card1',
    type: 'card',
    props: {
      title: 'My Card',
    },
    children: [
      {
        id: 'text1',
        type: 'text',
        props: { content: 'This is nested content' },
      },
    ],
  },
];
```

### Error Handling & Performance

The library includes built-in error handling and performance optimizations:

#### Error Boundaries

Each widget is automatically wrapped in an error boundary that:

- Catches rendering errors and displays a fallback UI
- Logs detailed error information to the console
- Prevents one failing widget from breaking the entire page

#### Suspense Support

Widgets support React Suspense for loading states:

- Automatic loading fallback for lazy-loaded components
- Customizable loading UI through chrome components
- Graceful handling of async operations

#### Performance Optimizations

- `React.memo` for preventing unnecessary re-renders
- `useCallback` for stable function references
- Optimized dependency arrays for `useMemo`
- Silent error handling with console warnings for unknown widget types

#### Unknown Widget Handling

When a widget type is not found:

- Logs a warning with widget type and ID
- Silently skips rendering (doesn't break the page)
- Continues rendering other widgets normally

```tsx
// Example: Custom error boundary and loading states
const CustomItem = ({ children, ...props }) => (
  <div {...props}>
    <ErrorBoundary fallback={<div>Custom error UI</div>}>
      <Suspense fallback={<div>Custom loading...</div>}>{children}</Suspense>
    </ErrorBoundary>
  </div>
);

const { Widgets } = createWidgets({
  components: {
    /* ... */
  },
  chrome: { item: CustomItem },
});
```

### TypeScript Support

The library provides full TypeScript support with type inference:

```tsx
interface NewsProps {
  title: string;
  publishedAt: Date;
  body: string;
}

interface UserProps {
  username: string;
  avatar: string;
  messages: number;
}

const { Widgets } = createWidgets<{
  news: NewsProps;
  userInfo: UserProps;
}>({
  components: {
    news: NewsTeaser,
    userInfo: UserSidebar,
  },
});

// TypeScript will now enforce correct prop types
const items = [
  {
    id: 'news1',
    type: 'news',
    props: {
      title: 'Hello World',
      publishedAt: new Date(),
      body: 'Content here',
      // TypeScript will error if any required props are missing
    },
  },
];
```

## Use Cases

- **CMS-driven layouts**: Render page content based on CMS configuration
- **Dashboard widgets**: Dynamic dashboard with configurable components
- **Sidebar content**: Dynamic sidebar with different widget types
- **Marketing pages**: A/B testing different content layouts
- **Admin panels**: Configurable admin interface components
- **E-commerce**: Dynamic product showcases and recommendations

## Examples

### E-commerce Product Showcase

```tsx
const { Widgets } = createWidgets({
  components: {
    productCard: ProductCard,
    banner: Banner,
    categoryFilter: CategoryFilter,
  },
  chrome: {
    wrapper: ({ children }) => (
      <div className="product-showcase">{children}</div>
    ),
  },
});

const showcaseItems = [
  {
    id: 'banner1',
    type: 'banner',
    props: {
      image: '/banner.jpg',
      title: 'Summer Sale',
      cta: 'Shop Now',
    },
  },
  {
    id: 'filter1',
    type: 'categoryFilter',
    props: {
      categories: ['Electronics', 'Clothing', 'Books'],
    },
  },
  {
    id: 'product1',
    type: 'productCard',
    props: {
      name: 'Wireless Headphones',
      price: 99.99,
      image: '/headphones.jpg',
    },
  },
];
```

### Blog Layout with Sidebar

```tsx
const { Widgets } = createWidgets({
  components: {
    authorBio: AuthorBio,
    relatedPosts: RelatedPosts,
    newsletterSignup: NewsletterSignup,
    socialShare: SocialShare,
  },
  chrome: {
    wrapper: ({ children }) => (
      <aside className="blog-sidebar">{children}</aside>
    ),
  },
});
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.
