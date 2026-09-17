import { hydratePolicy } from '@evanion/acl';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EditControl } from '../examples/decision.js';
import { ListingForm } from '../examples/fields.js';
import { ListingTable } from '../examples/many.js';
import { ShopMenu } from '../examples/menu.js';
import { ShopAccess } from '../examples/mount.js';
import { ListingPage } from '../examples/server.js';
import {
  EditControl as TypedEditControl,
  ShopAccess as TypedAccess,
  shop,
} from '../examples/typed.js';

/**
 * What `apps/docs/content/react-acl/` shows a reader is what this suite runs.
 *
 * Every page in that section cites `libs/react-acl/examples/*.tsx` by region,
 * so a page renders the source of a component this file mounts. A region that
 * stops compiling, stops rendering, or starts disagreeing with the sentence
 * above it on the page fails here rather than on the page.
 *
 * One shop policy drives all six. The section teaches one worked case, and a
 * second policy here would let an example drift from the one the pages
 * describe.
 */
const MATRIX = {
  permissions: [
    {
      key: 'listing.read',
      object: 'listing',
      action: 'read',
      // An unconditional rule states it as an empty `when`; the engine refuses
      // a rule that carries none at all.
      rules: [{ when: [] }],
    },
    {
      key: 'listing.edit',
      object: 'listing',
      action: 'edit',
      rules: [
        {
          when: [
            { field: 'object.sellerId', op: 'eq' as const, path: 'subject.id' },
          ],
        },
      ],
      denyRules: [
        {
          when: [
            { field: 'object.status', op: 'eq' as const, value: 'published' },
          ],
        },
      ],
      fields: { fields: ['blurb'] },
    },
  ],
};

const SHOPPER = { id: 'mika', role: 'bookseller' as const };
const NOW = '2026-09-17T09:00:00.000Z';

/** A draft Mika listed: the allow matches and the deny does not. */
const OWN_DRAFT = {
  id: 'brass-birmingham',
  sellerId: 'mika',
  status: 'draft' as const,
};

/**
 * Another of Mika's, already published, which the deny rule closes. A separate
 * id rather than `OWN_DRAFT` republished, because the table below renders the
 * two side by side and React keys them by id.
 */
const OWN_PUBLISHED = {
  id: 'ark-nova',
  sellerId: 'mika',
  status: 'published' as const,
};

/** Somebody else's listing. No allow rule matches it for Mika. */
const OTHER_DRAFT = {
  id: 'concordia',
  sellerId: 'jo',
  status: 'draft' as const,
};

function mount(children: React.ReactNode) {
  return render(
    <ShopAccess matrix={MATRIX} shopper={SHOPPER} now={NOW}>
      {children}
    </ShopAccess>,
  );
}

describe('the mounted provider', () => {
  it('lets a control decide with no access or subject prop', () => {
    mount(<EditControl listing={OWN_DRAFT} />);

    expect(
      screen.getByRole('button', { name: 'Edit listing' }),
    ).toBeInTheDocument();
  });

  it('draws no control for a listing the shopper does not own', () => {
    mount(<EditControl listing={OTHER_DRAFT} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('draws no control once the deny rule matches', () => {
    mount(<EditControl listing={OWN_PUBLISHED} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('the menu', () => {
  /**
   * `useCapabilities` passes no object, so `listing.edit` cannot be decided and
   * only the object-free `listing.read` reaches the menu. That is the sentence
   * the page makes over this region.
   */
  it('links only what is decidable with no object', () => {
    mount(<ShopMenu />);

    expect(screen.getByRole('link', { name: 'listing.read' })).toHaveAttribute(
      'href',
      '/listing/read',
    );
    expect(screen.queryByRole('link', { name: 'listing.edit' })).toBeNull();
  });
});

describe('the form', () => {
  it('leaves an allowed field writable and every other field read-only', () => {
    mount(<ListingForm listing={{ id: 'x', blurb: 'Canals.', price: 45 }} />);

    expect(screen.getByLabelText('Blurb')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Price')).toHaveAttribute('readonly');
  });
});

describe('the table', () => {
  it('decides every row in one call', () => {
    mount(<ListingTable listings={[OWN_DRAFT, OTHER_DRAFT, OWN_PUBLISHED]} />);

    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
  });
});

describe('the server component', () => {
  /**
   * No provider and no hook. `ListingPage` takes the evaluator as a prop, which
   * is what a loader or a server component already holds.
   */
  it('reads the same policy through the core', () => {
    render(
      <ListingPage
        access={hydratePolicy(MATRIX)}
        shopper={SHOPPER}
        listing={OWN_DRAFT}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'brass-birmingham' }),
    ).toBeInTheDocument();
  });
});

describe('the typed policy', () => {
  it('builds the document the other five examples run against', () => {
    expect(shop.matrix).toEqual(MATRIX);
  });

  it('decides through hooks that know the policy keys', () => {
    render(
      <TypedAccess subject={SHOPPER}>
        <TypedEditControl listing={OWN_DRAFT} />
      </TypedAccess>,
    );

    expect(
      screen.getByRole('button', { name: 'Edit listing' }),
    ).toBeInTheDocument();
  });

  it('draws no control once the deny rule matches', () => {
    render(
      <TypedAccess subject={SHOPPER}>
        <TypedEditControl listing={OWN_PUBLISHED} />
      </TypedAccess>,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
