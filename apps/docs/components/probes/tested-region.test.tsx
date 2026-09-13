import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { EmptyInputError, Luhn } from '@evanion/luhn';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ProbeField from './ProbeField';
import { claimsOf, regionOf, seedOf } from './claims';
import { INPUT_LIMIT, format, quote } from './probe';
import { probes as luhn } from './luhn';

/**
 * The probe is the tested example, not a copy of it.
 *
 * Three things have to hold at once for that to be true, and two of them hold
 * elsewhere: the README block is executed by Vitest, and the page renders that
 * block because the region loader fills it and a missing region fails
 * `next build`. This file is the third -- the probe, called with the argument
 * the block writes, produces the value the block claims, character for
 * character.
 *
 * Every claim in the region is checked, not only the one the probe opens on.
 * `luhn`'s block claims the same value for `foo` and for `FoO`, which is the
 * variation the probe exists to let a reader make, so it is one the probe has
 * to agree with.
 */

const CONTENT = join(import.meta.dirname, '../../content');

const all = Object.entries({ luhn }).flatMap(([pkg, probes]) =>
  Object.entries(probes).map(([name, probe]) => ({ pkg, name, probe })),
);

/** The entities React writes into server markup, read back. */
const ENTITIES: Record<string, string> = {
  '&#x27;': "'",
  '&quot;': '"',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
};

/** Server markup as the text a reader sees, so a claim can be looked for in it. */
const decode = (html: string) =>
  html.replace(
    /&(?:#x27|quot|amp|lt|gt);/g,
    (entity) => ENTITIES[entity] ?? entity,
  );

/** Every `.mdx` page on the site, as source. */
function pages(): string[] {
  return readdirSync(CONTENT, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.mdx'))
    .map((entry) => readFileSync(join(CONTENT, entry), 'utf8'));
}

describe.each(all)('the $pkg $name probe', ({ probe }) => {
  const claims = claimsOf(probe, regionOf(probe));

  it('finds the call it names in the region', () => {
    expect(claims.length).toBeGreaterThan(0);
  });

  it('produces the value the region claims, for every claim in it', () => {
    for (const { input, claimed } of claims) {
      expect(format(probe.call(input))).toBe(claimed);
    }
  });

  it('opens on the first of them', () => {
    expect(seedOf(probe)).toBe(claims[0]?.input);
  });

  it('sits under a page that renders the same region', () => {
    const reference = `file=${probe.region.file} region=${probe.region.name}`;

    expect(pages().some((page) => page.includes(reference))).toBe(true);
  });

  it('renders the documented call and value on the server', () => {
    const html = decode(
      renderToString(<ProbeField probe={probe} initial={seedOf(probe)} />),
    );

    expect(html).toContain(probe.source(seedOf(probe)));
    expect(html).toContain(claims[0]?.claimed);
  });

  it('passes on no more than the truncation limit', () => {
    const html = renderToString(
      <ProbeField probe={probe} initial={'x'.repeat(INPUT_LIMIT * 2)} />,
    );

    expect(html).not.toContain('x'.repeat(INPUT_LIMIT + 1));
  });
});

describe('what a probe calls', () => {
  it('is the package export, not a stand-in', () => {
    expect(luhn.generate.call('foo')).toEqual(Luhn.generate('foo'));
  });

  it.each([{ probe: luhn.generate, typed: '', throws: EmptyInputError }])(
    'shows what $typed threw and keeps the value it had',
    ({ probe, typed, throws }) => {
      expect(() => probe.call(typed)).toThrow(throws);

      const documented = format(probe.call(seedOf(probe)));
      render(<ProbeField probe={probe} initial={seedOf(probe)} />);
      fireEvent.change(screen.getByLabelText(probe.label), {
        target: { value: typed },
      });

      expect(screen.getByRole('status').textContent).toBe(documented);
      expect(document.querySelector('.probe__error')?.textContent).toBeTruthy();
    },
  );
});

describe('the printer', () => {
  it('writes a string the way the READMEs are formatted', () => {
    expect(quote('foo')).toBe("'foo'");
    expect(quote("it's")).toBe('"it\'s"');
  });

  it('writes an object as one line of JavaScript, not JSON', () => {
    expect(format({ phrase: 'foo', checksum: '5', filtered: 0 })).toBe(
      "{ phrase: 'foo', checksum: '5', filtered: 0 }",
    );
    expect(format({ valid: false, reason: 'check-failed' })).toBe(
      "{ valid: false, reason: 'check-failed' }",
    );
  });
});
