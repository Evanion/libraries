import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pair } from './sections';

describe('a family section with a product page', () => {
  it('links its product page', () => {
    render(<Pair group="feature" />);
    expect(
      screen.getByRole('link', { name: /see what it does/i }),
    ).toHaveAttribute('href', '/feature-flags/');
  });
});
