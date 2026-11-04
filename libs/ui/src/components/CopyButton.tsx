import { classNames } from './tone.js';

/** The value to copy and the two labels the button shows. */
export interface CopyButtonProps {
  /** What lands on the clipboard. */
  value: string;
  /** The button's label, such as "Copy" or "Copy SDK key". */
  copyLabel: string;
  /** What the button says, and a screen reader hears, after a copy. */
  copiedLabel: string;
  className?: string;
}

/**
 * A button that copies `value`, once `enableCopy()` from `@evanion/ui/client`
 * is running on the page. The component renders attributes only; the helper
 * listens for clicks on any `[data-copy]` element, writes the clipboard, sets
 * `data-copied` on the button for a moment and writes `copiedLabel` into the
 * status region beside it.
 */
export function CopyButton({
  value,
  copyLabel,
  copiedLabel,
  className,
}: CopyButtonProps) {
  return (
    <>
      <button
        type="button"
        className={classNames('button', className)}
        data-copy={value}
        data-copied-label={copiedLabel}
      >
        <span className="copy-label">{copyLabel}</span>
      </button>
      <span className="visually-hidden" role="status" data-copy-status="" />
    </>
  );
}
