import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FeatureDemo from './FeatureDemo';
import { buildFeatures, crowd, openingState } from './rollout';

/** The dots the request lane has lit. */
function lit(container: HTMLElement): number {
  return container.querySelectorAll('.landing-feature__dot[data-lit]').length;
}

/** The text of each flag in the build lane, keyed by its name. */
function build(container: HTMLElement): Record<string, string> {
  return Object.fromEntries(
    [...container.querySelectorAll('.landing-feature__flag')].map((flag) => [
      flag.querySelector('.landing-feature__key')?.textContent ?? '',
      flag.querySelector('.landing-feature__status')?.textContent ?? '',
    ]),
  );
}

function slide(percent: number): void {
  fireEvent.change(screen.getByRole('slider', { name: /rollout percent/i }), {
    target: { value: String(percent) },
  });
}

/**
 * The lanes on the page are the package's answers, driven the way a reader
 * drives them.
 */
describe('the feature-flag demonstration component', () => {
  it('opens on the same state the logic opens on', () => {
    const { container } = render(<FeatureDemo />);
    const expected = crowd(buildFeatures(openingState)).filter(
      (visitor) => visitor.checkout.enabled,
    ).length;

    expect(container.querySelectorAll('.landing-feature__dot')).toHaveLength(
      24,
    );
    expect(lit(container)).toBe(expected);
  });

  it('lights more visitors as the slider moves up', () => {
    const { container } = render(<FeatureDemo />);

    slide(0);
    expect(lit(container)).toBe(0);
    slide(100);
    expect(lit(container)).toBe(24);
  });

  it('settles both flags off at build when the switch is turned off', () => {
    const { container } = render(<FeatureDemo />);

    expect(build(container)['gift-cards']).toMatch(/baked in/);
    expect(build(container)['new-checkout']).toMatch(/needs targetingKey/);
    expect(build(container)['express-pickup']).toMatch(/needs targetingKey/);

    fireEvent.click(screen.getByRole('checkbox', { name: /new-checkout/ }));

    expect(build(container)['gift-cards']).toMatch(/baked in/);
    expect(build(container)['new-checkout']).toBe('settled off at build');
    expect(build(container)['express-pickup']).toBe('settled off at build');
    expect(lit(container)).toBe(0);
  });

  it('labels every dot with its visitor and the reason', () => {
    render(<FeatureDemo />);
    slide(100);

    const dot = screen.getByRole('img', { name: /^cust-0001:/ });
    expect(dot).toHaveAttribute('tabindex', '0');
    expect(dot.getAttribute('aria-label')).toContain('rule-match');

    fireEvent.click(screen.getByRole('checkbox', { name: /new-checkout/ }));
    expect(
      screen
        .getByRole('img', { name: /^cust-0001:/ })
        .getAttribute('aria-label'),
    ).toContain('dependency-off · blocked by new-checkout');
  });

  it('reads the focused dot aloud in the line under the lanes', () => {
    const { container } = render(<FeatureDemo />);

    fireEvent.focus(screen.getByRole('img', { name: /^cust-0002:/ }));

    expect(
      container.querySelector('.landing-feature__readout')?.textContent,
    ).toMatch(/^cust-0002:/);
  });
});
