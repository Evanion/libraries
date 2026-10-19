import { Fragment } from 'react';

/** Copy text where a `backticked` span is code. */
export function InlineCode({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) => (
        <Fragment key={i}>{i % 2 ? <code>{part}</code> : part}</Fragment>
      ))}
    </>
  );
}
