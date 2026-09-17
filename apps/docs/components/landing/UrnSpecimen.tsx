'use client';

import { useId, useState } from 'react';
import {
  urnComponents,
  urnEquals,
  urnParts,
  urnWith,
  type ComponentKey,
} from './specimens';

/** What each part of a URN is, in one sentence. */
const parts: { key: 'urn' | 'nid' | 'nss'; name: string; line: string }[] = [
  {
    key: 'urn',
    name: 'scheme',
    line: 'Always the same three letters, and they say what the rest of the string is: a name for something, not an address where it lives. A URL tells you where to go; this tells you what you mean.',
  },
  {
    key: 'nid',
    name: 'namespace',
    line: 'What kind of thing this names. Two systems can both number their records from 1, and this is what keeps those two 1s apart.',
  },
  {
    key: 'nss',
    name: 'name',
    line: 'The identifier itself, in whatever form the system it came from uses. Unique inside the namespace above, and nowhere else.',
  },
];

/**
 * The specimen as its parts, each explaining itself, and the three optional
 * components a reader can hang off it.
 *
 * The parts come from `URN.parse`, not from splitting the string on colons:
 * the package decides where the namespace ends and the name begins, and a
 * hand split would get that wrong in exactly the way the documentation once
 * did. The identifier itself is written by `URN.stringify`, so the delimiters
 * drawn between the parts are the ones the package placed.
 *
 * Each part is a button with a dotted underline, which is the hint that it
 * can be asked. Its explanation is always in the DOM and named by
 * `aria-describedby`, so a screen reader has it whether or not anything is
 * shown; sighted readers see it on hover, on keyboard focus, and on a tap,
 * which toggles it, because a touch screen has no hover and does not focus a
 * button on tap. The explanation sits under the whole specimen rather than
 * under the part, so it cannot run past the card's edge at any width.
 *
 * RFC 8141 2.3's r-, q- and f-components are attached rather than shown,
 * because three more coloured segments is what turns this card into a wall on
 * a phone. Nothing is attached at rest, so the card opens as the three parts
 * it has always opened as, and each component the reader adds arrives with
 * the same popover the parts have.
 *
 * What the components are for is the line under them: RFC 8141 3.1 keeps all
 * three out of URN-equivalence, so an identifier carrying them names exactly
 * what it named without them. The line is `URN.equals` answering, not a claim
 * about it -- a release in which that stopped holding would take the sentence
 * off the card rather than leave it lying.
 */
export default function UrnSpecimen({ value }: { value: string }) {
  const [attached, setAttached] = useState<ComponentKey[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();

  const shown = urnWith(value, attached);
  const parsed = urnParts(shown);
  const carried = urnComponents.filter((component) =>
    attached.includes(component.key),
  );

  function toggle(key: ComponentKey) {
    setAttached(
      attached.includes(key)
        ? attached.filter((held) => held !== key)
        : [...attached, key],
    );
  }

  return (
    <div className="landing-spec">
      <p className="landing-specimen landing-specimen--urn">
        {parts.map((part, index) => (
          <span key={part.key} className="landing-urn__segment">
            {index > 0 ? (
              <span className="landing-specimen__dim">:</span>
            ) : null}
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

        {carried.map((component) => (
          <span key={component.key} className="landing-urn__segment">
            <span className="landing-specimen__dim">{component.delimiter}</span>
            <button
              type="button"
              className="landing-urn__part landing-urn__part--component"
              aria-describedby={`${id}-${component.key}`}
              aria-expanded={open === component.key}
              onClick={() =>
                setOpen(open === component.key ? null : component.key)
              }
              onBlur={() => setOpen(null)}
            >
              {parsed[component.key]}
            </button>
            <span
              id={`${id}-${component.key}`}
              role="tooltip"
              className="landing-urn__tip"
              data-open={open === component.key ? '' : undefined}
            >
              <span className="landing-urn__tip-name">{component.name}</span>{' '}
              {component.line}
            </span>
          </span>
        ))}

        <output className="landing-sr-only" aria-live="polite">
          {shown}
        </output>
      </p>

      <div className="landing-spec__row">
        <span className="landing-spec__label" id={`${id}-attach`}>
          Attach
        </span>
        <div
          className="landing-chips"
          role="group"
          aria-labelledby={`${id}-attach`}
        >
          {urnComponents.map((component) => (
            <button
              key={component.key}
              type="button"
              className="landing-chip"
              aria-pressed={attached.includes(component.key)}
              onClick={() => toggle(component.key)}
            >
              {component.label}
            </button>
          ))}
        </div>
      </div>

      {attached.length > 0 && urnEquals(shown, value) ? (
        <p className="landing-spec__note">
          These three say how to fetch the thing, not which thing is meant, so
          adding them names nothing new: `URN.equals` still reads this as{' '}
          {value}.
        </p>
      ) : null}
    </div>
  );
}
