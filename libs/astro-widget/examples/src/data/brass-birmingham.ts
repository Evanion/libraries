/**
 * The sections a CMS saved for one Baize listing page.
 *
 * A CMS writes this array as JSON and the page imports that file. A module
 * holds it here so the example has nothing to fetch and the compiler reads the
 * same shape a payload arrives in.
 */
// #region sections
import type { AnyWidgetItem } from '@evanion/astro-widget';

export const sections: AnyWidgetItem[] = [
  {
    id: 'header',
    type: 'listing-header',
    props: { title: 'Brass: Birmingham', players: '2-4' },
  },
  { id: 'price', type: 'price-box', props: { price: '649 kr' } },
];
// #endregion sections
