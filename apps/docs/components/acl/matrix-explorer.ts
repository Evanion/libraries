import {
  AclConfigError,
  parseMatrix,
  type Access,
  type Condition,
  type Decision,
  type FieldConfig,
  type Matrix,
  type Permission,
} from '@evanion/acl';

/**
 * What the explorer does with a document a reader brought, and nothing else.
 *
 * `MatrixExplorer.tsx` holds the controls and this module holds every call into
 * the package, so `matrix-explorer.test.ts` asks the same questions the screen
 * asks without rendering one. Nothing here reads a URL, a cookie or a network:
 * the site is a static export, the evaluator is the package, and a reader's
 * document has nowhere to go.
 *
 * Adoption is `parseMatrix` and never `hydratePolicy`. A reader's document is
 * foreign input by definition, so the closed path is the honest one: a key the
 * document does not carry refuses rather than throwing, which is what a
 * consumer of a published contract gets.
 *
 * The explorer takes a document and never an `Access`. Decision 9 of
 * `docs/specs/2026-09-21-acl-matrix-introspection.md` argues it for a dev
 * route, and it holds here for a smaller reason: there is no `Access` on a
 * documentation page to take.
 */

/** The document the empty state offers, in the site's own shop vocabulary. */
export const sample: Matrix = {
  version: 'shop@12',
  maxStale: 900_000,
  schema: {
    subject: { fields: { id: 'string', roles: 'string[]' } },
    objects: {
      listing: {
        fields: {
          id: 'string',
          sellerId: 'string',
          status: 'string',
          title: 'string',
          price: 'number',
        },
      },
      order: {
        fields: { id: 'string', buyerId: 'string', placedAt: 'instant' },
      },
    },
  },
  permissions: [
    {
      key: 'listing.read',
      object: 'listing',
      action: 'read',
      visibility: 'public',
      rules: [{ id: 'anyone', when: [] }],
    },
    {
      key: 'listing.update',
      object: 'listing',
      action: 'update',
      visibility: 'public',
      rules: [
        {
          id: 'seller',
          when: [{ field: 'object.sellerId', op: 'eq', path: 'subject.id' }],
        },
      ],
      denyRules: [
        {
          id: 'archived',
          when: [{ field: 'object.status', op: 'eq', value: 'archived' }],
        },
      ],
      fields: { fields: ['*', '!sellerId'] },
    },
    {
      key: 'order.refund',
      object: 'order',
      action: 'refund',
      rules: [
        {
          id: 'support',
          when: [{ field: 'subject.roles', op: 'contains', value: 'support' }],
        },
      ],
    },
  ],
};

/**
 * The sample as the reader sees it, and as the textarea is filled with.
 *
 * One definition rather than a fence on the page beside a constant here. The
 * page renders this string, so what a reader copies is the document the button
 * loads.
 */
export const sampleText = JSON.stringify(sample, null, 2);

/** The subject the explorer opens with: a seller, which the sample has rules for. */
export const sampleSubject = JSON.stringify({ id: 'u_31', roles: ['seller'] });

/** Where inside the document a refusal points, as the error carries it. */
export interface Located {
  /** The permission key the error names. */
  key?: string;
  /** The field or member the error names. */
  field?: string;
  /** The position inside the permission, as `rules[0].when[0]`. */
  where?: string;
}

/** What the explorer holds after reading whatever is in the box. */
export type Adoption =
  | { state: 'empty' }
  /** `JSON.parse` refused. The document is not JSON yet. */
  | { state: 'unparsed'; message: string }
  /** The package refused the document. `at` is what the error located. */
  | {
      state: 'refused';
      /** The error class, as `errors.mdx` names it. */
      name: string;
      message: string;
      at: Located;
      /** False for a throw that is not an `AclConfigError`, which nothing should produce. */
      configFault: boolean;
    }
  | { state: 'ready'; access: Access };

/** The one string property, or nothing, so a number or an object never renders. */
function located(error: unknown, name: keyof Located): string | undefined {
  const held = (error as Record<string, unknown>)[name];
  return typeof held === 'string' ? held : undefined;
}

/**
 * Reads the box: JSON first, then the package.
 *
 * The two failures are kept apart because the reader's next move differs. A
 * `SyntaxError` means the text is not a document yet and the fix is a comma. An
 * `AclConfigError` means the document parsed and the package refused a value
 * inside it, and the error located that value.
 */
