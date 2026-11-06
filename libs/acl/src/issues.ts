import { InvalidMatrixError, InvalidPermissionError } from './errors.js';
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

/**
 * Runs `read`, and when it throws reports `unreadable()` at `path` instead. The
 * collectors report every fault they find and throw nothing themselves, so a
 * throw here is the document: a getter that throws, a revoked proxy. Whatever
 * `read` reported before it threw stays reported.
 */
export function guarded(
  report: Report,
  path: readonly Segment[],
  unreadable: () => AclConfigError,
  read: () => void,
  permissionKey?: string,
): void {
  try {
    read();
  } catch {
    report(unreadable(), path, permissionKey);
  }
}

/** The key a permission states, or `undefined` when reading it fails. */
export function keyOf(permission: unknown): string | undefined {
  try {
    const key = (permission as { key?: unknown }).key;
    return typeof key === 'string' && key.length > 0 ? key : undefined;
  } catch {
    return undefined;
  }
}

/** The error for permission `index` when reading it throws. */
export function unreadablePermission(
  index: number,
  permission: unknown,
): AclConfigError {
  const key = keyOf(permission);
  return key === undefined
    ? new InvalidMatrixError(`permission [${index}] could not be read`)
    : new InvalidPermissionError(
        key,
        `permissions[${index}]`,
        'could not be read',
      );
}

/** The error for a document that cannot be read at all. */
export function unreadableDocument(): AclConfigError {
  return new InvalidMatrixError('the document could not be read');
}
