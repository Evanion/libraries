import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ArchiveNotice from './ArchiveNotice';
import FrozenProbe from './FrozenProbe';

/**
 * The invariant: a cut page names the release it documents and the commit its
 * values came from, and says they are not re-executed.
 *
 * `docs/specs/2026-09-13-released-by-default.md` § 8 gives each sentence. The
 * reader who arrived from a search result has only the page, so the page is
 * where the provenance has to be.
 */
describe('the archive notice', () => {
  it('names the tag commit a release was cut at', () => {
    render(
      <ArchiveNotice
        kind="current"
        source="tag"
        package="@evanion/acl"
        version="0.1.0"
        sha="d618051"
      />,
    );

    expect(screen.getByText(/running 0\.1\.0 in CI at/)).toBeInTheDocument();
    expect(screen.getByText('d618051')).toBeInTheDocument();
  });

  /**
   * A line is documented by its x.y.0, so a reader who installed a later patch
   * is told these pages are the documentation of what they have.
   */
  it('names the patch on npm that the pages of its x.y.0 document', () => {
    render(
      <ArchiveNotice
        kind="current"
        source="tag"
        package="@evanion/luhn"
        version="3.0.0"
        published="3.0.1"
        sha="360f5bf"
      />,
    );

    expect(
      screen.getByText(
        /and its patch releases up to 3\.0\.1, the version on npm/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/running 3\.0\.0 in CI at/)).toBeInTheDocument();
  });

  it('names the patches a superseded line documents', () => {
    render(
      <ArchiveNotice
        kind="line"
        source="tag"
        package="@evanion/urn"
        version="2.0.0"
        published="2.0.3"
        sha="d50a1c6"
        current="3.0.1"
        href="/urn/"
      />,
    );

    expect(
      screen.getByText(
        /and its patch releases up to 2\.0\.3\. .*gives you 3\.0\.1/,
      ),
    ).toBeInTheDocument();
  });

  /** The seed's SHA is `main`'s, so the clause after it is the predicate. */
  it('states the seed predicate beside a seeded commit', () => {
    render(
      <ArchiveNotice
        kind="current"
        source="seed"
        package="@evanion/luhn"
        version="3.0.0"
        sha="115516f"
      />,
    );

    expect(screen.getByText(/versions as 3\.0\.0/)).toBeInTheDocument();
  });

  it('names the newest release on a superseded line and links to it', () => {
    render(
      <ArchiveNotice
        kind="line"
        source="tag"
        package="@evanion/urn"
        version="1.1.1"
        sha="c2979ea"
        current="2.0.0"
        href="/urn/"
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'An earlier release' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'here' })).toHaveAttribute(
      'href',
      '/urn/',
    );
  });

  /** A re-cut commit is past the tag, so the sentence cannot say it ran the tag. */
  it('names a re-cut commit as later than the tag it stands for', () => {
    render(
      <ArchiveNotice
        kind="current"
        source="recut"
        package="@evanion/urn"
        version="2.0.0"
        sha="a1b2c3d"
      />,
    );

    expect(
      screen.getByText(/a later commit than the 2\.0\.0 tag/),
    ).toBeInTheDocument();
  });

  it('says no documentation was published when the pages are main', () => {
    render(
      <ArchiveNotice kind="next" package="@evanion/luhn" version="3.0.0" />,
    );

    expect(
      screen.getByRole('heading', {
        name: 'No documentation for this release',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/gives you 3\.0\.0/)).toBeInTheDocument();
  });

  it('names the patch on npm when its x.y.0 shipped no pages', () => {
    render(
      <ArchiveNotice
        kind="next"
        package="@evanion/luhn"
        version="3.0.0"
        published="3.0.1"
      />,
    );

    expect(
      screen.getByText(
        /gives you 3\.0\.1, a patch of 3\.0\.0, and no documentation was published with 3\.0\.0/,
      ),
    ).toBeInTheDocument();
  });

  /** `nx release` computes the newest tag's version at a seed, not the x.y.0's. */
  it('states the seed predicate with the version on npm', () => {
    render(
      <ArchiveNotice
        kind="current"
        source="seed"
        package="@evanion/luhn"
        version="3.0.0"
        published="3.0.1"
        sha="7b41c85"
      />,
    );

    expect(screen.getByText(/versions as 3\.0\.1/)).toBeInTheDocument();
  });
});

describe('the frozen probe', () => {
  it('shows the shipped call and value with the field disabled', () => {
    render(
      <FrozenProbe
        label="phrase"
        input="gloomhaven"
        call="Luhn.generate('gloomhaven')"
        value="'7'"
        package="@evanion/luhn"
        version="3.0.0"
        sha="115516f"
        live="/next/luhn/usage/"
      />,
    );

    expect(screen.getByRole('textbox', { name: 'phrase' })).toBeDisabled();
    expect(screen.getByText("Luhn.generate('gloomhaven')")).toBeInTheDocument();
    expect(screen.getByText("'7'")).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Run it live on the unreleased page' }),
    ).toHaveAttribute('href', '/next/luhn/usage/');
  });
});
