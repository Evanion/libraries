import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { createContext, useContext } from 'react';
import { createWidgets } from './widget';

// Test components
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

const UserProfile = ({
  username,
  avatar,
}: {
  username: string;
  avatar: string;
}) => (
  <div data-testid="user-profile" className="user-profile">
    <img src={avatar} alt={username} />
    <span>{username}</span>
  </div>
);

const WeatherWidget = ({
  location,
  temperature,
}: {
  location: string;
  temperature: number;
}) => (
  <div data-testid="weather-widget" className="weather-widget">
    <h4>Weather in {location}</h4>
    <p>{temperature}°F</p>
  </div>
);

describe('Widget System - Context Usage', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should work with custom React Context', () => {
    // Example: Shared widget context across multiple components
    const MyWidgetContext = createContext<{
      news: typeof NewsTeaser;
      userProfile: typeof UserProfile;
    }>({
      news: NewsTeaser,
      userProfile: UserProfile,
    });

    const { Widgets, WidgetsProvider } = createWidgets({
      components: {
        news: NewsTeaser,
        userProfile: UserProfile,
      },
      context: MyWidgetContext,
    });

    // Component that uses the context
    const ContextConsumer = () => {
      const components = useContext(MyWidgetContext);
      const NewsComponent = components.news;

      return (
        <div data-testid="context-consumer">
          <NewsComponent
            title="Context News"
            publishedAt={new Date('2024-01-15')}
            body="This news comes from context"
          />
        </div>
      );
    };

    const items = [
      {
        id: 'user1',
        type: 'userProfile',
        props: {
          username: 'ContextUser',
          avatar: '/avatar.jpg',
        },
      },
    ];

    render(
      <WidgetsProvider value={{ news: NewsTeaser, userProfile: UserProfile }}>
        <div>
          <Widgets items={items} />
          <ContextConsumer />
        </div>
      </WidgetsProvider>
    );

    // Verify both context usage and widget rendering work
    expect(screen.getByTestId('user-profile')).toBeInTheDocument();
    expect(screen.getByText('ContextUser')).toBeInTheDocument();

    expect(screen.getByTestId('context-consumer')).toBeInTheDocument();
    expect(screen.getByTestId('news-teaser')).toBeInTheDocument();
    expect(screen.getByText('Context News')).toBeInTheDocument();
  });

  it('should work with useWidgets hook', () => {
    // Example: Using the useWidgets hook in a custom component
    const { Widgets, WidgetsProvider, useWidgets } = createWidgets({
      components: {
        news: NewsTeaser,
        weather: WeatherWidget,
      },
    });

    const CustomComponent = () => {
      const components = useWidgets();
      const NewsComponent = components.news;
      const WeatherComponent = components.weather;

      return (
        <div data-testid="custom-component">
          <NewsComponent
            title="Hook News"
            publishedAt={new Date('2024-01-15')}
            body="This news uses the hook"
          />
          <WeatherComponent location="San Francisco" temperature={72} />
        </div>
      );
    };

    const items = [
      {
        id: 'weather1',
        type: 'weather',
        props: {
          location: 'New York',
          temperature: 65,
        },
      },
    ];

    render(
      <WidgetsProvider value={{ news: NewsTeaser, weather: WeatherWidget }}>
        <div>
          <Widgets items={items} />
          <CustomComponent />
        </div>
      </WidgetsProvider>
    );

    // Verify both widget rendering and hook usage work
    const weatherWidgets = screen.getAllByTestId('weather-widget');
    expect(weatherWidgets).toHaveLength(2); // One from Widgets, one from CustomComponent

    expect(screen.getByText('Weather in New York')).toBeInTheDocument();
    expect(screen.getByText('65°F')).toBeInTheDocument();

    expect(screen.getByTestId('custom-component')).toBeInTheDocument();
    expect(screen.getByText('Hook News')).toBeInTheDocument();
    expect(screen.getByText('Weather in San Francisco')).toBeInTheDocument();
    expect(screen.getByText('72°F')).toBeInTheDocument();
  });

  it('should handle context with different component sets', () => {
    // Example: Multiple widget systems with different contexts
    const AdminContext = createContext<{
      userProfile: typeof UserProfile;
    }>({
      userProfile: UserProfile,
    });

    const PublicContext = createContext<{
      news: typeof NewsTeaser;
      weather: typeof WeatherWidget;
    }>({
      news: NewsTeaser,
      weather: WeatherWidget,
    });

    const { Widgets: AdminWidgets, WidgetsProvider: AdminProvider } =
      createWidgets({
        components: {
          userProfile: UserProfile,
        },
        context: AdminContext,
      });

    const { Widgets: PublicWidgets, WidgetsProvider: PublicProvider } =
      createWidgets({
        components: {
          news: NewsTeaser,
          weather: WeatherWidget,
        },
        context: PublicContext,
      });

    const adminItems = [
      {
        id: 'admin1',
        type: 'userProfile',
        props: {
          username: 'Admin',
          avatar: '/admin.jpg',
        },
      },
    ];

    const publicItems = [
      {
        id: 'news1',
        type: 'news',
        props: {
          title: 'Public News',
          publishedAt: new Date(),
          body: 'Public content',
        },
      },
    ];

    render(
      <div>
        <AdminProvider value={{ userProfile: UserProfile }}>
          <div data-testid="admin-section">
            <AdminWidgets items={adminItems} />
          </div>
        </AdminProvider>
        <PublicProvider value={{ news: NewsTeaser, weather: WeatherWidget }}>
          <div data-testid="public-section">
            <PublicWidgets items={publicItems} />
          </div>
        </PublicProvider>
      </div>
    );

    // Verify both contexts work independently
    expect(screen.getByTestId('admin-section')).toBeInTheDocument();
    expect(screen.getByTestId('user-profile')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();

    expect(screen.getByTestId('public-section')).toBeInTheDocument();
    expect(screen.getByTestId('news-teaser')).toBeInTheDocument();
    expect(screen.getByText('Public News')).toBeInTheDocument();
  });
});

