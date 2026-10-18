import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DemoLayout } from './DemoLayout';

describe('DemoLayout', () => {
  it('renders controls before code and applies the class', () => {
    const { container } = render(
      <DemoLayout
        className="extra"
        controls={<button type="button">controls</button>}
        code={<pre>code</pre>}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass('demo-layout', 'extra');
    const [first, second] = Array.from(root.children);
    expect(first).toHaveClass('demo-layout__controls');
    expect(second).toHaveClass('demo-layout__code');
    expect(first).toContainElement(screen.getByText('controls'));
    expect(second).toContainElement(screen.getByText('code'));
  });
});
