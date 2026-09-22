import {
  AclConfigError,
  parseMatrix,
  type Access,
  type Condition,
  type Decision,
  type FieldConfig,
  type FieldType,
  type Matrix,
  type Permission,
} from '@evanion/acl';

/**
 * What the explorer does with a document a reader brought, and nothing else.
 *
 * `ExplorerScreen.tsx` holds the panes and this module holds every call into
 * the package, so `explorer.test.tsx` asks the same questions the screen asks
 * without rendering one. Nothing here reads a URL, a cookie or a network: the
 * site is a static export, the evaluator is the package, and a reader's
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

/**
 * A row per object kind the sample reads, for the control that fills a box.
 *
 * `sellerId` is the sample subject's own id and `status` is not `archived`,
 * so this row is the one that answers `allow`. That is deliberate: a reader
 * watching `unevaluable` become a real decision learns more from a decision
 * that went their way, and the two refusals are one edit away from here --
 * change `status` to `archived` for `denied`, change `sellerId` for
 * `no-rule-matched`.
 *
 * Not loaded with the document. The explorer opens on `unevaluable` with
 * `missing` naming both paths, which is the thing the tool exists to show, and
 * a prefilled row would take it off the first screen.
 */
export const sampleRows: Readonly<Record<string, Record<string, unknown>>> = {
  listing: {
    id: 'l_7',
    sellerId: 'u_31',
    status: 'live',
    title: 'Wingspan',
    price: 59,
  },
};

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

/**
 * The character offset a `JSON.parse` message names, where it names one.
 *
 * V8 writes two shapes. The long one is `… at position 14 (line 3 column 3)`
 * and the short one quotes the text instead: `Unexpected token 'o', ..."ons":
 * [\n  oops\n}" is not valid JSON`, measured on Node 24. The offset is read out
 * of the first and the second carries none, so a reader meeting the short form
 * gets the message and no marked line. The line is computed from the offset
 * rather than read out of the sentence, because the sentence's shape is the
 * part that changes between releases.
 */
export function errorPosition(message: string): number | undefined {
  const found = /position (\d+)/.exec(message);
  return found?.[1] === undefined ? undefined : Number(found[1]);
}

/** The 1-based line and column a character offset falls on. */
export function lineAt(
  text: string,
  position: number,
): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, Math.min(position, text.length)));
  const lines = before.split('\n');

  return { line: lines.length, column: (lines.at(-1) ?? '').length + 1 };
}

/**
 * The first line naming a permission key.
 *
 * A text search for `"the.key"` and not a source map. The package's errors
 * locate a value inside the document -- `key`, `field`, `where` -- and nothing
 * carries the offset the reader's own text had, because the document reached
 * the package as a parsed object. Searching for the key finds the right line in
 * every document that states its keys once, which is every document this
 * repository has, and finds the first of them otherwise.
 */
export function lineOfKey(text: string, key: string): number | undefined {
  const at = text.split('\n').findIndex((line) => line.includes(`"${key}"`));
  return at === -1 ? undefined : at + 1;
}

/** What a JSON box produced: an object, or the reason it did not. */
export type JsonRead =
  | { state: 'ready'; value: Record<string, unknown> }
  | { state: 'unparsed'; message: string }
  /** JSON that parsed to something with no paths in it, such as `[]` or `3`. */
  | { state: 'not-an-object' };

/**
 * Reads a subject box, or a row box for a kind the document describes no shape
 * for. One reader, because both boxes want the same thing and a reader owed two
 * different reports for the same mistake would have to learn both.
 *
 * A malformed one is reported the way a malformed document is: the message
 * `JSON.parse` gave, next to the box, and nothing reaches the package. For a
 * row that means the permission stays on its `capabilities` answer, so it
 * still reports `unevaluable` rather than being decided against half a row.
 */
export function readJsonObject(text: string): JsonRead {
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

  return { state: 'ready', value: held as Record<string, unknown> };
}

/**
 * The object kinds a decision needs a row for, in document order.
 *
 * Only the kinds of permissions `access.readsObject` answers true for. A
 * permission that reads no `object.*` path decides the same with a row and
 * without one, so asking a reader for that row would be asking for something
 * that changes no answer.
 *
 * `ObjectSchema.relations` is not read here, and neither is `fields`. The
 * object is a document the reader enters, the way the subject is, so the
 * document's declared shape decides nothing about the input. `relations` could
 * not reach an input in any case: it names the kinds one kind points at for
 * the consumers that resolve them, and a condition compares one field of one
 * scope, so no condition can name a relation.
 */
export function objectKinds(access: Access): readonly string[] {
  const seen = new Set<string>();

  return access.matrix.permissions.flatMap((permission) => {
    if (seen.has(permission.object)) return [];
    if (!access.readsObject(permission.object, permission.action)) return [];
    seen.add(permission.object);
    return [permission.object];
  });
}

