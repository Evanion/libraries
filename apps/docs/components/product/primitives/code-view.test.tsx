import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CodeView } from './CodeView';

describe('CodeView', () => {
  it('renders one line per entry and marks the lit and denied ones', () => {
    const { container } = render(
      <CodeView
        label="The document"
        lines={[
          { key: 'a', content: 'one' },
          { key: 'b', content: 'two', lit: true },
          { key: 'c', content: 'three', lit: true, tone: 'deny' },
        ]}
      />,
    );
    const lines = container.querySelectorAll('.code-view__line');
    expect(lines).toHaveLength(3);
    expect(lines[0]).not.toHaveAttribute('data-lit');
    expect(lines[1]).toHaveAttribute('data-lit');
    expect(lines[2]).toHaveAttribute('data-tone', 'deny');
    expect(container.querySelector('pre')).toHaveAttribute(
      'aria-label',
      'The document',
    );
  });
});
