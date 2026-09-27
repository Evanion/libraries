import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ShopPage } from '../examples/listing.js';

/**
 * The listings the documentation renders, run.
 *
 * `apps/docs/content/react-widget/index.mdx` cites `examples/` by region, so the
 * page shows whatever that file says. Rendering it here is what makes the
 * page's claim about the output a claim something can fail on: the page states
 * that items render in array order, each inside the identifying element the
 * renderer adds, and all of it inside the default wrapper. That is what is
 * asserted below.
 */
describe('the documented examples', () => {
  it('renders the page in the order the array is written, inside the wrapper', () => {
    const { container } = render(<ShopPage />);

    expect(container.innerHTML).toBe(
      '<section>' +
        '<div data-widget-id="b1" data-widget-type="booking">' +
        '<div class="booking"><span>4 tables</span><span>tonight</span></div>' +
        '</div>' +
        '<div data-widget-id="g1" data-widget-type="listing">' +
        '<article class="listing"><h3>Brass: Birmingham</h3><p>649 kr</p></article>' +
        '</div>' +
        '</section>',
    );
  });
});
