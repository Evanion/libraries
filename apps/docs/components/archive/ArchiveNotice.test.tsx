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
        kind="tag"
        package="@evanion/acl"
        version="0.1.0"
        sha="d618051"
      />,
    );

    expect(screen.getByText(/running 0\.1\.0 in CI at/)).toBeInTheDocument();
    expect(screen.getByText('d618051')).toBeInTheDocument();
  });

  /** The seed's SHA is `main`'s, so the clause after it is the predicate. */
  it('states the seed predicate beside a seeded commit', () => {
    render(
      <ArchiveNotice
        kind="seed"
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
