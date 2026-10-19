import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductPageView } from './ProductPageView';
import { productBySlug } from './registry';

describe('ProductPageView', () => {
  it('renders the hero, one section per scene, the install command, the code sample, the FAQ and the closing', () => {
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
    for (const fact of page.facts)
      expect(screen.getByText(fact.title)).toBeInTheDocument();
    const sample = screen.getByRole('heading', { name: page.codeSample.title });
    expect(sample.closest('section')).toHaveAttribute('id', page.codeSample.id);
    expect(screen.getByText(page.hero.install)).toBeInTheDocument();
    expect(screen.getByText(page.codeSample.install)).toBeInTheDocument();
    for (const entry of page.faq)
      expect(screen.getByText(entry.q)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: page.closing.title }),
    ).toBeInTheDocument();
    for (const scene of page.scenes) {
      expect(screen.getByText(scene.why)).toBeInTheDocument();
      expect(screen.getByText(scene.how)).toBeInTheDocument();
    }
    const withDemo = page.scenes.filter((s) => s.demo);
    expect(screen.getAllByText(/^How it.s different$/)).toHaveLength(
      page.scenes.filter((s) => s.differs).length,
    );
    for (const scene of withDemo)
      expect(screen.getByText(scene.demo!.caption)).toBeInTheDocument();
  });
});
