import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

import { Icon } from './Icon.js';
import type { IconComponent } from './Icon.js';
import { classNames } from './tone.js';

/**
 * `primary` inverts ink and ground; there is no brand colour. `danger` marks
 * a destructive action in the negative tone.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

/** A native button's attributes, plus its variant. */
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Rendered before the children. */
  icon?: IconComponent;
};

/**
 * A native `<button>`. `type` defaults to `button`, so a button inside a form
 * submits only when it says so.
 */
export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  icon,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames('button', className)}
      data-variant={variant}
      {...props}
    >
      {icon && <Icon icon={icon} />}
      {children}
    </button>
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
