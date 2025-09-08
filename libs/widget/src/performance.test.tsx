import React, { useState, useCallback, useMemo } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWidgets } from './widget';

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
        type: 'test',
        props: { content: 'Static content' },
      },
    ];

    const { rerender } = render(<Widgets items={items} />);

    // Initial render
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // Re-render with same props - should not cause widget to re-render
    rerender(<Widgets items={items} />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // Re-render with different items - should cause re-render
    const newItems = [
      {
        id: 'widget1',
        type: 'test',
        props: { content: 'Different content' },
      },
    ];
    rerender(<Widgets items={newItems} />);
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  it('should memoize Output components correctly', () => {
    const outputRenderSpy = vi.fn();

    const CardWidget = ({
      title,
      Output,
    }: {
      title: string;
      Output: React.ComponentType;
    }) => {
      outputRenderSpy();
      return (
        <div data-testid="card">
          <h3>{title}</h3>
          <Output />
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
        type: 'card',
        props: { title: 'My Card' },
        children: [
          {
            id: 'text1',
            type: 'text',
            props: { content: 'Nested content' },
          },
        ],
      },
    ];

    const { rerender } = render(<Widgets items={items} />);

    // Initial render
    expect(outputRenderSpy).toHaveBeenCalledTimes(1);

    // Re-render with same items - should not cause re-render
    rerender(<Widgets items={items} />);
    expect(outputRenderSpy).toHaveBeenCalledTimes(1);

    // Re-render with different children - should cause re-render
    const newItems = [
      {
        id: 'card1',
        type: 'card',
        props: { title: 'My Card' },
        children: [
          {
            id: 'text1',
            type: 'text',
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

    // Create 1000 widgets
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: `widget-${i}`,
      type: 'test',
      props: { id: i },
    }));

    const startTime = performance.now();
    render(<Widgets items={items} />);
    const endTime = performance.now();

    // Should render all widgets
    expect(renderSpy).toHaveBeenCalledTimes(1000);
    expect(screen.getByTestId('widget-0')).toBeInTheDocument();
    expect(screen.getByTestId('widget-999')).toBeInTheDocument();

    // Should complete in reasonable time (less than 1 second)
    expect(endTime - startTime).toBeLessThan(1000);
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
        type: 'test',
        props: { content: 'Content' },
      },
    ];

    const instanceComponents = {
      test: TestWidget,
    };

    const { rerender } = render(
      <Widgets items={items} components={instanceComponents} />
    );

    // Initial render
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // Re-render with same instance components reference - should not cause re-render
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
          type: 'counter',
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

    // Initial render
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // Click button multiple times rapidly
    const button = screen.getByText('Increment');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    // Should only re-render when count actually changes
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
        type: 'test',
        props: { content: 'Content' },
      },
    ];

    const { rerender } = render(<Widgets items={items} />);

    // Initial render
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // Re-render with same items - should not cause re-render due to memoization
    rerender(<Widgets items={items} />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // Re-render with different items - should cause re-render
    const newItems = [
      {
        id: 'widget1',
        type: 'test',
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
      Output,
    }: {
      title: string;
      Output: React.ComponentType;
    }) => {
      cardRenderSpy();
      return (
        <div data-testid="card">
          <h3>{title}</h3>
          <Output />
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
        type: 'card',
        props: { title: 'Card 1' },
        children: [
          {
            id: 'text1',
            type: 'text',
            props: { content: 'Text 1' },
          },
          {
            id: 'text2',
            type: 'text',
            props: { content: 'Text 2' },
          },
        ],
      },
      {
        id: 'card2',
        type: 'card',
        props: { title: 'Card 2' },
        children: [
          {
            id: 'text3',
            type: 'text',
            props: { content: 'Text 3' },
          },
        ],
      },
    ];

    const { rerender } = render(<Widgets items={items} />);

    // Initial render
    expect(cardRenderSpy).toHaveBeenCalledTimes(2); // 2 cards
    expect(textRenderSpy).toHaveBeenCalledTimes(3); // 3 text widgets

    // Re-render with same items - should not cause re-renders
    rerender(<Widgets items={items} />);
    expect(cardRenderSpy).toHaveBeenCalledTimes(2);
    expect(textRenderSpy).toHaveBeenCalledTimes(3);
  });
});
