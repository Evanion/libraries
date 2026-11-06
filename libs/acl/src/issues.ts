import type { AclConfigError } from './errors.js';

/** One step into the document: an object key or an array index. */
export type Segment = string | number;

/**
 * Where the validator sends a fault. `path` locates the node at fault and
 * `permissionKey` names the permission it sits in, when it sits in one. Both are
 * set on the error here, after construction.
 */
export type Report = (
  error: AclConfigError,
  path: readonly Segment[],
  permissionKey?: string,
) => void;

/** A JSON pointer (RFC 6901) for `path`; `''` for the document root. */
export function pointerOf(path: readonly Segment[]): string {
  let pointer = '';
  for (const segment of path) {
    pointer += `/${String(segment).replaceAll('~', '~0').replaceAll('/', '~1')}`;
  }
  return pointer;
}

/** A sink that appends each reported error, located, to `into`. */
export function collectInto(into: AclConfigError[]): Report {
  return (error, path, permissionKey) => {
    error.path = pointerOf(path);
    if (permissionKey !== undefined) error.permissionKey = permissionKey;
    into.push(error);
  };
}

/** A sink that fills in `permissionKey` for every fault inside one permission. */
export function inPermission(report: Report, permissionKey: string): Report {
  return (error, path) => report(error, path, permissionKey);
}

/**
 * Runs `check` against a fresh sink and throws the first fault it reports, in
 * the order the checks ran.
 */
export function throwFirst(check: (report: Report) => void): void {
  const issues: AclConfigError[] = [];
  check(collectInto(issues));
  if (issues[0]) throw issues[0];
}

/**
 * `value` as an error message shows it: `JSON.stringify`'s output when that
 * succeeds, and otherwise a fixed description. A document from outside can hold
 * a bigint or a cycle, and a message about such a value must still build.
 */
export function show(value: unknown): string {
  try {
    return String(JSON.stringify(value));
  } catch {
    return typeof value === 'bigint' ? `${value}n` : '[unserializable]';
  }
}