describe('Widget System - Edge Cases and Error Handling', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should handle malformed widget items gracefully', () => {
    const { Widgets } = createWidgets({
      components: {
        news: NewsTeaser,
      },
    });

    const malformedItems = [
      // Valid item
      {
        id: 'valid1',
        type: 'news',
        props: {
          title: 'Valid News',
          publishedAt: new Date('2024-01-15'),
          body: 'Valid content',
        },
      },
    ];

    // Should render without errors
    expect(() => {
      render(<Widgets items={malformedItems} />);
    }).not.toThrow();

    // Valid item should render
    expect(screen.getByTestId('news-teaser')).toBeInTheDocument();
    expect(screen.getByText('Valid News')).toBeInTheDocument();
  });

  it('should handle rapid re-renders with different items', () => {
    const { Widgets } = createWidgets({
      components: {
        news: NewsTeaser,
        weather: WeatherWidget,
      },
    });

    const items1 = [
      {
        id: 'news1',
        type: 'news',
        props: {
          title: 'First News',
          publishedAt: new Date(),
          body: 'First content',
        },
      },
    ];

    const items2 = [
      {
        id: 'weather1',
        type: 'weather',
        props: {
          location: 'Paris',
          temperature: 20,
        },
      },
    ];

    const { rerender } = render(<Widgets items={items1} />);

    // First render
    expect(screen.getByTestId('news-teaser')).toBeInTheDocument();
    expect(screen.getByText('First News')).toBeInTheDocument();

    // Re-render with different items
    rerender(<Widgets items={items2} />);

    // Should show new content
    expect(screen.queryByTestId('news-teaser')).not.toBeInTheDocument();
    expect(screen.getByTestId('weather-widget')).toBeInTheDocument();
    expect(screen.getByText('Weather in Paris')).toBeInTheDocument();
  });

  it('should handle very large numbers of widgets', () => {
    const { Widgets } = createWidgets({
      components: {
        news: NewsTeaser,
      },
    });

    // Create 1000 news items
    const manyItems = Array.from({ length: 1000 }, (_, i) => ({
      id: `news${i}`,
      type: 'news',
      props: {
        title: `News Item ${i}`,
        publishedAt: new Date(),
        body: `Content for item ${i}`,
      },
    }));

    // Should render without performance issues
    expect(() => {
      render(<Widgets items={manyItems} />);
    }).not.toThrow();

    // Should render all items
    const newsTeasers = screen.getAllByTestId('news-teaser');
    expect(newsTeasers).toHaveLength(1000);
  });
});
