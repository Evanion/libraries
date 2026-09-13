'use client';

import { useId, useState } from 'react';
import { urnParts } from './specimens';

/** What each part of a URN is, in one sentence. */
const parts: { key: 'urn' | 'nid' | 'nss'; name: string; line: string }[] = [
  {
    key: 'urn',
    name: 'scheme',
    line: 'Every URN starts with it: this string is a name, not a location.',
  },
  {
    key: 'nid',
    name: 'namespace',
    line: 'What kind of thing is named. Parsed out, so nothing downstream has to be told what a 1337 is.',
  },
  {
    key: 'nss',
    name: 'name',
    line: 'The identifier inside that namespace. Whatever the system it came from used.',
  },
];

/**
 * The specimen as its three parts, each explaining itself.
 *
 * The parts come from `URN.parse`, not from splitting the string on colons:
 * the package decides where the namespace ends and the name begins, and a
 * hand split would get that wrong in exactly the way the documentation once
 * did. The separators are drawn between what the parser returned.
 *
 * Each part is a button with a dotted underline, which is the hint that it
 * can be asked. Its explanation is always in the DOM and named by
 * `aria-describedby`, so a screen reader has it whether or not anything is
 * shown; sighted readers see it on hover, on keyboard focus, and on a tap,
 * which toggles it, because a touch screen has no hover and does not focus a
 * button on tap. The explanation sits under the whole specimen rather than
 * under the part, so it cannot run past the card's edge at any width.
 */
export default function UrnSpecimen({ value }: { value: string }) {
  const parsed = urnParts(value);
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();

  return (
    <p className="landing-specimen landing-specimen--urn">
      {parts.map((part, index) => (
        <span key={part.key} className="landing-urn__segment">
          {index > 0 ? <span className="landing-specimen__dim">:</span> : null}
          <button
            type="button"
            className={`landing-urn__part landing-urn__part--${part.key}`}
            aria-describedby={`${id}-${part.key}`}
            aria-expanded={open === part.key}
            onClick={() => setOpen(open === part.key ? null : part.key)}
            onBlur={() => setOpen(null)}
          >
            {parsed[part.key]}
          </button>
          <span
            id={`${id}-${part.key}`}
            role="tooltip"
            className="landing-urn__tip"
            data-open={open === part.key ? '' : undefined}
          >
            <span className="landing-urn__tip-name">{part.name}</span>{' '}
            {part.line}
          </span>
        </span>
      ))}
    </p>
  );
}
