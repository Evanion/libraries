import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Cards, Pair, Rows } from './sections';

describe('a family section with a product page', () => {
  it('sends the lead and the adapter to the product page', () => {
    render(<Pair group="feature" />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/feature-flags/');
    expect(hrefs).not.toContain('/docs/react-feature');
  });

  it('sends an adapter to the section of the page that covers it', () => {
    render(<Rows group="feature" />);
    const hrefs = screen
      .getAllByRole('link')
      .map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(['/feature-flags/', '/feature-flags/#react']);
  });

  it('keeps the docs one click away', () => {
    render(<Pair group="feature" />);
    expect(screen.getByRole('link', { name: /Read the docs/ })).toHaveAttribute(
      'href',
      '/docs/feature',
    );
  });
});

describe('a family section without a product page', () => {
  it('links the docs page', () => {
    render(<Cards group="identifiers" />);
    const list = screen.getByRole('list', { name: /./ });
    const hrefs = within(list)
      .getAllByRole('link')
      .map((l) => l.getAttribute('href'));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toMatch(/^\/docs\//);
  });
});
