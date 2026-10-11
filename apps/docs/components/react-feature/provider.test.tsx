import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readRegion } from '@evanion/doc-examples/regions';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ProviderDemo from './ProviderDemo';

/**
 * The control answers what the fence above it claims.
 *
 * `react-bound` renders the same two variants for the same two customer ids and
 * claims the markup for each. The region is read here rather than restated, so
 * a weight or an id edited in the examples file fails this file instead of
 * leaving a control that disagrees with the code printed over it.
 */

const EXAMPLES = 'libs/react-feature/docs/examples.md';

const region = readRegion(
  readFileSync(join(import.meta.dirname, '../../../..', EXAMPLES), 'utf8'),
  EXAMPLES,
  'react-bound',
).code as string;

/** The button label the region claims for one customer id. */
function claimed(customerId: string): string {
  const line = region
    .split('\n')
    .find((each) => each.startsWith(`forCustomer('${customerId}')`));

  if (line === undefined) {
    throw new Error(
      `${EXAMPLES} region react-bound makes no call for ${customerId}`,
    );
  }

  const label = /<button[^>]*>([^<]*)<\/button>/.exec(line);

  if (label === null) {
    throw new Error(
      `${EXAMPLES} region react-bound claims no button for ${customerId}`,
    );
  }

  return label[1] as string;
}

describe('the bound provider control', () => {
  it('renders the label the region claims for the first customer', () => {
    render(<ProviderDemo />);

    expect(screen.getByRole('button').textContent).toBe(claimed('cust-0199'));
  });

  it('renders the other label once the reader retypes the id', () => {
    render(<ProviderDemo />);

    fireEvent.change(screen.getByLabelText('customer id'), {
      target: { value: 'cust-0042' },
    });

    expect(screen.getByRole('button').textContent).toBe(claimed('cust-0042'));
  });

  it('shows how the variant was assigned, beside the button', () => {
    render(<ProviderDemo />);

    expect(screen.getByText('weighted')).toBeTruthy();
  });
});
