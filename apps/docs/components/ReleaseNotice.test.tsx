import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReleaseNotice from './ReleaseNotice';
import WorkshopNotice from './WorkshopNotice';

/**
 * The invariant: what a page claims about a package matches what `npm install`
 * gives the reader.
 *
 * A reader arriving from a search result sees one page and no chrome, so the
 * page is where the claim has to be. Getting it wrong in the safe direction --
 * silence -- costs a reader nothing; getting it wrong in the other direction
 * documents API that is not installable and says nothing about it.
 */
describe('the release notice', () => {
  it('names the published version and nothing else when main matches it', () => {
    render(<ReleaseNotice slug="luhn" published="3.0.0" ahead={false} />);

    expect(screen.getByText(/@evanion\/luhn 3\.0\.0/)).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('says the pages describe unreleased changes when main is ahead', () => {
    render(<ReleaseNotice slug="luhn" published="3.0.0" ahead={true} />);

    expect(
      screen.getByRole('heading', { name: 'Ahead of the release' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/gives you 3\.0\.0/)).toBeInTheDocument();
  });

  /**
   * `@evanion/feature` is private, so a release run tags it and publishes
   * nothing. Both notices on one page would have this one naming a version
   * `npm install` cannot resolve, directly under the panel saying so.
   */
  it('renders nothing where WorkshopNotice speaks', () => {
    const { container } = render(
      <>
        <ReleaseNotice slug="feature" published={null} ahead={false} />
        <WorkshopNotice slug="feature" />
      </>,
    );

    expect(container.querySelector('.docs-release')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Not on npm yet' }),
    ).toBeInTheDocument();
  });

  /** A slug the navigation does not carry is a route this component cannot describe. */
  it('refuses a slug no package has', () => {
    expect(() =>
      render(<ReleaseNotice slug="nope" published="1.0.0" ahead={false} />),
    ).toThrow(/nope/);
  });
});
