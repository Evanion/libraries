import type { ButtonHTMLAttributes } from 'react';

import { classNames } from './tone.js';

/**
 * A button's attributes, less `children`, `role` and `type`, which the switch
 * sets itself.
 */
export type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'role' | 'type'
> & {
  checked: boolean;
  /** Names what the switch turns on and off. */
  label: string;
};

/**
 * An on/off switch that submits its form. Render one form per switch, with
 * the target state in a hidden input or in this button's `name` and `value`,
 * and it works with no client JavaScript: the server flips the state and the
 * page re-renders with `checked` changed.
 */
export function Switch({ checked, label, className, ...props }: SwitchProps) {
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={classNames('switch', className)}
      {...props}
    />
  );
}
