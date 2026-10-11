import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readRegion } from '@evanion/doc-examples/regions';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { documented } from './bound';
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

/** The labels the store declares, read off the two ids the region documents. */
const LABELS = [...new Set(documented.map(claimed))];

/** What the control shows under one of the `<dl>` terms beside the button. */
function shown(term: string): string {
  const value = screen.getByText(term).nextElementSibling;

  if (value === null) {
    throw new Error(`the control shows no value for ${term}`);
  }

  return value.textContent ?? '';
}

/** Types one customer id into the control's input. */
function type(customerId: string): void {
  fireEvent.change(screen.getByLabelText('customer id'), {
    target: { value: customerId },
  });
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

  it('gives the first id back its own variant after a detour through the second', () => {
    render(<ProviderDemo />);

    type(documented[1]);
    type(documented[0]);

    expect(
      screen.getByRole('button').textContent,
      'The page claims the same id always lands in the same variant. A ' +
        'control that resolved the store on something other than the id ' +
        'would pass the two cases above and fail this one.',
    ).toBe(claimed(documented[0]));
  });

  it('assigns a variant the store declares to an id the page never names', () => {
    render(<ProviderDemo />);

    type('cust-0000');

    expect(
      LABELS,
      'The page claims a neighbouring id lands anywhere, so the answer for ' +
        'an id outside the pair is unknown and must still be one the store ' +
        'declares.',
    ).toContain(screen.getByRole('button').textContent);
    expect(shown('variant')).not.toBe('none');
  });

  it('buckets an empty id rather than falling back to the control', () => {
    render(<ProviderDemo />);

    type('');

    expect(
      shown('source'),
      'An empty string is a string, so the weights answer. `fallback` is for ' +
        'a context carrying no bucketing value at all, and a control that ' +
        'reported it here would be telling a reader the id was missing.',
    ).toBe('weighted');
    expect(LABELS).toContain(screen.getByRole('button').textContent);
  });

  it('shows a bucket inside the range the page states', () => {
    render(<ProviderDemo />);

    const bucket = Number(shown('bucket'));

    expect(
      Number.isFinite(bucket),
      'The page calls the bucket a number, and `none` is what the control ' +
        'shows when the assignment carries none.',
    ).toBe(true);
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(
      bucket,
      'The page states the half-open range 0 to 1, which is what the ' +
        'weights are walked against.',
    ).toBeLessThan(1);
  });

  it('names why the feature is on at all', () => {
    render(<ProviderDemo />);

    expect(
      shown('reason'),
      'The store declares the key enabled with no rules, so the reason is ' +
        'the one the core answers for that case and not a rule id.',
    ).toBe('default-on');
  });
});
