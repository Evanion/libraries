import type { MouseEventHandler, ReactNode } from 'react';

import { classNames, modifier } from './class-names.js';

/**
 * Which weight a control carries.
 *
 * `primary` inverts ink and parchment. There is no brand button, because the
 * design has no house colour: the catalogue supplies every saturated pixel and a
 * button is not catalogue.
 */
export type ButtonVariant = 'primary' | 'standard' | 'quiet';

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  /**
   * What the app does when the control is pressed.
   *
   * Taking a handler is not state: the component renders it and owns nothing.
   * Whatever it changes lives in the app, including every stateful control the
   * boundary rule keeps out of this library.
   */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  /**
   * What a submit reports to the form it is in.
   *
   * A form with two submits tells them apart by the pair a browser sends for
   * whichever one was pressed, which is the only way a form works before
   * hydration. That is submission, not state: nothing here reads either value,
   * and a form that posted to a server read both without this library existing.
   */
  name?: string;
  value?: string;
  /** Where the control's own text is not the whole label. */
  'aria-label'?: string;
}

/** A 6px-radius button. */
export function Button({
  children,
  variant = 'standard',
  onClick,
  type = 'button',
  disabled = false,
  name,
  value,
  'aria-label': ariaLabel,
}: ButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={classNames(
        'baize-button',
        modifier('baize-button', 'variant', variant),
      )}
      disabled={disabled}
      name={name}
      onClick={onClick}
      type={type}
      value={value}
    >
      {children}
    </button>
  );
}

export interface ButtonLinkProps {
  children: ReactNode;
  /**
   * The destination, already resolved. A string and not a route object: this
   * library imports no router, and the app that has one has already turned its
   * route into a URL by the time it renders.
   */
  href: string;
  variant?: ButtonVariant;
  'aria-label'?: string;
}

/**
 * A button-shaped link.
 *
 * Separate from `Button` rather than a polymorphic `as` prop, because the two
 * differ in more than their tag: a link has no disabled state and no handler, and
 * a `<button>` inside a navigation is the accessibility defect this split avoids.
 */
export function ButtonLink({
  children,
  href,
  variant = 'standard',
  'aria-label': ariaLabel,
}: ButtonLinkProps) {
  return (
    <a
      aria-label={ariaLabel}
      className={classNames(
        'baize-button',
        modifier('baize-button', 'variant', variant),
      )}
      href={href}
    >
      {children}
    </a>
  );
}
