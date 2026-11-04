import type { ReactNode } from 'react';

import type { Tone } from './tone.js';

/** The page title, an optional description and the actions beside them. */
export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Buttons or links, laid out at the end of the row. */
  actions?: ReactNode;
}

/** The page's `<h1>`, a description under it and its actions. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/** A card's optional title and its content. */
export interface CardProps {
  /** The card's `<h2>`, and its region's accessible name. */
  title?: string;
  children: ReactNode;
}

/** A surface. With a title it is a named region. */
export function Card({ title, children }: CardProps) {
  return (
    <section className="card" aria-label={title}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

/** What the empty state says, and the action it offers. */
export interface EmptyStateProps {
  children: ReactNode;
}

/** What a list shows when it has nothing in it, usually with the action that adds the first item. */
export function EmptyState({ children }: EmptyStateProps) {
  return <div className="empty-state">{children}</div>;
}

/** An alert's tone and message. */
export interface AlertProps {
  /**
   * Defaults to `negative`. `negative` and `warning` render `role="alert"`,
   * which a screen reader announces at once; any other tone renders
   * `role="status"`, which waits its turn.
   */
  tone?: Tone;
  children: ReactNode;
}

/** A message about the page: a failed save, a warning, a confirmation. */
export function Alert({ tone = 'negative', children }: AlertProps) {
  const urgent = tone === 'negative' || tone === 'warning';

  return (
    <p className="alert" data-tone={tone} role={urgent ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