/**
 * The empty value a declared type takes in a skeleton row.
 *
 * `FieldType` is a flat string -- `number`, `string[]`, `instant?` -- so this
 * is the whole of reading one: a trailing `?` is optionality, which changes
 * nothing here because a skeleton carries every field and the reader deletes
 * what they want absent, and a trailing `[]` is an array.
 *
 * An `instant` gets an empty string, because it crosses JSON as an ISO 8601
 * string or as epoch milliseconds and the string form is the one a reader can
 * type over.
 */
function emptyValue(type: FieldType): unknown {
  const core = type.endsWith('?') ? type.slice(0, -1) : type;

  if (core.endsWith('[]')) return [];
  if (core === 'number') return 0;
  if (core === 'boolean') return false;
  return '';
}

/** Where a filled row would come from, or that nothing can fill one. */
export type RowSource = 'sample' | 'schema' | 'none';

/**
 * A row to drop into one kind's box, and where it came from.
 *
 * The bundled row wins where the document declares every field it names,
 * which is true of the sample and of any document whose `listing` carries the
 * same shape. It fits by construction in both cases, and it is the row that
 * produces an interesting answer rather than a skeleton of empty values.
 *
 * Otherwise the schema describes one: every declared field, each holding the
 * empty value of its type. That moves the permission off `unevaluable` --
 * every path it reads is now present -- and onto whatever those values decide,
 * which is where the reader starts editing.
 *
 * A kind the schema declares no fields for gets nothing. There is no third
 * source: the conditions name paths, and a row invented from the paths a rule
 * happens to read would be the tool guessing at a shape the document declined
 * to state.
 */
export function rowFor(
  access: Access,
  kind: string,
): { source: RowSource; row?: Record<string, unknown> } {
  const fields = access.schema?.objects?.[kind]?.fields;
  const bundled = sampleRows[kind];

  if (
    bundled !== undefined &&
    fields !== undefined &&
    Object.keys(bundled).every((field) => field in fields)
  ) {
    return { source: 'sample', row: bundled };
  }

  if (fields === undefined || Object.keys(fields).length === 0) {
    return { source: 'none' };
  }

  return {
    source: 'schema',
    row: Object.fromEntries(
      Object.entries(fields).map(([field, type]) => [field, emptyValue(type)]),
    ),
  };
}

/**
 * The rows the reader entered, keyed by object kind.
 *
 * A kind absent from this map has no row, which is a different thing from a
 * row with nothing in it. Three states, and a reader reaches each one
 * deliberately:
 *
 * - no row at all: the permission stays on its `capabilities` answer, which is
 *   `unevaluable` with `missing` naming every path its rules read;
 * - a row without the key, `{}` or `{ "id": "l_1" }` against a rule reading
 *   `object.status`: `unevaluable` again, and `missing` names what is short;
 * - a row with the key and an empty value, `{ "status": "" }`: a value the
 *   engine compares and a comparison that fails, so `no-rule-matched`.
 *
 * The screen holds the first apart from the second by whether the box is empty
 * and the second apart from the third by what the reader typed into it, so
 * none of the three needs a control of its own.
 */
export type Rows = Readonly<Record<string, Record<string, unknown>>>;

/**
 * Every decision this document reaches, in document order, and how each was
 * asked.
 *
 * One `capabilities` call carries every permission, because the call settles
 * one clock for the whole document where a loop of `can` settles one per
 * permission. A permission that reads the object and has a row is then asked
 * again with that row through `can`, which is the only way to hand the engine
 * one. The clock moves by whatever those calls take, which is why the cheap
 * path stays the default and only an object-reading permission is re-asked.
 *
 * A kind with no row is left on its `capabilities` answer, so a permission that
 * reads the object still reports `unevaluable` with `missing` naming the paths
 * it could not read. That is the tool's most useful screen and nothing here
 * takes it away.
 */
export interface Asked {
  decision: Decision;
  /** Which call answered: the document-wide one, or the one carrying a row. */
  through: 'capabilities' | 'can';
}

export function decide(
  access: Access,
  subject: Record<string, unknown>,
  rows: Rows = {},
): readonly Asked[] {
  const map = access.capabilities(subject);

  return access.matrix.permissions.flatMap<Asked>((permission) => {
    const row = rows[permission.object];
    const reads = access.readsObject(permission.object, permission.action);

    if (reads && row !== undefined) {
      return [
        {
          decision: access.can(
            subject,
            permission.object,
            permission.action,
            row,
          ),
          through: 'can' as const,
        },
      ];
    }

    const decision = map[permission.key];
    return decision === undefined
      ? []
      : [{ decision, through: 'capabilities' as const }];
  });
}
