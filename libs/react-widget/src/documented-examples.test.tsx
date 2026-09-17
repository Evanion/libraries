import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Shelf, shelfItems } from '../examples/listing.js';

/**
 * The listings the documentation renders, run.
 *
 * `apps/docs/content/react-widget/` cites `examples/` by region, so a page
 * shows whatever that file says. Rendering it here is what makes a page's
 * claim about the output a claim something can fail on: the pages state that
 * items render in array order, each inside the identifying element the renderer
 * adds, and all of it inside the chrome wrapper. That is what is asserted
 * below.
 */
describe('the documented examples', () => {
  it('renders the shelf in the order the array is written, inside the wrapper', () => {
    const { container } = render(<Shelf />);

    expect(container.innerHTML).toBe(
      '<section class="shelf">' +
        '<div data-widget-id="b1" data-widget-type="booking">' +
        '<div class="booking"><span>4 tables</span><span>tonight</span></div>' +
        '</div>' +
        '<div data-widget-id="g1" data-widget-type="listing">' +
        '<article class="listing"><h3>Brass: Birmingham</h3><p>649 kr</p></article>' +
        '</div>' +
        '</section>',
    );
  });

  it('gives back the items it was handed, unchanged', () => {
    expect(shelfItems).toEqual([
      { id: 'g1', type: 'listing', props: { title: 'Wingspan', price: 549 } },
      { id: 'b1', type: 'booking', props: { tables: 4, tonight: false } },
    ]);
  });
});
