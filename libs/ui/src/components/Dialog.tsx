import type { ReactNode } from 'react';

/** The invoker commands a `<dialog>` answers to. */
export type DialogCommand = 'show-modal' | 'close' | 'request-close';

/**
 * The attributes that make a button open or close the dialog with `id`,
 * through invoker commands, with no script. Spread them onto a `<button>` or a
 * `Button`:
 *
 * ```tsx
 * <Button {...dialogCommand('invite')}>Invite</Button>
 * ```
 *
 * React has no prop for `commandfor`, and these are lowercase attributes it
 * passes through to the DOM as written.
 */
export function dialogCommand(
  id: string,
  command: DialogCommand = 'show-modal',
): Record<'commandfor' | 'command', string> {
  return { commandfor: id, command };
}

/** The dialog's id, its title, its close label and its content. */
export interface DialogProps {
  /** The id the opening button's `dialogCommand(id)` names. */
  id: string;
  /** The dialog's heading and its accessible name. */
  title: string;
  /** The close button's label. */
  closeLabel: string;
  /**
   * Which user actions close it. `any` adds a click on the backdrop to Escape;
   * a browser without `closedby` falls back to Escape alone.
   */
  closedBy?: 'any' | 'closerequest' | 'none';
  children: ReactNode;
}

/**
 * A native modal `<dialog>`. It opens and closes through invoker commands, so
 * it needs no client JavaScript. A form inside it with `method="dialog"`
 * closes it on submit; a form with `method="post"` submits as usual.
 */
export function Dialog({
  id,
  title,
  closeLabel,
  closedBy = 'any',
  children,
}: DialogProps) {
  return (
    <dialog
      id={id}
      className="dialog"
      aria-labelledby={`${id}-title`}
      closedby={closedBy}
    >
      <div className="dialog-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <button
          type="button"
          className="button"
          {...dialogCommand(id, 'close')}
        >
          {closeLabel}
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
