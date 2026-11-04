import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

import { classNames } from './tone.js';

/** `primary` inverts ink and ground; there is no brand colour. */
export type ButtonVariant = 'primary' | 'secondary';

/** A native button's attributes, plus its variant. */
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

/**
 * A native `<button>`. `type` defaults to `button`, so a button inside a form
 * submits only when it says so.
 */
export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames('button', className)}
      data-variant={variant}
      {...props}
    />
  );
}

/** An anchor's attributes, plus its variant. */
export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
};

/** A link styled as a button, for navigation that looks like an action. */
export function ButtonLink({
  variant = 'secondary',
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <a
      className={classNames('button', className)}
      data-variant={variant}
      {...props}
    >
      {children}
    </a>
  );
}
