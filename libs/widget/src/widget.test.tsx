import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { createWidgets } from './widget';
import { PropsWithChildren } from 'react';

// Test components for our examples
const NewsTeaser = ({
  title,
  publishedAt,
  body,
}: {
  title: string;
  publishedAt: Date;
  body: string;
}) => (
  <article data-testid="news-teaser">
    <h3>{title}</h3>
    <time>{publishedAt.toLocaleDateString()}</time>
    <p>{body}</p>
  </article>
);

const UserSidebar = ({
  username,
  avatar,
  messages,
}: {
  username: string;
  avatar: string;
  messages: number;
}) => (
  <div data-testid="user-sidebar" className="user-info">
    <img src={avatar} alt={username} />
    <span>{username}</span>
    <span>{messages} messages</span>
  </div>
);

const ProductCard = ({
  name,
  price,
  image,
}: {
  name: string;
  price: number;
  image: string;
}) => (
  <div data-testid="product-card" className="product-card">
    <img src={image} alt={name} />
    <h4>{name}</h4>
    <p>${price}</p>
  </div>
);

const Banner = ({
  image,
  title,
  cta,
}: {
  image: string;
  title: string;
  cta: string;
}) => (
  <div data-testid="banner" className="banner">
    <img src={image} alt={title} />
    <h2>{title}</h2>
    <button>{cta}</button>
  </div>
);

describe('Widget System - Basic Usage', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render widgets with basic configuration', () => {
    // Example: Basic sidebar with news and user info
    const { Widgets } = createWidgets({
      components: {
        news: NewsTeaser,
        userInfo: UserSidebar,
      },
    });

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
          publishedAt: new Date('2024-01-15'),
          body: 'This is a sample news article...',
        },
      },
    ];

    render(<Widgets items={items} />);

    // Verify user sidebar is rendered
    expect(screen.getByTestId('user-sidebar')).toBeInTheDocument();
    expect(screen.getByText('Evanion')).toBeInTheDocument();
    expect(screen.getByText('5 messages')).toBeInTheDocument();

    // Verify news teaser is rendered
    expect(screen.getByTestId('news-teaser')).toBeInTheDocument();
    expect(screen.getByText('Breaking News')).toBeInTheDocument();
    expect(screen.getByText('1/15/2024')).toBeInTheDocument();
  });

  it('should handle empty items array gracefully', () => {
    const { Widgets } = createWidgets({
      components: {
        news: NewsTeaser,
      },
    });

    render(<Widgets items={[]} />);

    // Should render without errors
    expect(screen.queryByTestId('news-teaser')).not.toBeInTheDocument();
  });

  it('should skip unknown widget types', () => {
    const { Widgets } = createWidgets({
      components: {
        news: NewsTeaser,
      },
    });

    const items = [
      {
        id: 'unknown',
        type: 'unknownType',
        props: { title: 'This should not render' },
      },
      {
        id: 'news1',
        type: 'news',
        props: {
          title: 'Valid News',
          publishedAt: new Date(),
          body: 'This should render',
        },
      },
    ];

    render(<Widgets items={items} />);

    // Only the valid news should render
    expect(screen.getByTestId('news-teaser')).toBeInTheDocument();
    expect(screen.getByText('Valid News')).toBeInTheDocument();
    expect(
      screen.queryByText('This should not render')
    ).not.toBeInTheDocument();
  });
});

describe('Widget System - Custom Chrome', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render with custom wrapper chrome', () => {
    // Example: E-commerce product showcase with custom styling
    const { Widgets } = createWidgets({
      components: {
        productCard: ProductCard,
        banner: Banner,
      },
      chrome: {
        wrapper: ({ children }: PropsWithChildren) => (
          <div data-testid="product-showcase" className="product-showcase">
            <header>Featured Products</header>
            <div className="products-grid">{children}</div>
          </div>
        ),
      },
    });

    const items = [
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
        id: 'product1',
        type: 'productCard',
        props: {
          name: 'Wireless Headphones',
          price: 99.99,
          image: '/headphones.jpg',
        },
      },
    ];

    render(<Widgets items={items} />);

    // Verify custom wrapper is applied
    expect(screen.getByTestId('product-showcase')).toBeInTheDocument();
    expect(screen.getByText('Featured Products')).toBeInTheDocument();

    // Verify widgets are rendered inside the wrapper
    expect(screen.getByTestId('banner')).toBeInTheDocument();
    expect(screen.getByTestId('product-card')).toBeInTheDocument();
  });

  it('should render with custom item wrapper chrome', () => {
    // Example: Blog sidebar with custom item styling
    const { Widgets } = createWidgets({
      components: {
        news: NewsTeaser,
      },
      chrome: {
        wrapper: ({ children }: PropsWithChildren) => (
          <aside data-testid="blog-sidebar" className="blog-sidebar">
            {children}
          </aside>
        ),
        item: ({ children }: PropsWithChildren) => (
          <div data-testid="widget-item" className="widget-item">
            {children}
          </div>
        ),
      },
    });

    const items = [
      {
        id: 'news1',
        type: 'news',
        props: {
          title: 'Blog Post',
          publishedAt: new Date(),
          body: 'Content here',
        },
      },
    ];

    render(<Widgets items={items} />);

    // Verify both wrappers are applied
    expect(screen.getByTestId('blog-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('widget-item')).toBeInTheDocument();
    expect(screen.getByTestId('news-teaser')).toBeInTheDocument();
  });
});

