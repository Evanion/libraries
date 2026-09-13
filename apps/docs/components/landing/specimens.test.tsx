import { Luhn } from '@evanion/luhn';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LuhnSpecimen from './LuhnSpecimen';
import {
  luhnBody,
  token,
  tokenSpecimen,
  urnSpecimen,
  UserURN,
} from './specimens';
import TokenSpecimen from './TokenSpecimen';
import UrnSpecimen from './UrnSpecimen';

/**
 * What the three cards show is what the packages produce.
 *
 * The site's rule is that every value stated in an example was produced by
 * running the package. A card is an example that a reader can drive, so the
 * cards are rendered here and driven the way a reader drives them, and what
 * they show is held against the packages' own answers: the check character on
 * the Luhn card is `Luhn.generate`'s for whatever is typed, a minted token is
 * one `validate` accepts, and the URN's parts are `parse`'s.
 */
describe('the Luhn card', () => {
  it('opens on the README specimen and its check character', () => {
    render(<LuhnSpecimen initial={luhnBody} />);

    expect(screen.getByRole('textbox')).toHaveValue('foo');
    expect(screen.getByRole('status')).toHaveTextContent(
      Luhn.generate('foo').checksum,
    );
  });

  it('recomputes the check character as the text changes', () => {
    render(<LuhnSpecimen initial={luhnBody} />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'FoO-ö-baz' },
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      Luhn.generate('foobaz').checksum,
    );
  });

  it('shows no check character for text with nothing from the alphabet', () => {
    render(<LuhnSpecimen initial={luhnBody} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '!!' } });

    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(screen.getByText(/nothing from the alphabet/)).toBeInTheDocument();
  });

  /**
   * The visible character turns through the dictionary before it lands. The
   * `status` above is what a screen reader gets and never turns, which is
   * why the assertions above read it at once; the visible mark is read here,
   * and waited for.
   */
  it('turns the visible character through the dictionary, then lands it', async () => {
    const { container } = render(<LuhnSpecimen initial={luhnBody} />);
    const mark = container.querySelector('.landing-specimen__mark');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'bar' } });
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'brass' },
    });

    // Every frame is a dictionary character, including the ones a fast
    // typist interrupts, and the one that stays is the real one.
    const frames = new Set<string>();
    await waitFor(() => {
      frames.add(mark?.textContent ?? '');
      expect(mark).toHaveTextContent(Luhn.generate('brass').checksum);
    });
    for (const seen of frames) expect(Luhn.dictionary).toContain(seen);
  });

  it('lands the visible character at once under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    try {
      const { container } = render(<LuhnSpecimen initial={luhnBody} />);
      const mark = container.querySelector('.landing-specimen__mark');

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'brass' },
      });

      expect(mark).toHaveTextContent(Luhn.generate('brass').checksum);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('the Token card', () => {
  it('opens on a code the package accepts, check character last', () => {
    render(<TokenSpecimen initial={tokenSpecimen} />);

    expect(token.validate(tokenSpecimen)).toMatchObject({ valid: true });
    expect(screen.getByRole('status')).toHaveTextContent(tokenSpecimen);
  });

  it('mints a code the package accepts on every press', () => {
    render(<TokenSpecimen initial={tokenSpecimen} />);
    const seen = new Set<string>();

    for (let press = 0; press < 5; press += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
      const shown = screen.getByRole('status').textContent ?? '';
      expect(token.validate(shown)).toMatchObject({ valid: true });
      seen.add(shown);
    }

    expect(seen.size).toBeGreaterThan(1);
  });

  it('lands the visible code left to right, separator standing', async () => {
    const { container } = render(<TokenSpecimen initial={tokenSpecimen} />);
    const visible = container.querySelector('.landing-specimen__value');

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    const minted = screen.getByRole('status').textContent ?? '';

    expect(visible?.textContent?.[4]).toBe('-');
    await waitFor(() => expect(visible).toHaveTextContent(minted));
  });
});

describe('the URN card', () => {
  it('shows the parts the package parses, in order', () => {
    render(<UrnSpecimen value={urnSpecimen} />);
    const parsed = UserURN.parse(urnSpecimen);

    expect(
      screen.getAllByRole('button').map((part) => part.textContent),
    ).toEqual([parsed.urn, parsed.nid, parsed.nss]);
    expect(parsed).toMatchObject({ urn: 'urn', nid: 'user', nss: '1337' });
  });

  it('names an explanation for every part, and opens it on a tap', () => {
    render(<UrnSpecimen value={urnSpecimen} />);

    for (const part of screen.getAllByRole('button')) {
      expect(part).toHaveAccessibleDescription(/./);
    }

    const namespace = screen.getByRole('button', { name: 'user' });
    fireEvent.click(namespace);
    expect(namespace).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(namespace);
    expect(namespace).toHaveAttribute('aria-expanded', 'false');
  });
});
