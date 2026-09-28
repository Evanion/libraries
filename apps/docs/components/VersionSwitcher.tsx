import type { VersionOption } from '../app/sections';

export interface VersionSwitcherProps {
  /** The published package name, for the control's accessible name. */
  package: string;
  options: readonly VersionOption[];
}

/**
 * The versions of the page the reader is on: the newest release, each retained
 * release line, and `main`.
 *
 * Per section and on the page, not in the navbar. The packages are versioned
 * independently, so a site-wide switcher would name nothing, and a reader who
 * arrived from a search result sees no chrome; the notice above the content is
 * where they look, and this sits beside it.
 *
 * Links, not a select. Each entry is a page the static export wrote, so it is a
 * plain navigation that works with no JavaScript and is crawlable, and an entry
 * whose version has no such page says it goes to the version's first page
 * before the reader follows it.
 */
export default function VersionSwitcher({
  package: name,
  options,
}: VersionSwitcherProps) {
  if (options.length < 2) return null;

  return (
    <nav className="docs-versions" aria-label={`Versions of ${name}`}>
      <span className="docs-versions__label">Version</span>
      <ul className="docs-versions__list">
        {options.map((option) => (
          <li key={option.href} className="docs-versions__item">
            <a
              href={option.href}
              aria-current={option.active ? 'page' : undefined}
              title={
                option.missing
                  ? `${option.label} has no such page; this goes to its first page`
                  : undefined
              }
            >
              {option.label}
            </a>
            {option.missing && !option.active ? (
              <span className="docs-versions__missing"> (first page)</span>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}
