import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AvailabilityPill,
  BoxArtPlaceholder,
  Button,
  Card,
  CardGrid,
  CardGridCell,
  Chip,
  Figure,
  MechanismTag,
  Panel,
  SectionHeader,
  Stat,
  StatLine,
  Text,
  Title,
  ComplexityRamp,
} from '../index.js';

/**
 * What a refactor that keeps the API and loses the design would break.
 *
 * The assertions are on class names rather than on computed styles, because the
 * stylesheet is a separate entry and jsdom has not loaded it: the contract these
 * components have with `styles.css` *is* the class name. `styles.test.ts` checks
 * the other half -- that every class here resolves to a token.
 */
describe('the stat line', () => {
  it('renders its figures in document order, each in tabular numerals', () => {
    const { container } = render(
      <StatLine label="Wingspan at a glance">
        <Stat figure="1–5" label="players" />
        <Stat figure="40–70 min" label="playtime" />
        <Stat figure="Midweight" label="complexity 2.4 / 5">
          <ComplexityRamp label="complexity 2.4 of 5" stop={3} />
        </Stat>
      </StatLine>,
    );

    const figures = [...container.querySelectorAll('.baize-stat__figure')];

    expect(figures.map((figure) => figure.textContent)).toEqual([
      '1–5',
      '40–70 min',
      'Midweight',
    ]);
    for (const figure of figures) {
      expect(figure.classList.contains('baize-figure')).toBe(true);
    }
  });

  it('is a group a screen reader can name, only when it is named', () => {
    const { container } = render(
      <StatLine>
        <Stat figure="2–4" label="players" />
      </StatLine>,
    );

    expect(container.querySelector('[role="group"]')).toBeNull();
  });
});

describe('the complexity ramp', () => {
  it('fills pips up to the stop and leaves the rest unfilled', () => {
    const { container } = render(
      <ComplexityRamp label="complexity 3.9 of 5" stop={4} />,
    );
    const pips = [...container.querySelectorAll('.baize-complexity__pip')];

    expect(pips).toHaveLength(5);
    expect(
      pips.map((pip) =>
        [...pip.classList].find((name) => name.includes('--stop-')),
      ),
    ).toEqual([
      'baize-complexity__pip--stop-1',
      'baize-complexity__pip--stop-2',
      'baize-complexity__pip--stop-3',
      'baize-complexity__pip--stop-4',
      undefined,
    ]);
  });

  it('is one graphic with one name, not five', () => {
    render(<ComplexityRamp label="complexity 2.4 of 5" stop={3} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'complexity 2.4 of 5',
    );
  });
});

describe('the informational colour systems', () => {
  it('binds a complexity stop on a title through one ladder class', () => {
    const { container } = render(
      <Title complexity={4} size="lg">
        Root
      </Title>,
    );

    const title = container.querySelector('.baize-title');
    expect(title?.className).toContain('baize-ladder-4');
    expect(title?.className).toContain('baize-title--size-lg');
  });

  it('leaves a mechanism tag unhued, and keeps the hue on a chip', () => {
    const { container } = render(
      <>
        <Chip mechanism="deckbuilder">deckbuilder</Chip>
        <MechanismTag label="deckbuilder" />
      </>,
    );

    const [chip, tag] = [...container.children] as [Element, Element];
    expect(chip.className).toContain('baize-hue-deckbuilder');
    expect(tag.className).toBe('baize-mechanism-tag');
  });

  it('leaves a title with no mechanism on the chalk default', () => {
    const { container } = render(<Title>How the shop works</Title>);
    expect(container.querySelector('[class*="baize-hue-"]')).toBeNull();
  });

  it('gives the availability pill the label as its whole meaning', () => {
    const { container } = render(
      <AvailabilityPill
        availability="reprintPending"
        label="reprint pending"
      />,
    );
    const pill = container.querySelector('.baize-pill');

    expect(pill?.textContent).toBe('reprint pending');
    expect(pill?.className).toContain('baize-state-reprint-pending');
  });
});

describe('the surfaces', () => {
  it('renders a card with its head and foot rows only when given them', () => {
    const { container } = render(
      <Card foot={<Figure>749 kr</Figure>} head={<Title size="sm">Azul</Title>}>
        <Text>Tile placement.</Text>
      </Card>,
    );

    expect(container.querySelector('.baize-card__head')).not.toBeNull();
    expect(container.querySelector('.baize-card__foot')).not.toBeNull();

    const bare = render(<Card>nothing else</Card>);
    expect(bare.container.querySelector('.baize-card__head')).toBeNull();
  });

  it('renders a panel as a region with its heading', () => {
    render(<Panel heading="Opening hours">closed Mondays</Panel>);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Opening hours',
    );
  });

  it('puts the section aside opposite the heading', () => {
    const { container } = render(
      <SectionHeader
        aside={<Text size="sm">6 titles</Text>}
        heading={<Title>New in</Title>}
      />,
    );

    expect(
      container.querySelector('.baize-section-header__aside')?.textContent,
    ).toBe('6 titles');
  });
});

describe('the controls', () => {
  it('renders a handler without owning what it changes', () => {
    const pressed: string[] = [];
    render(
      <Button onClick={() => pressed.push('add')} variant="primary">
        Add to cart
      </Button>,
    );

    screen.getByRole('button').click();
    expect(pressed).toEqual(['add']);
    expect(screen.getByRole('button').className).toContain(
      'baize-button--variant-primary',
    );
  });

  /**
   * A back office declares and clears a title's availability through one form with
   * two submits, which is what works before hydration. The pair the browser sends
   * is what tells them apart.
   */
  it('carries a submit name and value into the form', () => {
    render(
      <Button name="intent" type="submit" value="declare">
        Save state
      </Button>,
    );
    const button = screen.getByRole('button') as HTMLButtonElement;

    expect(button.type).toBe('submit');
    expect(button.name).toBe('intent');
    expect(button.value).toBe('declare');
  });

  it('disables a button without losing its class', () => {
    render(<Button disabled>Sold out</Button>);
    const button = screen.getByRole('button') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.className).toContain('baize-button');
  });
});

describe('the card grid', () => {
  it('renders as a list whose cells can span two columns', () => {
    const { container } = render(
      <CardGrid as="ul" label="Catalogue">
        <CardGridCell as="li" wide>
          <Card>Brass: Birmingham</Card>
        </CardGridCell>
        <CardGridCell as="li">
          <Card>Azul</Card>
        </CardGridCell>
      </CardGrid>,
    );

    expect(container.querySelector('ul')?.className).toBe('baize-card-grid');
    const cells = [...container.querySelectorAll('li')];
    expect(cells[0]?.className).toContain('baize-card-grid__cell--wide');
    expect(cells[1]?.className).not.toContain('--wide');
  });
});

describe('the box-art placeholder', () => {
  it('paints a palette and says what it stands in for', () => {
    const { container } = render(
      <BoxArtPlaceholder label="Brass: Birmingham" palette="soot" />,
    );
    const tile = container.querySelector('.baize-box-art');

    expect(tile?.className).toContain('baize-palette-soot');
    expect(tile?.getAttribute('aria-hidden')).toBeNull();
    expect(container.querySelector('.baize-box-art__label')?.textContent).toBe(
      'Brass: Birmingham',
    );
  });

  it('degrades to the neutral gradient with no palette, and hides itself with no label', () => {
    const { container } = render(<BoxArtPlaceholder />);
    const tile = container.querySelector('.baize-box-art');

    expect(tile?.className).toBe('baize-box-art');
    expect(tile?.getAttribute('aria-hidden')).toBe('true');
    expect(tile?.textContent).toBe('');
  });
});
