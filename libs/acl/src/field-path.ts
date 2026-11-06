/**
 * The field path codec.
 *
 * A path is segments joined by `.`. A segment containing `.` or `\` escapes
 * each with `\`, so every key a JSON object can carry is nameable.
 */

/** Splits a path into segments, or returns `undefined` when it is malformed. */
export function parsePath(path: string): readonly string[] | undefined {
  const segments: string[] = [];
  let current = '';
  for (let i = 0; i < path.length; i++) {
    const char = path[i] as string;
    if (char === '\\') {
      const next = path[i + 1];
      if (next !== '.' && next !== '\\') return undefined;
      current += next;
      i++;
    } else if (char === '.') {
      if (current === '') return undefined;
      segments.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current === '') return undefined;
  segments.push(current);
  return segments;
}

/**
 * Joins segments into a path, escaping `.` and `\` in each. Segments must be
 * non-empty: an empty segment formats to a path `parsePath` refuses.
 */
export function formatPath(segments: readonly string[]): string {
  return segments.map((segment) => segment.replace(/[\\.]/g, '\\$&')).join('.');
}

/**
 * Describes why a path cannot be a field-rule path, or returns `undefined`
 * when it can. A segment may not be `__proto__` or `*`, nor start with `!`.
 */
export function pathFault(path: string): string | undefined {
  const segments = parsePath(path);
  if (segments === undefined) {
    return `${JSON.stringify(path)} is not a well-formed path: it needs non-empty segments, and "\\" may only escape "." or "\\".`;
  }
  for (const segment of segments) {
    if (segment === '__proto__')
      return `${JSON.stringify(path)} has a "__proto__" segment, which cannot name a field.`;
    if (segment === '*')
      return `${JSON.stringify(path)} has a "*" segment; "*" is only valid as a whole list entry.`;
    if (segment.startsWith('!'))
      return `${JSON.stringify(path)} has a segment starting with "!"; "!" is only valid at the start of a list entry.`;
  }
  return undefined;
}