describe('Widget System - Instance Overrides', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should allow instance-specific component overrides', () => {
    // Example: Different news components for different pages
    const { Widgets } = createWidgets({
      components: {
        news: NewsTeaser,
      },
    });

    const specialNewsComponent = ({
      title,
      ...props
    }: {
      title: string;
      publishedAt: Date;
      body: string;
    }) => (
      <div data-testid="featured-news" className="featured-news">
        <h2>Featured: {title}</h2>
        <p>Special styling for this news item</p>
      </div>
    );

    const items = [
      {
        id: 'news1',
        type: 'news',
        props: {
          title: 'Regular News',
          publishedAt: new Date(),
          body: 'Regular content',
        },
      },
    ];

    render(
      <Widgets items={items} components={{ news: specialNewsComponent }} />
    );

    // Should use the overridden component
    expect(screen.getByTestId('featured-news')).toBeInTheDocument();
    expect(screen.getByText('Featured: Regular News')).toBeInTheDocument();
    expect(
      screen.getByText('Special styling for this news item')
    ).toBeInTheDocument();
  });

  it('should allow instance-specific chrome overrides', () => {
    const { Widgets } = createWidgets({
      components: {
        news: NewsTeaser,
      },
      chrome: {
        wrapper: ({ children }: PropsWithChildren) => (
          <div data-testid="default-wrapper">Default: {children}</div>
        ),
      },
    });

    const items = [
      {
        id: 'news1',
        type: 'news',
        props: {
          title: 'News Item',
          publishedAt: new Date(),
          body: 'Content',
        },
      },
    ];

    render(
      <Widgets
        items={items}
        chrome={{
          wrapper: ({ children }: PropsWithChildren) => (
            <div data-testid="override-wrapper">Override: {children}</div>
          ),
        }}
      />
    );

    // Should use the overridden chrome
    expect(screen.getByTestId('override-wrapper')).toBeInTheDocument();
    expect(screen.getByText('Override:')).toBeInTheDocument();
    expect(screen.queryByTestId('default-wrapper')).not.toBeInTheDocument();
  });
});

describe('Widget System - Nested Widgets', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render nested widgets using Output component', () => {
    // Example: Card with nested content
    const CardWidget = ({
      title,
      Output,
    }: {
      title: string;
      Output: React.ComponentType;
    }) => (
      <div data-testid="card" className="card">
        <h3>{title}</h3>
        <Output />
      </div>
    );

    const TextWidget = ({ content }: { content: string }) => (
      <p data-testid="text">{content}</p>
    );

    const { Widgets } = createWidgets({
      components: {
        card: CardWidget,
        text: TextWidget,
      },
    });

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
            props: { content: 'Nested text content' },
          },
          {
            id: 'text2',
            type: 'text',
            props: { content: 'Another nested text' },
          },
        ],
      },
    ];

    render(<Widgets items={items} />);

    // Verify card is rendered
    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByText('My Card')).toBeInTheDocument();

    // Verify nested widgets are rendered
    const textWidgets = screen.getAllByTestId('text');
    expect(textWidgets).toHaveLength(2);
    expect(screen.getByText('Nested text content')).toBeInTheDocument();
    expect(screen.getByText('Another nested text')).toBeInTheDocument();
  });

  it('should handle empty children gracefully', () => {
    const CardWidget = ({
      title,
      Output,
    }: {
      title: string;
      Output: React.ComponentType;
    }) => (
      <div data-testid="card" className="card">
        <h3>{title}</h3>
        <Output />
      </div>
    );

    const { Widgets } = createWidgets({
      components: {
        card: CardWidget,
      },
    });

    const items = [
      {
        id: 'card1',
        type: 'card',
        props: {
          title: 'Empty Card',
        },
        children: [],
      },
    ];

    render(<Widgets items={items} />);

    // Should render without errors
    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByText('Empty Card')).toBeInTheDocument();
  });

  it('should log warnings for unknown widget types', () => {
    const consoleSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    const { Widgets } = createWidgets({
      components: {
        text: ({ content }: { content: string }) => <p>{content}</p>,
      },
    });

    const items = [
      {
        id: 'unknown1',
        type: 'unknown-widget',
        props: { content: 'This should not render' },
      },
    ];

    render(<Widgets items={items} />);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Unknown widget type "unknown-widget" for widget ID "unknown1". Skipping render.'
    );

    consoleSpy.mockRestore();
  });
});

