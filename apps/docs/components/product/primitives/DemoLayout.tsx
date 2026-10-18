import type { ReactNode } from 'react';
import './primitives.css';

/**
 * A demo's controls and the code they drive. Controls come first in the DOM so
 * phones and screen readers meet the interaction first; from 960px the code
 * sits to the right.
 */
export function DemoLayout({
  controls,
  code,
  className,
}: {
  controls: ReactNode;
  code: ReactNode;
  className?: string;
}) {
  return (
    <div className={['demo-layout', className].filter(Boolean).join(' ')}>
      <div className="demo-layout__controls">{controls}</div>
      <div className="demo-layout__code">{code}</div>
    </div>
  );
}
