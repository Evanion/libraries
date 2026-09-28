import { useId } from 'react';

import { roles, type Role } from './access';

/** A role, as the interface names it. */
function label(role: Role): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

interface RoleSwitchProps {
  role: Role;
  onChange: (role: Role) => void;
}

/**
 * Who is signed in, and the control that changes it.
 *
 * Radio inputs rather than buttons: one of three is exactly what a radio group
 * is, and a browser already gives it arrow-key navigation, a single tab stop and
 * the right announcement. The inputs are off-screen and the segment beside each
 * is what is drawn, so the focus ring follows the input onto the segment.
 */
export function RoleSwitch({ role, onChange }: RoleSwitchProps) {
  const group = useId();
  return (
    <div className="landing-seg" role="group" aria-label="Signed in as">
      {roles.map((option) => (
        <label key={option} className="landing-seg__option">
          <input
            className="landing-sr-only"
            type="radio"
            name={`${group}-role`}
            value={option}
            checked={role === option}
            onChange={() => onChange(option)}
          />
          <span className="landing-seg__face">{label(option)}</span>
        </label>
      ))}
    </div>
  );
}
