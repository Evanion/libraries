import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultWrapper, DefaultItem } from './widgets.js';

describe('Default Components', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('DefaultWrapper', () => {
    it('renders as a section element', () => {
      render(
        <DefaultWrapper data-testid="wrapper">
          <div>Test content</div>
        </DefaultWrapper>,
      );

      const wrapper = screen.getByTestId('wrapper');
      expect(wrapper.tagName).toBe('SECTION');
      expect(wrapper).toHaveTextContent('Test content');
    });

    it('passes HTML props through to the section', () => {
      render(
        <DefaultWrapper
          data-testid="wrapper"
          className="custom-class"
          id="test-id"
          style={{ backgroundColor: 'red' }}
        >
          <div>Test content</div>
        </DefaultWrapper>,
      );

      const wrapper = screen.getByTestId('wrapper');
      expect(wrapper).toHaveClass('custom-class');
      expect(wrapper).toHaveAttribute('id', 'test-id');
      expect(wrapper).toHaveStyle('background-color: rgb(255, 0, 0)');
    });
  });

  describe('DefaultItem', () => {
    it('renders as a div element', () => {
      render(
        <DefaultItem data-testid="item">
          <span>Test content</span>
        </DefaultItem>,
      );

      const item = screen.getByTestId('item');
      expect(item.tagName).toBe('DIV');
      expect(item).toHaveTextContent('Test content');
    });

    it('passes HTML props through to the div', () => {
      render(
        <DefaultItem
          data-testid="item"
          className="item-class"
          id="item-id"
          role="listitem"
        >
          <span>Test content</span>
        </DefaultItem>,
      );

      const item = screen.getByTestId('item');
      expect(item).toHaveClass('item-class');
      expect(item).toHaveAttribute('id', 'item-id');
      expect(item).toHaveAttribute('role', 'listitem');
    });
  });

  describe('DefaultWrapper', () => {
    it('renders every child the section is given', () => {
      render(
        <DefaultWrapper data-testid="wrapper">
          <div>First child</div>
          <div>Second child</div>
          <div>Third child</div>
        </DefaultWrapper>,
      );

      const wrapper = screen.getByTestId('wrapper');
      expect(wrapper).toHaveTextContent('First child');
      expect(wrapper).toHaveTextContent('Second child');
      expect(wrapper).toHaveTextContent('Third child');
    });
  });

  describe('DefaultItem', () => {
    it('renders every child the div is given', () => {
      render(
        <DefaultItem data-testid="item">
          <span>First span</span>
          <span>Second span</span>
          <button>Button</button>
        </DefaultItem>,
      );

      const item = screen.getByTestId('item');
      expect(item).toHaveTextContent('First span');
      expect(item).toHaveTextContent('Second span');
      expect(item).toHaveTextContent('Button');
    });
  });

  describe('DefaultWrapper', () => {
    it('renders an empty section when every child is nullish', () => {
      render(
        <DefaultWrapper data-testid="wrapper">
          {null}
          {undefined}
          {false}
          {''}
        </DefaultWrapper>,
      );

      const wrapper = screen.getByTestId('wrapper');
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toBeEmptyDOMElement();
    });

    it('renders a nested tree of items and their own children', () => {
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
        </DefaultWrapper>,
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
  });
});
