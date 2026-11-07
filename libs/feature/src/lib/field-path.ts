/**
 * The context path codec and reader.
 *
 * A path is segments joined by `.`. A segment containing `.` or `\` escapes
 * each with `\`, so every key a JSON object can carry is nameable. The codec
 * matches the one in `@evanion/acl`, copied so neither package imports the
 * other.
 */

/** The most segments a path may have. */
const MAX_SEGMENTS = 32;

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

/** The path that names one flat key literally, dots and backslashes escaped. */
export function escapeField(name: string): string {
  return formatPath([name]);
}

/**
 * Describes why a path cannot name a field, or returns `undefined` when it
 * can. A segment may not be `__proto__`, `constructor`, `prototype` or `*`, nor
 * start with `!`, and a path has at most 32 segments.
 */
export function pathFault(path: string): string | undefined {
  const segments = parsePath(path);
  if (segments === undefined) {
    return `${JSON.stringify(path)} is not a well-formed path: it needs non-empty segments, and "\\" may only escape "." or "\\".`;
  }
  if (segments.length > MAX_SEGMENTS) {
    return `${JSON.stringify(path)} has ${segments.length} segments; a path has at most ${MAX_SEGMENTS}.`;
  }
  for (const segment of segments) {
    if (
      segment === '__proto__' ||
      segment === 'constructor' ||
      segment === 'prototype'
    )
      return `${JSON.stringify(path)} has a "${segment}" segment, which cannot name a field.`;
    if (segment === '*')
      return `${JSON.stringify(path)} has a "*" segment; "*" is only valid as a whole list entry.`;
    if (segment.startsWith('!'))
      return `${JSON.stringify(path)} has a segment starting with "!"; "!" is only valid at the start of a list entry.`;
  }
  return undefined;
}

function isPlainObject(value: unknown): value is object {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  } catch {
    // A proxy trap threw: the value is not one the reader can walk.
    return false;
  }
}

const ABSENT = { present: false } as const;

/**
 * Reads a path off a context. Each segment is an own data property of a plain
 * object, read from its descriptor so a getter never runs. A malformed path, a
 * missing segment, a non-plain parent, an accessor, a trapping proxy or a cycle
 * makes the field absent. An own value of `undefined` is present.
 */
export function readPath(
  bag: unknown,
  path: string,
): { present: boolean; value?: unknown } {
  const segments = parsePath(path);
  if (
    segments === undefined ||
    segments.length > MAX_SEGMENTS ||
    segments.includes('__proto__')
  ) {
    return ABSENT;
  }
  const visited = new Set<object>();
  let current: unknown = bag;
  for (const [index, segment] of segments.entries()) {
    if (!isPlainObject(current) || visited.has(current)) return ABSENT;
    visited.add(current);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(current, segment);
    } catch {
      return ABSENT;
    }
    if (descriptor === undefined || !('value' in descriptor)) return ABSENT;
    if (index === segments.length - 1) {
      return { present: true, value: descriptor.value };
    }
    current = descriptor.value;
  }
  return ABSENT;
}
