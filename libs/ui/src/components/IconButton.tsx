import { Button } from './Button.js';
import type { ButtonProps } from './Button.js';
import { Icon } from './Icon.js';
import type { IconComponent } from './Icon.js';
import { classNames } from './tone.js';

/** A button's props, with an icon and the label that names it. */
export type IconButtonProps = Omit<ButtonProps, 'children' | 'aria-label'> & {
  icon: IconComponent;
  /** The button's accessible name and its tooltip. */
  label: string;
};

/** A button that shows only an icon. `label` is its name and its `title`. */
export function IconButton({
  icon,
  label,
  className,
  ...props
}: IconButtonProps) {
  return (
    <Button
      className={classNames('icon-button', className)}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon icon={icon} />
    </Button>
  );
}
