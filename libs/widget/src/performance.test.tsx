import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWidgets } from './widget.js';

describe('Widget System - Performance', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should not re-render widgets when props have not changed', () => {
    const renderSpy = vi.fn();

    const TestWidget = ({ content }: { content: string }) => {
      renderSpy();
      return <div data-testid="test-widget">{content}</div>;
    };

    const { Widgets } = createWidgets({
      components: {
        test: TestWidget,
      },
    });

    const items = [
      {
        id: 'widget1',
        type: 'test' as const,
        props: { content: 'Static content' },
      },
    ];

    const { rerender } = render(<Widgets items={items} />);

    expect(renderSpy).toHaveBeenCalledTimes(1);

    rerender(<Widgets items={items} />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    const newItems = [
      {
        id: 'widget1',
        type: 'test' as const,
        props: { content: 'Different content' },
      },
    ];
    rerender(<Widgets items={newItems} />);
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  it('re-renders a nested subtree only when its own data changes', () => {
    const outputRenderSpy = vi.fn();

    const CardWidget = ({
      title,
      children,
    }: React.PropsWithChildren<{ title: string }>) => {
      outputRenderSpy();
      return (
        <div data-testid="card">
          <h3>{title}</h3>
          {children}
        </div>
      );
    };

    const TextWidget = ({ content }: { content: string }) => (
      <div data-testid="text">{content}</div>
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
        type: 'card' as const,
        props: { title: 'My Card' },
        children: [
          {
            id: 'text1',
            type: 'text' as const,
            props: { content: 'Nested content' },
          },
        ],
      },
    ];

    const { rerender } = render(<Widgets items={items} />);

    expect(outputRenderSpy).toHaveBeenCalledTimes(1);

    rerender(<Widgets items={items} />);
    expect(outputRenderSpy).toHaveBeenCalledTimes(1);

    const newItems = [
      {
        id: 'card1',
        type: 'card' as const,
        props: { title: 'My Card' },
        children: [
          {
            id: 'text1',
            type: 'text' as const,
            props: { content: 'Different nested content' },
          },
        ],
      },
    ];
    rerender(<Widgets items={newItems} />);
    expect(outputRenderSpy).toHaveBeenCalledTimes(2);
  });

  it('should handle large numbers of widgets efficiently', () => {
    const renderSpy = vi.fn();

    const TestWidget = ({ id }: { id: string }) => {
      renderSpy();
      return <div data-testid={`widget-${id}`}>Widget {id}</div>;
    };

    const { Widgets } = createWidgets({
      components: {
        test: TestWidget,
      },
    });

    // 50 items, which is the order of a real CMS region, sidebar or dashboard.
    // The renderer has no windowing and renders every item eagerly, so a count
    // in the thousands measures the machine rather than the library and, under
    // the CPU contention of a full `nx run-many`, exceeds vitest's 5s default
    // timeout. A genuinely large region is served by rendering a virtualized
    // component as a widget.
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: `widget-${i}`,
      type: 'test' as const,
      props: { id: String(i) },
    }));

    render(<Widgets items={items} />);

    // One render per widget, rather than an elapsed-time budget. Render count
    // is a property of the library; wall-clock time is a property of the
    // machine, and `nx run-many` schedules this suite alongside build, lint and
    // typecheck, where a threshold calibrated on an idle machine fails and
    // reads as flakiness.
    expect(renderSpy).toHaveBeenCalledTimes(50);
    expect(screen.getByTestId('widget-0')).toBeInTheDocument();
    expect(screen.getByTestId('widget-49')).toBeInTheDocument();
  });

  it('should not re-render when instance components are the same reference', () => {
    const renderSpy = vi.fn();

    const TestWidget = ({ content }: { content: string }) => {
      renderSpy();
      return <div data-testid="test-widget">{content}</div>;
    };

    const { Widgets } = createWidgets({
      components: {
        test: TestWidget,
      },
    });

    const items = [
      {
        id: 'widget1',
        type: 'test' as const,
        props: { content: 'Content' },
      },
    ];

    const instanceComponents = {
      test: TestWidget,
    };

    const { rerender } = render(
      <Widgets items={items} components={instanceComponents} />,
    );

    expect(renderSpy).toHaveBeenCalledTimes(1);

    rerender(<Widgets items={items} components={instanceComponents} />);
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('should handle rapid prop changes efficiently', () => {
    const renderSpy = vi.fn();

    const CounterWidget = ({ count }: { count: number }) => {
      renderSpy();
      return <div data-testid="counter">Count: {count}</div>;
    };

    const { Widgets } = createWidgets({
      components: {
        counter: CounterWidget,
      },
    });

    const TestComponent = () => {
      const [count, setCount] = useState(0);

      const items = [
        {
          id: 'counter1',
          type: 'counter' as const,
          props: { count },
        },
      ];

      return (
        <div>
          <Widgets items={items} />
          <button onClick={() => setCount((c) => c + 1)}>Increment</button>
        </div>
      );
    };

    render(<TestComponent />);

    expect(renderSpy).toHaveBeenCalledTimes(1);

    const button = screen.getByText('Increment');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(renderSpy).toHaveBeenCalledTimes(4); // Initial + 3 clicks
    expect(screen.getByText('Count: 3')).toBeInTheDocument();
  });

  it('should handle memoization of components correctly', () => {
    const renderSpy = vi.fn();

    const TestWidget = ({ content }: { content: string }) => {
      renderSpy();
      return <div data-testid="test-widget">{content}</div>;
    };

    const { Widgets } = createWidgets({
      components: {
        test: TestWidget,
      },
    });

    const items = [
      {
        id: 'widget1',
        type: 'test' as const,
        props: { content: 'Content' },
      },
    ];

    const { rerender } = render(<Widgets items={items} />);

    expect(renderSpy).toHaveBeenCalledTimes(1);

    rerender(<Widgets items={items} />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    const newItems = [
      {
        id: 'widget1',
        type: 'test' as const,
        props: { content: 'Different content' },
      },
    ];
    rerender(<Widgets items={newItems} />);
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  it('should handle nested widgets performance correctly', () => {
    const cardRenderSpy = vi.fn();
    const textRenderSpy = vi.fn();

    const CardWidget = ({
      title,
      children,
    }: React.PropsWithChildren<{ title: string }>) => {
      cardRenderSpy();
      return (
        <div data-testid="card">
          <h3>{title}</h3>
          {children}
        </div>
      );
    };

    const TextWidget = ({ content }: { content: string }) => {
      textRenderSpy();
      return <div data-testid="text">{content}</div>;
    };

    const { Widgets } = createWidgets({
      components: {
        card: CardWidget,
        text: TextWidget,
      },
    });

    const items = [
      {
        id: 'card1',
        type: 'card' as const,
        props: { title: 'Card 1' },
        children: [
          {
            id: 'text1',
            type: 'text' as const,
            props: { content: 'Text 1' },
          },
          {
            id: 'text2',
            type: 'text' as const,
            props: { content: 'Text 2' },
          },
        ],
      },
      {
        id: 'card2',
        type: 'card' as const,
        props: { title: 'Card 2' },
        children: [
          {
            id: 'text3',
            type: 'text' as const,
            props: { content: 'Text 3' },
          },
        ],
      },
    ];

    const { rerender } = render(<Widgets items={items} />);

    expect(cardRenderSpy).toHaveBeenCalledTimes(2); // 2 cards
    expect(textRenderSpy).toHaveBeenCalledTimes(3); // 3 text widgets

    rerender(<Widgets items={items} />);
    expect(cardRenderSpy).toHaveBeenCalledTimes(2);
    expect(textRenderSpy).toHaveBeenCalledTimes(3);
  });
});