export function adopt(text: string): Adoption {
  if (text.trim() === '') return { state: 'empty' };

  let document: unknown;

  try {
    document = JSON.parse(text);
  } catch (error) {
    return {
      state: 'unparsed',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    return { state: 'ready', access: parseMatrix(document as Matrix) };
  } catch (error) {
    return {
      state: 'refused',
      name: error instanceof Error ? error.constructor.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
      at: {
        key: located(error, 'key'),
        field: located(error, 'field'),
        where: located(error, 'where'),
      },
      configFault: error instanceof AclConfigError,
    };
  }
}

/** One rule, as the list draws it. */
export interface RuleReport {
  /** The rule's own id, or nothing where the document gave none. */
  id?: string;
  /** Each condition as one line. Empty where the rule carries no condition. */
  conditions: readonly string[];
}

/** One field config, named by which of the two forms it is. */
export interface FieldConfigReport {
  field: string;
  form: 'targets' | 'transitions';
  /** The values it names, or the states it moves between. */
  detail: string;
}

/** One permission, as the list draws it. */
export interface PermissionReport {
  key: string;
  object: string;
  action: string;
  /** Absent `visibility` is `internal`, which is what `serialize` reads. */
  published: boolean;
  /** `access.readsObject`, which decides whether a row is owed before a decision. */
  readsObject: boolean;
  allow: readonly RuleReport[];
  deny: readonly RuleReport[];
  /** The name allow-list, `['*', '!sellerId']`, as the document wrote it. */
  allowList: readonly string[];
  configs: readonly FieldConfigReport[];
}

/** What the document declares, above its permissions. */
export interface Declared {
  version?: string;
  /** The freshness budget, worded, or nothing where the document states none. */
  maxStale?: string;
  /** Each declared object kind with its fields, as `title: string`. */
  kinds: readonly { kind: string; fields: readonly string[] }[];
  /** The subject's declared fields, where the schema declares a subject. */
  subjectFields: readonly string[];
  permissions: readonly PermissionReport[];
  /** How many permissions `serialize(access, 'reduced')` would keep. */
  publishedCount: number;
}

/**
 * One condition as one line.
 *
 * No narrowing on `field === 'now'`: the other arm of `Condition` types `field`
 * as `string`, so the check does not discriminate the union and both arms carry
 * the three members this reads.
 */
export function conditionText(condition: Condition): string {
  const right =
    'path' in condition && condition.path !== undefined
      ? condition.path
      : JSON.stringify(condition.value ?? null);

  return `${condition.field} ${condition.op} ${right}`;
}

function ruleReport(rule: {
  id?: string;
  when?: readonly Condition[];
}): RuleReport {
  return { id: rule.id, conditions: (rule.when ?? []).map(conditionText) };
}

function configReport(field: string, config: FieldConfig): FieldConfigReport {
  if ('targets' in config) {
    return {
      field,
      form: 'targets',
      detail: config.targets.map((value) => JSON.stringify(value)).join(', '),
    };
  }

  return {
    field,
    form: 'transitions',
    detail: Object.entries(config.transitions)
      .map(([from, to]) => `${from} → ${to.map(String).join(', ')}`)
      .join('; '),
  };
}

/** A member of `fields` that is a config rather than the name allow-list. */
function isConfig(value: unknown): value is FieldConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('targets' in value || 'transitions' in value)
  );
}

function permissionReport(
  access: Access,
  permission: Permission,
): PermissionReport {
  const rules = permission.fields ?? {};

  return {
    key: permission.key,
    object: permission.object,
    action: permission.action,
    published: permission.visibility === 'public',
    readsObject: access.readsObject(permission.object, permission.action),
    allow: (permission.rules ?? []).map(ruleReport),
    deny: (permission.denyRules ?? []).map(ruleReport),
    allowList: rules.fields ?? [],
    configs: Object.entries(rules)
      .filter(([field]) => field !== 'fields')
      .flatMap(([field, value]) =>
        isConfig(value) ? [configReport(field, value)] : [],
      ),
  };
}

/** How long a holder may keep deciding, in the units a reader reads. */
function budget(maxStale: number): string {
  const seconds = maxStale / 1000;
  if (seconds < 60) return `${maxStale} ms, ${seconds} seconds`;
  return `${maxStale} ms, ${seconds / 60} minutes`;
}

/** Everything the list and the panel draw, computed once per adopted document. */
export function declared(access: Access): Declared {
  const schema = access.schema;
  const objects = schema?.objects ?? {};

  return {
    version: access.version === undefined ? undefined : String(access.version),
    maxStale:
      access.matrix.maxStale === undefined
        ? undefined
        : budget(access.matrix.maxStale),
    kinds: Object.entries(objects).map(([kind, shape]) => ({
      kind,
      fields: Object.entries(shape.fields ?? {}).map(
        ([field, type]) => `${field}: ${type}`,
      ),
    })),
    subjectFields: Object.entries(schema?.subject?.fields ?? {}).map(
      ([field, type]) => `${field}: ${type}`,
    ),
    permissions: access.matrix.permissions.map((permission) =>
      permissionReport(access, permission),
    ),
    publishedCount: access.matrix.permissions.filter(
      (permission) => permission.visibility === 'public',
    ).length,
  };
}

/** What the subject box produced: a subject, or the reason it did not. */
export type SubjectRead =
  | { state: 'ready'; subject: Record<string, unknown> }
  | { state: 'unparsed'; message: string }
  /** JSON that parsed to something a subject cannot be, such as `[]` or `3`. */
  | { state: 'not-an-object' };

export function readSubject(text: string): SubjectRead {
  let held: unknown;

  try {
    held = JSON.parse(text);
  } catch (error) {
    return {
      state: 'unparsed',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof held !== 'object' || held === null || Array.isArray(held)) {
    return { state: 'not-an-object' };
  }

  return { state: 'ready', subject: held as Record<string, unknown> };
}

/**
 * Every decision this document reaches for one subject, in document order.
 *
 * One `capabilities` call rather than a loop of `can`, because the call settles
 * one clock for the whole document: a loop lets a `now` boundary fall between
 * two rows of the same table.
 */
export function decide(
  access: Access,
  subject: Record<string, unknown>,
): readonly Decision[] {
  const map = access.capabilities(subject);
  return access.matrix.permissions.flatMap((permission) => {
    const decision = map[permission.key];
    return decision === undefined ? [] : [decision];
  });
}
