import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductPageView } from './ProductPageView';
import { productBySlug } from './registry';

describe('ProductPageView', () => {
  it('renders the hero, one section per scene, the code sample and the install command', () => {
    const page = productBySlug('feature-flags');
    render(<ProductPageView page={page} code="const x = 1;" />);
    expect(
      screen.getByRole('heading', { level: 1, name: page.hero.promise }),
    ).toBeInTheDocument();
    for (const scene of page.scenes)
      expect(
        screen.getByRole('heading', { level: 2, name: scene.title }),
      ).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    expect(screen.getByText(page.install.command)).toBeInTheDocument();
  });
});
