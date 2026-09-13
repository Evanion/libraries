import { Luhn } from '@evanion/luhn';
import { createToken } from '@evanion/token';
import { URN } from '@evanion/urn';
import { describe, expect, it } from 'vitest';
import { packages } from '../../app/navigation';
import { specimens, specimenText } from './specimens';

/**
 * The specimen on a package's card is a value the package produced.
 *
 * The site's rule is that every value stated in an example was produced by
 * running the package. A card is an example, so the packages run here against
 * the strings the cards show: the marked segment has to be exactly what the
 * package computes or accepts, and a specimen edited by hand into something the
 * package would reject fails the build instead of shipping.
 */

function marked(slug: string): string {
  return (specimens[slug] ?? [])
    .filter((segment) => segment.role === 'mark')
    .map((segment) => segment.text)
    .join('');
}

describe('the landing-page specimens', () => {
  it('name only packages the navigation lists', () => {
    const slugs = new Set(packages.map((entry) => entry.slug));

    expect(Object.keys(specimens).filter((slug) => !slugs.has(slug))).toEqual(
      [],
    );
  });

  it('show the namespace URN parses out of the urn', () => {
    class UserURN extends URN {
      static override readonly nid = marked('urn');
    }

    expect(UserURN.parse(specimenText(specimens['urn'] ?? []))).toMatchObject({
      urn: 'urn',
      nid: 'user',
      nss: '1337',
    });
  });

  it('show the check character Luhn generates over the body', () => {
    const body = (specimens['luhn'] ?? [])
      .filter((segment) => segment.role === 'plain')
      .map((segment) => segment.text)
      .join('');

    expect(Luhn.generate(body).checksum).toBe(marked('luhn'));
  });

  it('show a token the default alphabet accepts, ending in its check', () => {
    const value = specimenText(specimens['token'] ?? []);

    expect(createToken().validate(value)).toEqual({
      valid: true,
      body: value.replace('-', '').slice(0, -1),
    });
    expect(value.endsWith(marked('token'))).toBe(true);
  });
});
