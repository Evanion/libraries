/**
 * The one piece of client behaviour the package has: copying a value.
 *
 * Plain DOM, no React. The components render `data-copy` attributes and hold
 * no state, so they render the same on the server, in a SPA and in a Server
 * Component. This helper is what makes those attributes do something, and it
 * runs once per page from the app's client entry.
 */

/** How long a button shows its copied label. */
export const COPIED_FOR_MS = 1500;

/**
 * Starts copying on click for every `[data-copy]` element under `root`,
 * present or added later: one delegated listener, nothing per button.
 *
 * On a click it writes the element's `data-copy` value to the clipboard, sets
 * `data-copied` on it for {@link COPIED_FOR_MS}, and writes its
 * `data-copied-label` into the `[data-copy-status]` live region beside it, so
 * a screen reader hears the copy. A failed write (no permission, an insecure
 * context) leaves the button as it was.
 *
 * Returns a function that removes the listener.
 *
 * ```ts
 * // entry.client.tsx, or the SPA's main.tsx
 * import { enableCopy } from '@evanion/ui/client';
 *
 * enableCopy();
 * ```
 */
export function enableCopy(
  root: Document | HTMLElement = document,
): () => void {
  const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLElement>('[data-copy]');
    if (!button || !root.contains(button)) return;

    const value = button.dataset['copy'] ?? '';
    const status = statusFor(button);

    void navigator.clipboard.writeText(value).then(
      () => {
        clearTimeout(timers.get(button));
        button.dataset['copied'] = '';
        if (status) status.textContent = button.dataset['copiedLabel'] ?? '';

        timers.set(
          button,
          setTimeout(() => {
            delete button.dataset['copied'];
            if (status) status.textContent = '';
          }, COPIED_FOR_MS),
        );
      },
      () => undefined,
    );
  };

  root.addEventListener('click', onClick);

  return () => root.removeEventListener('click', onClick);
}

/** The live region `CopyButton` renders right after its button. */
function statusFor(button: HTMLElement): HTMLElement | null {
  const next = button.nextElementSibling;

  return next instanceof HTMLElement && next.hasAttribute('data-copy-status')
    ? next
    : null;
}
