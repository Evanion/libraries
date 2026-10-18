import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DecisionTree } from './DecisionTree';

describe('DecisionTree', () => {
  it('renders each node with its state and reason, nested', () => {
    const { container } = render(
      <DecisionTree
        label="Features"
        root={{
          key: 'a',
          label: 'New checkout',
          on: false,
          reason: 'switched off',
          children: [
            {
              key: 'b',
              label: 'Express pickup',
              on: false,
              reason: 'off because New checkout is off',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Express pickup')).toBeInTheDocument();
    expect(
      screen.getByText('off because New checkout is off'),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('li[data-on]')).toHaveLength(0);
    expect(container.querySelectorAll('ul ul li')).toHaveLength(1);
  });
});
