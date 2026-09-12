/**
 * Named regions in a markdown file, so the docs app can render the same
 * example the package's README ships rather than a copy of it.
 *
 * A region is a pair of HTML comments around a fenced code block:
 *
 *     <!-- #region quick-start -->
 *     ```ts @import.meta.vitest
 *     …
 *     ```
 *     <!-- #endregion quick-start -->
 *
 * HTML comments because GitHub and npm render markdown and drop them, so the
 * README a reader sees is unmarked. The markers sit outside the fence rather
 * than inside it so that the extracted text is code, with no marker lines to
 * strip and no marker visible in the README's own rendering.
 *
 * The extracted block is executed, because the README it comes from is
 * executed — the docs app inherits that guarantee rather than adding one.
 */

const REGION = /<!--\s*#region\s+([\w-]+)\s*-->/;
const ENDREGION = /<!--\s*#endregion\s+([\w-]+)\s*-->/;
const FENCE = /^\s*(`{3,})(.*)$/;

/** A malformed or missing region, with the file and line in its message. */
export class RegionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RegionError';
  }
}

/**
 * Reads every named region out of a markdown source.
 *
 * A region must contain exactly one fenced block. Anything else — prose
 * between the markers, two blocks, none — is an error rather than a
 * best-effort extraction, because the failure it prevents is a docs page
 * quietly rendering the wrong thing.
 */
export function parseRegions(source, file) {
  const lines = source.split('\n');
  const regions = new Map();

  let open = null;
  let fence = null;
  let lang = '';
  let body = [];
  let blocks = 0;

  lines.forEach((line, index) => {
    const start = line.match(REGION);
    if (start && fence === null) {
      if (open) {
        throw new RegionError(
          `${file}:${index + 1}: region '${start[1]}' opens inside region '${open.name}'`,
        );
      }
      open = { name: start[1], at: index + 1 };
      blocks = 0;
      return;
    }

    const end = line.match(ENDREGION);
    if (end && fence === null) {
      if (!open) {
        throw new RegionError(
          `${file}:${index + 1}: #endregion '${end[1]}' closes nothing`,
        );
      }
      if (end[1] !== open.name) {
        throw new RegionError(
          `${file}:${index + 1}: #endregion '${end[1]}' closes region '${open.name}'`,
        );
      }
      if (blocks !== 1) {
        throw new RegionError(
          `${file}:${open.at}: region '${open.name}' wraps ${blocks} code blocks, expected exactly 1`,
        );
      }
      if (regions.has(open.name)) {
        throw new RegionError(
          `${file}:${index + 1}: region '${open.name}' is defined twice`,
        );
      }
      regions.set(open.name, { lang, code: body.join('\n') });
      open = null;
      return;
    }

    if (!open) return;

    const marker = line.match(FENCE);
    if (marker && fence === null) {
      fence = marker[1];
      // The fence info carries the doctest marker, which is meaningful to the
      // test run and noise on a docs page.
      lang = (marker[2]).replace('@import.meta.vitest', '').trim();
      body = [];
      blocks++;
      return;
    }

    if (marker && fence !== null && (marker[1]).startsWith(fence)) {
      fence = null;
      return;
    }

    if (fence !== null) body.push(line);
  });

  if (open) {
    throw new RegionError(
      `${file}:${open.at}: region '${open.name}' is never closed`,
    );
  }

  return regions;
}

/**
 * One region, or an error naming what is actually in the file.
 *
 * The list matters: the usual way this fails is a region that was renamed,
 * and the replacement name is almost always in that list.
 */
export function readRegion(source, file, name) {
  const regions = parseRegions(source, file);
  const region = regions.get(name);

  if (!region) {
    const known = [...regions.keys()].sort().join(', ') || 'none';
    throw new RegionError(
      `${file}: no region '${name}'. Regions in this file: ${known}`,
    );
  }

  return region;
}
