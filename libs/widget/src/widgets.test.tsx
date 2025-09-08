import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultWrapper, DefaultItem } from './widgets';

describe('Default Components', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render DefaultWrapper as a section element', () => {
    render(
      <DefaultWrapper data-testid="wrapper">
        <div>Test content</div>
      </DefaultWrapper>
    );

    const wrapper = screen.getByTestId('wrapper');
    expect(wrapper.tagName).toBe('SECTION');
    expect(wrapper).toHaveTextContent('Test content');
  });

  it('should pass through HTML props to DefaultWrapper', () => {
    render(
      <DefaultWrapper
        data-testid="wrapper"
        className="custom-class"
        id="test-id"
        style={{ backgroundColor: 'red' }}
      >
        <div>Test content</div>
      </DefaultWrapper>
    );

    const wrapper = screen.getByTestId('wrapper');
    expect(wrapper).toHaveClass('custom-class');
    expect(wrapper).toHaveAttribute('id', 'test-id');
    expect(wrapper).toHaveStyle('background-color: rgb(255, 0, 0)');
  });

  it('should render DefaultItem as a div element', () => {
    render(
      <DefaultItem data-testid="item">
        <span>Test content</span>
      </DefaultItem>
    );

    const item = screen.getByTestId('item');
    expect(item.tagName).toBe('DIV');
    expect(item).toHaveTextContent('Test content');
  });

  it('should pass through HTML props to DefaultItem', () => {
    render(
      <DefaultItem
        data-testid="item"
        className="item-class"
        id="item-id"
        role="listitem"
      >
        <span>Test content</span>
      </DefaultItem>
    );

    const item = screen.getByTestId('item');
    expect(item).toHaveClass('item-class');
    expect(item).toHaveAttribute('id', 'item-id');
    expect(item).toHaveAttribute('role', 'listitem');
  });

  it('should handle multiple children in DefaultWrapper', () => {
    render(
      <DefaultWrapper data-testid="wrapper">
        <div>First child</div>
        <div>Second child</div>
        <div>Third child</div>
      </DefaultWrapper>
    );

    const wrapper = screen.getByTestId('wrapper');
    expect(wrapper).toHaveTextContent('First child');
    expect(wrapper).toHaveTextContent('Second child');
    expect(wrapper).toHaveTextContent('Third child');
  });

  it('should handle multiple children in DefaultItem', () => {
    render(
      <DefaultItem data-testid="item">
        <span>First span</span>
        <span>Second span</span>
        <button>Button</button>
      </DefaultItem>
    );

    const item = screen.getByTestId('item');
    expect(item).toHaveTextContent('First span');
    expect(item).toHaveTextContent('Second span');
    expect(item).toHaveTextContent('Button');
  });

  it('should handle empty children gracefully', () => {
    render(
      <DefaultWrapper data-testid="wrapper">
        {null}
        {undefined}
        {false}
        {''}
      </DefaultWrapper>
    );

    const wrapper = screen.getByTestId('wrapper');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toBeEmptyDOMElement();
  });

  it('should handle complex nested structures', () => {
    render(
      <DefaultWrapper data-testid="wrapper">
        <DefaultItem data-testid="item1">
          <h2>Title</h2>
          <p>Description</p>
        </DefaultItem>
        <DefaultItem data-testid="item2">
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </DefaultItem>
      </DefaultWrapper>
    );

    const wrapper = screen.getByTestId('wrapper');
    const item1 = screen.getByTestId('item1');
    const item2 = screen.getByTestId('item2');

    expect(wrapper).toContainElement(item1);
    expect(wrapper).toContainElement(item2);
    expect(item1).toHaveTextContent('Title');
    expect(item1).toHaveTextContent('Description');
    expect(item2).toHaveTextContent('Item 1');
    expect(item2).toHaveTextContent('Item 2');
  });

  it('should handle widget errors gracefully with error boundary', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const FailingWidget = () => {
      throw new Error('Widget failed to render');
    };

    render(
      <DefaultItem
        data-widget-id="test-widget"
        data-widget-type="failing-widget"
      >
        <FailingWidget />
      </DefaultItem>
    );

    // Should show error fallback UI
    expect(
      screen.getByText('Widget failed to render: failing-widget')
    ).toBeInTheDocument();

    // Should log error to console
    expect(consoleSpy).toHaveBeenCalledWith(
      'Widget Error: failing-widget (ID: test-widget)',
      expect.any(Error),
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });

  it('should show loading fallback for suspense', () => {
    const LazyWidget = React.lazy(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ default: () => <div>Loaded widget</div> }),
            100
          )
        )
    );

    render(
      <DefaultItem data-widget-id="lazy-widget" data-widget-type="lazy-widget">
        <LazyWidget />
      </DefaultItem>
    );

    // Should show loading state initially
    expect(screen.getByText('Loading widget...')).toBeInTheDocument();
  });
});
