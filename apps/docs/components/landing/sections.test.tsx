import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { productBySlug } from '../product/registry';
import { Pair } from './sections';

describe('a family section with a product page', () => {
  it('links its product page', () => {
    render(<Pair group="feature" />);
    expect(
      screen.getByRole('link', {
        name: new RegExp(productBySlug('feature-flags').frontpageLink),
      }),
    ).toHaveAttribute('href', '/feature-flags/');
  });
});