describe('Widget System - Real World Examples', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should handle CMS-driven blog layout', () => {
    // Example: Blog with author bio, related posts, and social sharing
    const AuthorBio = ({
      name,
      bio,
      avatar,
    }: {
      name: string;
      bio: string;
      avatar: string;
    }) => (
      <div data-testid="author-bio" className="author-bio">
        <img src={avatar} alt={name} />
        <h4>{name}</h4>
        <p>{bio}</p>
      </div>
    );

    const RelatedPosts = ({
      posts,
    }: {
      posts: Array<{ title: string; url: string }>;
    }) => (
      <div data-testid="related-posts" className="related-posts">
        <h4>Related Posts</h4>
        <ul>
          {posts.map((post, index) => (
            <li key={index}>
              <a href={post.url}>{post.title}</a>
            </li>
          ))}
        </ul>
      </div>
    );

    const SocialShare = ({ platforms }: { platforms: string[] }) => (
      <div data-testid="social-share" className="social-share">
        <h4>Share</h4>
        {platforms.map((platform) => (
          <button key={platform}>{platform}</button>
        ))}
      </div>
    );

    const { Widgets } = createWidgets({
      components: {
        authorBio: AuthorBio,
        relatedPosts: RelatedPosts,
        socialShare: SocialShare,
      },
      chrome: {
        wrapper: ({ children }: PropsWithChildren) => (
          <aside data-testid="blog-sidebar" className="blog-sidebar">
            {children}
          </aside>
        ),
      },
    });

    const blogItems = [
      {
        id: 'author1',
        type: 'authorBio',
        props: {
          name: 'John Doe',
          bio: 'Tech writer and developer',
          avatar: '/author.jpg',
        },
      },
      {
        id: 'related1',
        type: 'relatedPosts',
        props: {
          posts: [
            { title: 'Previous Post', url: '/previous' },
            { title: 'Another Post', url: '/another' },
          ],
        },
      },
      {
        id: 'social1',
        type: 'socialShare',
        props: {
          platforms: ['Twitter', 'Facebook', 'LinkedIn'],
        },
      },
    ];

    render(<Widgets items={blogItems} />);

    // Verify all components are rendered
    expect(screen.getByTestId('blog-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('author-bio')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByTestId('related-posts')).toBeInTheDocument();
    expect(screen.getByText('Related Posts')).toBeInTheDocument();
    expect(screen.getByTestId('social-share')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('should handle dashboard with mixed widget types', () => {
    // Example: Admin dashboard with charts, stats, and actions
    const StatCard = ({
      title,
      value,
      trend,
    }: {
      title: string;
      value: string;
      trend: string;
    }) => (
      <div data-testid="stat-card" className="stat-card">
        <h4>{title}</h4>
        <div className="value">{value}</div>
        <div className="trend">{trend}</div>
      </div>
    );

    const ActionButton = ({
      label,
      action,
      variant,
    }: {
      label: string;
      action: string;
      variant: string;
    }) => (
      <button
        data-testid="action-button"
        className={`btn btn-${variant}`}
        data-action={action}
      >
        {label}
      </button>
    );

    const { Widgets } = createWidgets({
      components: {
        statCard: StatCard,
        actionButton: ActionButton,
      },
      chrome: {
        wrapper: ({ children }: PropsWithChildren) => (
          <div data-testid="dashboard-grid" className="dashboard-grid">
            {children}
          </div>
        ),
      },
    });

    const dashboardItems = [
      {
        id: 'stats1',
        type: 'statCard',
        props: {
          title: 'Total Users',
          value: '1,234',
          trend: '+12%',
        },
      },
      {
        id: 'stats2',
        type: 'statCard',
        props: {
          title: 'Revenue',
          value: '$45,678',
          trend: '+8%',
        },
      },
      {
        id: 'action1',
        type: 'actionButton',
        props: {
          label: 'Export Data',
          action: 'export',
          variant: 'primary',
        },
      },
    ];

    render(<Widgets items={dashboardItems} />);

    // Verify dashboard layout
    expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();

    // Verify stat cards
    const statCards = screen.getAllByTestId('stat-card');
    expect(statCards).toHaveLength(2);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$45,678')).toBeInTheDocument();

    // Verify action button
    expect(screen.getByTestId('action-button')).toBeInTheDocument();
    expect(screen.getByText('Export Data')).toBeInTheDocument();
  });
});
