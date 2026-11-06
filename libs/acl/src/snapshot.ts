import { InvalidMatrixError } from './errors.js';
import type { AclConfigError } from './errors.js';
import { keyOf } from './issues.js';
import type { Segment } from './issues.js';
import type { Matrix, MatrixSchema, Permission } from './types.js';

/** Whether a value is shaped like a document at all, before anything reads it. */
export function isEnvelope(matrix: unknown): matrix is Matrix {
  return (
    typeof matrix === 'object' && matrix !== null && !Array.isArray(matrix)
  );
}

/** Receives a refusal and the path of the node it is about. */
export type Refuse = (
  error: AclConfigError,
  path: readonly Segment[],
  permissionKey?: string,
) => void;

/**
 * Clones one permission for the copy.
 *
 * Cloning is per permission so a value the structured clone algorithm refuses
 * (a function, a symbol, a structure nested deeper than it walks) is reported
 * against the permission holding it. A refused permission stays as it arrived.
 */
function cloneNode(
  permission: Permission,
  index: number,
  refuse: Refuse,
): Permission {
  try {
    return structuredClone(permission);
  } catch {
    refuse(
      new InvalidMatrixError(
        `permission "${permission.key}" holds a value that cannot be cloned: a function, a symbol, or a structure nested deeper than the clone walks`,
      ),
      ['permissions', index],
      keyOf(permission),
    );
    return permission;
  }
}

/**
 * Clones the declared shapes for the copy.
 *
 * The only way this refuses is a getter or a proxy the caller hung off the
 * object it passed in, or a value that is not a string. A refused schema stays
 * as it arrived.
 */
function cloneSchema(schema: MatrixSchema, refuse: Refuse): MatrixSchema {
  try {
    return structuredClone(schema);
  } catch {
    refuse(
      new InvalidMatrixError(
        'the schema holds a value that cannot be cloned: a function, a symbol, or a structure nested deeper than the clone walks',
      ),
      ['schema'],
    );
    return schema;
  }
}

/**
 * The document rebuilt from one read of each envelope member, unfrozen.
 *
 * The envelope is rebuilt, not cloned whole, so an absent version or schema
 * stays absent through a JSON round trip instead of becoming a key holding
 * undefined. The override wins over the document's version.
 *
 * Every member is read once, into this copy. The schema is cloned before the
 * permissions, and the permissions in order, so `refuse` hears the faults in
 * that order.
 */
export function copyOf(
  matrix: Matrix,
  override: string | number | undefined,
  refuse: Refuse,
): Matrix {
  const { schema, permissions, maxStale } = matrix;
  const version = override ?? matrix.version;
  return {
    ...(version === undefined ? {} : { version }),
    ...(maxStale === undefined ? {} : { maxStale }),
    ...(schema === undefined ? {} : { schema: cloneSchema(schema, refuse) }),
    permissions: Array.isArray(permissions)
      ? permissions.map((permission, index) =>
          cloneNode(permission, index, refuse),
        )
      : permissions,
  } as Matrix;
}
