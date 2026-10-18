import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FeatureDemo from './FeatureDemo';
import { buildFeatures, crowd, openingState, pages } from './rollout';

/** The labels of the dots that are filled: visitors who see the new gallery. */
function lit(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.visitor-crowd__dot')].flatMap(
    (dot) =>
      dot.hasAttribute('data-lit') ? [dot.getAttribute('aria-label')!] : [],
  );
}

/** What the first lane's page mock shows. */
function mock(container: HTMLElement): string {
  return (
    container.querySelector('.landing-feature__mock-gallery')?.textContent ?? ''
  );
}

function slide(percent: number): void {
  fireEvent.change(screen.getByRole('slider'), {
    target: { value: String(percent) },
  });
}

function pick(name: RegExp): void {
  fireEvent.click(screen.getByRole('radio', { name }));
}

/**
 * The lanes on the page are the package's answers, driven the way a reader
 * drives them.
 */
describe('the feature-flag demonstration component', () => {
  it('opens on the same state the logic opens on', () => {
    const { container } = render(<FeatureDemo />);
    const expected = crowd(
      buildFeatures(openingState.percent),
      pages[0],
    ).filter((visitor) => visitor.gallery.enabled).length;

    expect(container.querySelectorAll('.visitor-crowd__dot')).toHaveLength(
      24,
    );
    expect(lit(container)).toHaveLength(expected);
    expect(mock(container)).toBe('New gallery for some visitors');
  });

  it('fills the dots as the slider moves and leaves the first lane alone', () => {
    const { container } = render(<FeatureDemo />);
    const before = mock(container);

    slide(0);
    expect(lit(container)).toHaveLength(0);
    slide(100);
    expect(lit(container)).toHaveLength(24);
    expect(mock(container)).toBe(before);
  });

  it('answers Azul before deploy and empties and dims the dots', () => {
    const { container } = render(<FeatureDemo />);
    slide(100);

    pick(/Azul/);
    expect(mock(container)).toBe('Old gallery');
    expect(screen.getByText(/ships the old one/)).toBeInTheDocument();
    expect(lit(container)).toHaveLength(0);
    expect(
      container.querySelectorAll('.landing-feature__lane[data-dimmed]'),
    ).toHaveLength(1);
    expect(
      screen.getByText('Decided before deploy: nobody on this page.'),
    ).toBeInTheDocument();

    pick(/Brass/);
    expect(lit(container)).toHaveLength(24);
    expect(
      container.querySelectorAll('.landing-feature__lane[data-dimmed]'),
    ).toHaveLength(0);
  });

  it('lights the line of code the last control wrote', () => {
    const { container } = render(<FeatureDemo />);
    const litLines = () =>
      [...container.querySelectorAll('.code-view__line[data-lit]')].map(
        (line) => line.textContent ?? '',
      );

    expect(litLines()).toEqual([]);
    slide(60);
    expect(litLines().join()).toContain('percent: 60');
    pick(/Azul/);
    expect(litLines().join()).toContain("category: 'family'");
  });

  it('labels every dot with its visitor in plain words', () => {
    render(<FeatureDemo />);
    slide(100);

    const dot = screen.getByRole('img', { name: /^Visitor cust-0001/ });
    expect(dot).toHaveAttribute('tabindex', '0');
    expect(dot.getAttribute('aria-label')).toBe(
      'Visitor cust-0001 sees the new gallery',
    );
  });

  it('reads the focused dot in the line under the lanes', () => {
    const { container } = render(<FeatureDemo />);

    fireEvent.focus(screen.getByRole('img', { name: /^Visitor cust-0002/ }));

    expect(
      container.querySelector('.landing-feature__readout')?.textContent,
    ).toMatch(/^Visitor cust-0002/);
  });

  it('disables the slider on Azul and enables it again on Brass', () => {
    render(<FeatureDemo />);
    expect(screen.getByRole('slider')).toBeEnabled();

    pick(/Azul/);
    const slider = screen.getByRole('slider', {
      name: /No effect on this page/,
    });
    expect(slider).toBeDisabled();

    pick(/Brass/);
    expect(screen.getByRole('slider')).toBeEnabled();
    expect(
      screen.getByRole('slider', { name: /New gallery for/ }),
    ).toBeEnabled();
  });

  it('shows the live count beside the slider, and the lane label on Azul', () => {
    const { container } = render(<FeatureDemo />);
    const row = () => container.querySelector('.landing-feature__row')!;
    const expected = crowd(
      buildFeatures(openingState.percent),
      pages[0],
    ).filter((visitor) => visitor.gallery.enabled).length;

    expect(row().contains(screen.getByRole('slider'))).toBe(true);
    expect(row().textContent).toContain(
      `${expected} of 24 visitors see the new gallery.`,
    );
    slide(100);
    expect(row().textContent).toContain(
      '24 of 24 visitors see the new gallery.',
    );

    pick(/Azul/);
    expect(row().textContent).toContain(
      'Decided before deploy: nobody on this page.',
    );
    expect(row().textContent).not.toContain('of 24');
  });

  it('says why Azul is not rolled out and shows the galleries', () => {
    const { container } = render(<FeatureDemo />);

    expect(container.querySelectorAll('.landing-feature__thumb')).toHaveLength(
      2,
    );
    pick(/Azul/);
    expect(screen.getByText(/family game/)).toBeInTheDocument();
    expect(container.querySelectorAll('.landing-feature__thumb')).toHaveLength(
      1,
    );
  });
});
