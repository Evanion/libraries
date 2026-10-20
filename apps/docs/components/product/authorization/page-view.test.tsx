import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductPageView } from '../ProductPageView';
import page from '../pages/authorization';

describe('the authorization page view', () => {
  it('renders the API panel in the hero, the register table and the field sample', () => {
    render(
      <ProductPageView
        page={page}
        code="const x = 1;"
        samples={{ fields: 'const safe = 1;' }}
      />,
    );
    expect(screen.getByText('Your API, same policy')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByText('SEC-010')).toBeInTheDocument();
    expect(screen.getByText('const safe = 1;')).toBeInTheDocument();
  });
});
