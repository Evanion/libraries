import { Luhn } from '@evanion/luhn';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LuhnSpecimen from './LuhnSpecimen';
import {
  buildToken,
  collisionAt,
  luhnBody,
  shapeLabel,
  token,
  tokenAlphabets,
  tokenShapes,
  tokenSpecimen,
  urnComponents,
  urnSpecimen,
  urnWith,
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
  /** The code as issued: the README specimen with the package's check character. */
  const issued = `${luhnBody}${Luhn.generate(luhnBody).checksum}`;

  it('opens on the issued code, and the package accepts it', () => {
    render(<LuhnSpecimen initial={luhnBody} />);

    expect(screen.getByRole('textbox')).toHaveValue(issued);
    expect(Luhn.validate(issued)).toMatchObject({ isValid: true });
    expect(screen.getByText('accepted')).toBeInTheDocument();
  });

  /**
   * The catch is the demonstration. One character replaced is the error a
   * check character always catches, and the card has to say so rather than
   * leaving the reader to read the code back themselves.
   */
  it('rejects the code once a character changes', () => {
    render(<LuhnSpecimen initial={luhnBody} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change a character' }));

    const typed = (screen.getByRole('textbox') as HTMLInputElement).value;
    expect(typed).not.toBe(issued);
    expect(Luhn.validate(typed)).toMatchObject({ isValid: false });
    expect(screen.getByText('rejected')).toBeInTheDocument();
  });

  /** A transposition is the error people make reading a code aloud. */
  it('rejects the code once two characters swap', () => {
    render(<LuhnSpecimen initial={luhnBody} />);

    fireEvent.click(screen.getByRole('button', { name: 'Swap two' }));

    const typed = (screen.getByRole('textbox') as HTMLInputElement).value;
    expect(typed).not.toBe(issued);
    expect(
      screen.getByText(Luhn.validate(typed).isValid ? 'accepted' : 'rejected'),
    ).toBeInTheDocument();
  });

  it('puts the issued code back', () => {
    render(<LuhnSpecimen initial={luhnBody} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change a character' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByRole('textbox')).toHaveValue(issued);
    expect(screen.getByText('accepted')).toBeInTheDocument();
  });

  /** What a screen reader gets is the verdict, not the styling that carries it. */
  it('announces the verdict', () => {
    render(<LuhnSpecimen initial={luhnBody} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      `${issued} is accepted.`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change a character' }));
    expect(screen.getByRole('status')).toHaveTextContent('is rejected');
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

  /**
   * The shape control's options are labelled with their own chunks, so the
   * label and the code the package mints for it have to agree.
   */
  it('mints a code shaped like the option that is standing', () => {
    render(<TokenSpecimen initial={tokenSpecimen} />);

    for (const [index, shape] of tokenShapes.entries()) {
      const label = shapeLabel(shape);
      fireEvent.click(screen.getByRole('radio', { name: label }));

      const shown = screen.getByRole('status').textContent ?? '';
      const built = buildToken(index, 0);

      expect(built.validate(shown)).toMatchObject({ valid: true });
      expect(shown.split(built.separator).map((chunk) => chunk.length)).toEqual(
        label.split('-').map(Number),
      );
    }
  });

  /** The entropy the caption reports is the package's own. */
  it('reports the entropy and the collision budget of the configuration', () => {
    const { container } = render(<TokenSpecimen initial={tokenSpecimen} />);
    const note = container.querySelector('.landing-spec__note');

    for (const [index, alphabet] of tokenAlphabets.entries()) {
      const built = buildToken(0, index);

      fireEvent.click(screen.getByRole('radio', { name: alphabet.label }));
      expect(note).toHaveTextContent(`${Math.round(built.entropyBits)} bits`);
      expect(note).toHaveTextContent(
        collisionAt(built.entropyBits).toLocaleString('en-US'),
      );
    }
  });
});

describe('the URN card', () => {
  /** The parts of the identifier, in the order the card draws them. */
  const segments = (container: HTMLElement): string[] =>
    [...container.querySelectorAll('.landing-urn__part')].map(
      (part) => part.textContent ?? '',
    );

  it('shows the parts the package parses, in order', () => {
    const { container } = render(<UrnSpecimen value={urnSpecimen} />);
    const parsed = UserURN.parse(urnSpecimen);

    expect(segments(container)).toEqual([parsed.urn, parsed.nid, parsed.nss]);
    expect(parsed).toMatchObject({ urn: 'urn', nid: 'user', nss: '1337' });
  });

  it('names an explanation for every part, and opens it on a tap', () => {
    const { container } = render(<UrnSpecimen value={urnSpecimen} />);

    for (const part of container.querySelectorAll('.landing-urn__part')) {
      expect(part).toHaveAccessibleDescription(/./);
    }

    const namespace = screen.getByRole('button', { name: 'user' });
    fireEvent.click(namespace);
    expect(namespace).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(namespace);
    expect(namespace).toHaveAttribute('aria-expanded', 'false');
  });

  /** Opens on the three parts alone: nothing is attached until it is asked for. */
  it('carries no component until one is attached', () => {
    const { container } = render(<UrnSpecimen value={urnSpecimen} />);

    expect(segments(container)).toHaveLength(3);
    expect(screen.getByRole('status')).toHaveTextContent(urnSpecimen);
    for (const component of urnComponents) {
      expect(
        screen.getByRole('button', { name: component.label }),
      ).toHaveAttribute('aria-pressed', 'false');
    }
  });

  /**
   * The identifier the card shows is the one `stringify` wrote, delimiters
   * included, and each component segment is what `parse` gave back for it.
   */
  it('attaches each component the package writes, and explains it', () => {
    const { container } = render(<UrnSpecimen value={urnSpecimen} />);

    for (const component of urnComponents) {
      fireEvent.click(screen.getByRole('button', { name: component.label }));
    }

    const written = urnWith(
      urnSpecimen,
      urnComponents.map((component) => component.key),
    );
    const parsed = UserURN.parse(written);

    expect(screen.getByRole('status')).toHaveTextContent(written);
    expect(segments(container)).toEqual([
      parsed.urn,
      parsed.nid,
      parsed.nss,
      ...urnComponents.map((component) => parsed[component.key]),
    ]);

    // The card draws the delimiters between the parts; the parts and the
    // delimiters together have to be the identifier the package wrote.
    const drawn = [
      ...container.querySelectorAll(
        '.landing-urn__part, .landing-specimen__dim',
      ),
    ]
      .map((piece) => piece.textContent)
      .join('');
    expect(drawn).toBe(written);

    for (const part of container.querySelectorAll('.landing-urn__part')) {
      expect(part).toHaveAccessibleDescription(/./);
    }
  });

  /** The payoff: what is attached is not part of the name, and `equals` says so. */
  it('says the name is unchanged, while the package says it is', () => {
    render(<UrnSpecimen value={urnSpecimen} />);
    expect(screen.queryByText(/names nothing new/)).toBeNull();

    for (const component of urnComponents) {
      fireEvent.click(screen.getByRole('button', { name: component.label }));
      const written = urnWith(urnSpecimen, [component.key]);

      expect(UserURN.equals(written, urnSpecimen)).toBe(true);
      expect(screen.getByText(/names nothing new/)).toHaveTextContent(
        urnSpecimen,
      );

      fireEvent.click(screen.getByRole('button', { name: component.label }));
      expect(screen.queryByText(/names nothing new/)).toBeNull();
    }
  });
});
